// ADR-0003: one topic for every treasury fact, keyed by programId so one program's messages
// stay ordered; dead letters next to it; a single consumer group for the service.
export const TREASURY_TOPIC = 'treasury.capacity';
export const TREASURY_DEAD_LETTER_TOPIC = 'treasury.capacity.dlq';
export const TREASURY_CONSUMER_GROUP = 'capacity-service';
