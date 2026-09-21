export const MESSAGE_SOURCE = Symbol('MessageSource');

/** One record as it came off a topic. Bytes and metadata only: parsing belongs to the module. */
export interface InboundMessage {
  readonly topic: string;
  readonly partition: number;
  readonly offset: string;
  readonly key: string | null;
  readonly value: Buffer | null;
  readonly headers: Readonly<Record<string, string>>;
}

export interface OutboundMessage {
  readonly key: string | null;
  readonly value: Buffer | string;
  readonly headers?: Readonly<Record<string, string>>;
}

export type MessageHandler = (message: InboundMessage) => Promise<void>;

/**
 * ADR-0003: the broker behind a port. The message source knows topics, groups and offsets, and
 * nothing about what a message means (CLAUDE.md §2). The offset of a message is committed only
 * after its handler has returned, so a handler that throws sees the message again.
 */
export interface MessageSource {
  subscribe(topic: string, groupId: string, handler: MessageHandler): Promise<void>;
  publish(topic: string, messages: readonly OutboundMessage[]): Promise<void>;
}
