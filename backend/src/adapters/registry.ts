import type { IntentResult } from '@waypoint/shared';
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

export interface AdapterMatch {
  adapter: ServiceAdapter;
  result: IntentResult;
}

/**
 * Asks every registered adapter how well it recognises the utterance and
 * returns the most confident. Adding a domain extends routing automatically.
 */
export function classifyIntentAcrossAdapters(utterance: string): AdapterMatch | null {
  let best: AdapterMatch | null = null;

  for (const adapter of adapters.values()) {
    const result = adapter.classifyIntent(utterance);
    if (result.classifiedIntent === 'unknown') continue;
    if (!best || result.confidence > best.result.confidence) {
      best = { adapter, result };
    }
  }

  return best;
}
