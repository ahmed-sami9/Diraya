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
