import { AsyncLocalStorage } from 'node:async_hooks';

export interface TraceContext {
    correlationId: string;
}

export const traceStorage = new AsyncLocalStorage<TraceContext>();

export function getCorrelationId(): string | undefined {
    return traceStorage.getStore()?.correlationId;
}
