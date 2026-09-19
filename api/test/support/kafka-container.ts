import {GenericContainer, StartedTestContainer, Wait} from 'testcontainers';
import {Kafka, logLevel} from 'kafkajs';

const CLIENT_PORT = 9092;
const CONTROLLER_PORT = 9094;
const STARTER_SCRIPT = '/tmp/start-kafka.sh';
const WAITING_FOR_STARTER = 'waiting for the starter script';
const READINESS_ATTEMPTS = 60;
const READINESS_PAUSE_MS = 1000;

export interface StartedKafka {
  readonly brokers: string;
  readonly container: StartedTestContainer;
}

const pause = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * `@testcontainers/kafka` only drives Confluent images, while ADR-0003 fixes the official
 * `apache/kafka` image for compose and for tests alike. The advertised listener has to carry the
 * mapped host port, which is unknown before the container runs, so the container idles on a
 * starter script that we write once the port is known. This is the same handshake the
 * Testcontainers Kafka module performs for Confluent images.
 */
export const startKafkaContainer = async (image: string): Promise<StartedKafka> => {
  const container = await new GenericContainer(image)
    .withExposedPorts(CLIENT_PORT)
    .withEnvironment({
      KAFKA_NODE_ID: '1',
      KAFKA_PROCESS_ROLES: 'broker,controller',
      KAFKA_LISTENERS: `PLAINTEXT://0.0.0.0:${CLIENT_PORT},CONTROLLER://0.0.0.0:${CONTROLLER_PORT}`,
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: 'PLAINTEXT:PLAINTEXT,CONTROLLER:PLAINTEXT',
      KAFKA_INTER_BROKER_LISTENER_NAME: 'PLAINTEXT',
      KAFKA_CONTROLLER_LISTENER_NAMES: 'CONTROLLER',
      KAFKA_CONTROLLER_QUORUM_VOTERS: `1@localhost:${CONTROLLER_PORT}`,
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: '1',
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: '1',
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: '1',
      KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS: '0',
      KAFKA_AUTO_CREATE_TOPICS_ENABLE: 'true',
    })
    .withEntrypoint(['sh'])
    .withCommand([
      '-c',
      `echo '${WAITING_FOR_STARTER}'; while [ ! -f ${STARTER_SCRIPT} ]; do sleep 0.1; done; sh ${STARTER_SCRIPT}`,
    ])
    .withWaitStrategy(Wait.forLogMessage(WAITING_FOR_STARTER))
    .withStartupTimeout(180_000)
    .start();

  const brokers = `${container.getHost()}:${container.getMappedPort(CLIENT_PORT)}`;
  const starter = [
    '#!/bin/sh',
    `export KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://${brokers}`,
    'exec /etc/kafka/docker/run',
    '',
  ].join('\n');
  await container.copyContentToContainer([{content: starter, target: STARTER_SCRIPT, mode: 0o777}]);

  await waitUntilBrokerAnswers(brokers);
  return {brokers, container};
};

const waitUntilBrokerAnswers = async (brokers: string): Promise<void> => {
  const admin = new Kafka({
    clientId: 'capacity-test-readiness',
    brokers: [brokers],
    logLevel: logLevel.NOTHING,
  }).admin();

  for (let attempt = 1; attempt <= READINESS_ATTEMPTS; attempt += 1) {
    const connected = await tryConnect(admin);
    if (connected) {
      await admin.disconnect();
      return;
    }
    await pause(READINESS_PAUSE_MS);
  }
  throw new Error(`Kafka at ${brokers} did not answer within ${READINESS_ATTEMPTS} attempts`);
};

const tryConnect = async (admin: {connect: () => Promise<void>}): Promise<boolean> => {
  try {
    await admin.connect();
    return true;
  } catch {
    return false;
  }
};
