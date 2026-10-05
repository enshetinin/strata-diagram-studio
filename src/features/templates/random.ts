/** Seeded PRNG (mulberry32). The only randomness source allowed in the app. */
export interface Rng {
  next(): number;
  int(min: number, max: number): number;
  chance(probability: number): boolean;
  pick<T>(items: readonly T[]): T;
  /** Returns `count` distinct items, order defined by the seed. */
  sample<T>(items: readonly T[], count: number): T[];
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0 || 0x9e3779b9;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng: Rng = {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (probability) => next() < probability,
    pick: (items) => {
      const item = items[Math.floor(next() * items.length)];
      if (item === undefined) throw new Error('pick() on empty list');
      return item;
    },
    sample: (items, count) => {
      const pool = [...items];
      const result: (typeof items)[number][] = [];
      while (result.length < count && pool.length > 0) {
        const [item] = pool.splice(Math.floor(next() * pool.length), 1);
        if (item !== undefined) result.push(item);
      }
      return result;
    },
  };
  return rng;
}

/** Normalizes any user-entered seed to an unsigned 32-bit integer. */
export function normalizeSeed(value: number | string): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.abs(Math.trunc(value)) >>> 0;
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
