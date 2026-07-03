declare module 'nats' {
  export interface NatsConnection {
    publish(subject: string, data: string | Uint8Array): void;
    flush(): Promise<void>;
    close(): Promise<void>;
  }
  export interface NatsConnectOptions {
    servers: string | string[];
  }
  export function connect(opts: NatsConnectOptions): Promise<NatsConnection>;
}
