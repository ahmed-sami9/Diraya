import type { MyNote } from '../api/notes/notes';

// The My notes rules: order, search and date groups. Pure functions only
// (no React), shared by useMyNotes, the notes page and the Home card.

export type NotesOrder = 'newest' | 'oldest';

/* ---------------------------------- Order --------------------------------- */

// Pinned notes always first, then by when they were written. Returns a new
// array: never reorders the list the caller holds.
export function sortNotes(notes: MyNote[], order: NotesOrder): MyNote[] {
  return [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;

    // ISO timestamps from the server sort correctly as plain strings.
    return order === 'newest'
      ? b.createdAt.localeCompare(a.createdAt)
      : a.createdAt.localeCompare(b.createdAt);
  });
}

// What the Home card shows: the same order as the page, cut to `count`.
export const topNotes = (notes: MyNote[], count: number) =>
  sortNotes(notes, 'newest').slice(0, count);

/* --------------------------------- Search --------------------------------- */

// Every word typed must appear somewhere in the note, in any order and any
// case: "adam fees" finds "Call Adam's father about the October fees".
export function searchNotes(notes: MyNote[], query: string): MyNote[] {
  const words = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return notes;

  return notes.filter((note) => {
    const text = note.text.toLocaleLowerCase();
    return words.every((word) => text.includes(word));
  });
}

/* ------------------------------- Date groups ------------------------------ */

export type NoteGroupKey = 'pinned' | 'today' | 'week' | 'earlier';

export type NoteGroup = { key: NoteGroupKey; label: string; notes: MyNote[] };

const LABELS: Record<NoteGroupKey, string> = {
  pinned: 'Pinned',
  today: 'Today',
  week: 'This week',
  earlier: 'Earlier',
};

// The calendar day a note was written, in Egypt ("YYYY-MM-DD"). 'en-CA'
// happens to format as YYYY-MM-DD.
const cairoDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Cairo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// The Saturday that starts `today`'s week: Egypt's week runs Saturday to Friday.
function weekStart(today: string): string {
  const date = new Date(`${today}T12:00:00Z`);
  const daysSinceSaturday = (date.getUTCDay() + 1) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceSaturday);
  return date.toISOString().slice(0, 10);
}

function groupOf(note: MyNote, today: string, saturday: string): NoteGroupKey {
  if (note.pinned) return 'pinned';

  const day = cairoDay.format(new Date(note.createdAt));
  if (day === today) return 'today';
  if (day >= saturday) return 'week';
  return 'earlier';
}

// Splits an already sorted list into Pinned / Today / This week / Earlier.
// Groups appear in the order their first note does, so "Oldest first" shows
// Earlier before Today, and empty groups are left out.
export function groupNotes(sorted: MyNote[], today: string): NoteGroup[] {
  const saturday = weekStart(today);
  const groups = new Map<NoteGroupKey, MyNote[]>();

  for (const note of sorted) {
    const key = groupOf(note, today, saturday);
    const list = groups.get(key);
    if (list) list.push(note);
    else groups.set(key, [note]);
  }

  return [...groups].map(([key, notes]) => ({ key, label: LABELS[key], notes }));
}
