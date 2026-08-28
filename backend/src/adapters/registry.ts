import type { ServiceAdapter } from './base/types';

const adapters = new Map<string, ServiceAdapter>();

export function registerAdapter(adapter: ServiceAdapter): void {
  adapters.set(adapter.id, adapter);
}

export function getAdapter(id: string): ServiceAdapter | null {
  return adapters.get(id) ?? null;
}

export function getAdapterByDomain(domain: string): ServiceAdapter | null {
  for (const adapter of adapters.values()) {
    if (adapter.domain === domain) return adapter;
  }
  return null;
}

export function listAdapters(): ServiceAdapter[] {
  return Array.from(adapters.values());
}

export function classifyIntentAcrossAdapters(utterance: string): {
  adapter: ServiceAdapter;
  result: ReturnType<ServiceAdapter['classifyIntent']>;
} | null {
  let best: { adapter: ServiceAdapter; result: ReturnType<ServiceAdapter['classifyIntent']> } | null = null;

  for (const adapter of adapters.values()) {
    const result = adapter.classifyIntent(utterance);
    if (!best || result.confidence > best.result.confidence) {
      best = { adapter, result };
    }
  }

  return best && best.result.confidence > 0.3 ? best : null;
}
