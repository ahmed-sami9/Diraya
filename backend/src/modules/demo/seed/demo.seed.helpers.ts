import { todayInCairo } from '../../../utils/cairoDate';

// Small tools for writing demo data that looks real.

// A date `days` days in the past. Use it for created/submitted/paid dates so
// the sample data is spread over time and charts have a shape instead of one
// spike on "today".
//
//   daysAgo(0)  -> now
//   daysAgo(7)  -> a week ago
export function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// Returns the item at `index`, wrapping around when the list is shorter.
// Handy for handing out values in a repeating, predictable pattern, so every
// visitor's demo looks the same.
//
//   const levels = ['Beginner', 'Intermediate', 'Advanced'];
//   pick(levels, 4) -> 'Intermediate'
export function pick<T>(items: readonly T[], index: number): T {
  const item = items[index % items.length];

  if (item === undefined) {
    throw new Error('pick() was called with an empty list.');
  }

  return item;
}

// A calendar day in Egypt, `days` days before today, as "YYYY-MM-DD".
// Counted on the calendar (not in 24-hour steps), so daylight saving can't
// skip or repeat a day.
//
//   cairoDaysAgo(0) -> today in Egypt
export function cairoDaysAgo(days: number, today: string = todayInCairo()): string {
  const noon = new Date(`${today}T12:00:00Z`);

  noon.setUTCDate(noon.getUTCDate() - days);

  return noon.toISOString().slice(0, 10);
}

// 0 = Sunday ... 6 = Saturday, for a "YYYY-MM-DD" day.
export const weekdayOf = (isoDay: string): number => new Date(`${isoDay}T12:00:00Z`).getUTCDay();

// A random-looking but repeatable number generator (mulberry32). The same
// seed gives the same sequence, so every visitor's demo looks the same and a
// bug can be reproduced. Returns numbers in [0, 1), like Math.random().
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
