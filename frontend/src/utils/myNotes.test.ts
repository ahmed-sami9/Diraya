// Run with: npm test

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { MyNote } from '../api/notes/notes';
import { groupNotes, noteWhen, searchNotes, sortNotes, topNotes } from './myNotes.ts';

// Wednesday 28 Oct 2026 in Egypt. Its week started on Saturday 24 Oct.
const TODAY = '2026-10-28';

// `at` is Egypt's local time: UTC+3 until summer time ends on 29 Oct 2026.
const note = (id: string, at: string, pinned = false, text = `Note ${id}`): MyNote => ({
  id,
  text,
  pinned,
  createdAt: new Date(`${at}+03:00`).toISOString(),
  updatedAt: new Date(`${at}+03:00`).toISOString(),
});

const ids = (notes: MyNote[]) => notes.map((item) => item.id);

describe('sortNotes', () => {
  const notes = [
    note('old', '2026-09-01T10:00'),
    note('pinned-old', '2026-08-01T10:00', true),
    note('new', '2026-10-27T10:00'),
  ];

  it('newest first, with pinned notes always on top', () => {
    assert.deepEqual(ids(sortNotes(notes, 'newest')), ['pinned-old', 'new', 'old']);
  });

  it('oldest first, still with pinned notes on top', () => {
    assert.deepEqual(ids(sortNotes(notes, 'oldest')), ['pinned-old', 'old', 'new']);
  });

  it('does not reorder the list it was given', () => {
    sortNotes(notes, 'newest');
    assert.deepEqual(ids(notes), ['old', 'pinned-old', 'new']);
  });
});

describe('topNotes', () => {
  it('pinned first, then newest, cut to the count (the Home card)', () => {
    const notes = [
      note('a', '2026-10-20T10:00'),
      note('b', '2026-10-26T10:00'),
      note('pin', '2026-09-01T10:00', true),
      note('c', '2026-10-27T10:00'),
    ];

    assert.deepEqual(ids(topNotes(notes, 3)), ['pin', 'c', 'b']);
  });
});

describe('searchNotes', () => {
  const notes = [
    note('1', '2026-10-27T10:00', false, "Call Adam's father about the October fees"),
    note('2', '2026-10-26T10:00', false, 'Adam and Ali swap groups'),
    note('3', '2026-10-25T10:00', false, 'Print the Unit 3 test'),
  ];

  it('ignores case', () => {
    assert.deepEqual(ids(searchNotes(notes, 'ADAM')), ['1', '2']);
  });

  it('every word must appear, in any order', () => {
    assert.deepEqual(ids(searchNotes(notes, 'fees adam')), ['1']);
  });

  it('an empty or blank search keeps every note', () => {
    assert.equal(searchNotes(notes, '   ').length, 3);
  });

  it('works for Arabic text too', () => {
    const arabic = [note('ar', '2026-10-27T10:00', false, 'اتصل بوالد آدم بخصوص المصاريف')];
    assert.deepEqual(ids(searchNotes(arabic, 'آدم')), ['ar']);
  });
});

describe('groupNotes', () => {
  it('splits into Pinned, Today, This week and Earlier, skipping empty groups', () => {
    const sorted = sortNotes(
      [
        note('today', '2026-10-28T09:00'),
        note('saturday', '2026-10-24T18:00'),
        note('friday', '2026-10-23T18:00'),
        note('pin', '2026-09-01T10:00', true),
      ],
      'newest'
    );

    const groups = groupNotes(sorted, TODAY);

    assert.deepEqual(
      groups.map((group) => [group.key, ids(group.notes)]),
      [
        ['pinned', ['pin']],
        ['today', ['today']],
        ['week', ['saturday']], // Egypt's week starts on Saturday
        ['earlier', ['friday']],
      ]
    );
  });

  it('uses Egypt’s day: 00:30 in Cairo is today, though UTC still says yesterday', () => {
    const groups = groupNotes([note('late', '2026-10-28T00:30')], TODAY);

    assert.equal(groups[0]?.key, 'today');
  });

  it('oldest first puts Earlier before Today', () => {
    const sorted = sortNotes(
      [note('today', '2026-10-28T09:00'), note('old', '2026-09-01T10:00')],
      'oldest'
    );

    assert.deepEqual(
      groupNotes(sorted, TODAY).map((group) => group.key),
      ['earlier', 'today']
    );
  });
});

describe('noteWhen', () => {
  // 17:00 on Wednesday 28 Oct 2026 in Egypt.
  const NOW = new Date('2026-10-28T17:00+03:00');

  it('today: just the time', () => {
    assert.equal(noteWhen(note('1', '2026-10-28T10:42'), NOW), '10:42 am');
  });

  it('earlier this year: the day and date', () => {
    assert.equal(noteWhen(note('1', '2026-10-26T09:00'), NOW), 'Mon 26 Oct');
  });

  it('a previous year: with the year', () => {
    assert.equal(noteWhen(note('1', '2025-09-12T09:00'), NOW), '12 Sept 2025'); // en-GB, like the rest of the app
  });

  it('says when the text was edited', () => {
    const edited = { ...note('1', '2026-09-12T09:00'), updatedAt: new Date('2026-10-03T12:00+03:00').toISOString() };
    assert.equal(noteWhen(edited, NOW), 'Sat 12 Sept · edited 3 Oct');
  });
});
