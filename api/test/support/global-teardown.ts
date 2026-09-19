export default async function globalTeardown(): Promise<void> {
  const infrastructure = globalThis.testInfrastructure;
  if (!infrastructure) return;

  await Promise.all([infrastructure.postgres.stop(), infrastructure.kafka.container.stop()]);
  globalThis.testInfrastructure = undefined;
}
