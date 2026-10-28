// My notes at the database level: the order, the Home limit and its total,
// what counts as an edit, ownership, and the database's own rules.
// Real database (diraya_test_db).

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { pool } from '../../config/db';
import { assertTestDatabase } from '../../test/assertTestDatabase';

import {
  deleteTeacherNote,
  findTeacherNotes,
  insertTeacherNote,
  updateTeacherNote,
} from './notes.repository';

const teacherIds: string[] = [];

async function newTeacher(name: string): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO teachers (full_name, email) VALUES ($1, $2) RETURNING id::text AS id`,
    [name, `notes-repo-${name}-${Date.now()}@example.com`]
  );
  const id = result.rows[0]!.id;
  teacherIds.push(id);
  return id;
}

// A note written `daysAgo` days ago (to test the date order without waiting).
async function noteFrom(teacherId: string, text: string, daysAgo: number, pinned = false) {
  const result = await pool.query<{ id: string }>(
    `
      INSERT INTO teacher_notes (teacher_id, text, pinned, created_at, updated_at)
      VALUES ($1, $2, $3, NOW() - make_interval(days => $4), NOW() - make_interval(days => $4))
      RETURNING id::text AS id
    `,
    [teacherId, text, pinned, daysAgo]
  );
  return result.rows[0]!.id;
}

const texts = (notes: { text: string }[]) => notes.map((note) => note.text);

before(assertTestDatabase);

after(async () => {
  await pool.query('DELETE FROM teachers WHERE id = ANY ($1::bigint[])', [teacherIds]);
  await pool.end();
});

describe('insertTeacherNote', () => {
  it('saves the text, unpinned, with created_at = updated_at (never edited)', async () => {
    const teacher = await newTeacher('Writer');

    const note = await insertTeacherNote(teacher, 'Print the Unit 3 test');

    assert.equal(note.text, 'Print the Unit 3 test');
    assert.equal(note.pinned, false);
    assert.equal(note.created_at.getTime(), note.updated_at.getTime());
  });

  it('the database refuses a blank note and one over 1000 characters', async () => {
    const teacher = await newTeacher('Strict');

    await assert.rejects(insertTeacherNote(teacher, '   '), /teacher_notes_text_not_blank/);
    await assert.rejects(insertTeacherNote(teacher, 'x'.repeat(1001)), /too long/);
    // Exactly 1000 is fine.
    await insertTeacherNote(teacher, 'x'.repeat(1000));
  });
});

describe('findTeacherNotes', () => {
  it('pinned first, then newest; never another teacher’s notes', async () => {
    const teacher = await newTeacher('Lister');
    const other = await newTeacher('Neighbour');
    await noteFrom(teacher, 'old', 30);
    await noteFrom(teacher, 'pinned long ago', 60, true);
    await noteFrom(teacher, 'new', 1);
    await noteFrom(other, 'someone else’s', 0, true);

    const { notes, total } = await findTeacherNotes(teacher, null);

    assert.deepEqual(texts(notes), ['pinned long ago', 'new', 'old']);
    assert.equal(total, 3);
  });

  it('limit cuts the list but total still counts every note (Home: "View all (5)")', async () => {
    const teacher = await newTeacher('Limited');
    for (let day = 1; day <= 5; day++) await noteFrom(teacher, `day ${day}`, day);

    const { notes, total } = await findTeacherNotes(teacher, 2);

    assert.deepEqual(texts(notes), ['day 1', 'day 2']);
    assert.equal(total, 5);
  });

  it('no notes: an empty list and 0, not an error', async () => {
    const teacher = await newTeacher('Blank');

    assert.deepEqual(await findTeacherNotes(teacher, 5), { notes: [], total: 0 });
  });
});

describe('updateTeacherNote', () => {
  it('editing the text moves updated_at, never created_at', async () => {
    const teacher = await newTeacher('Editor');
    const id = await noteFrom(teacher, 'Call Adam', 3);
    const [before] = (await findTeacherNotes(teacher, null)).notes;

    const note = await updateTeacherNote(teacher, id, { text: "Call Adam's father" });

    assert.equal(note?.text, "Call Adam's father");
    assert.equal(note?.created_at.getTime(), before!.created_at.getTime());
    assert.ok(note!.updated_at > before!.updated_at);
  });

  it('pinning is not an edit, and neither is saving the same text', async () => {
    const teacher = await newTeacher('Pinner');
    const id = await noteFrom(teacher, 'Projector', 3);
    const [before] = (await findTeacherNotes(teacher, null)).notes;

    const pinned = await updateTeacherNote(teacher, id, { pinned: true });
    const same = await updateTeacherNote(teacher, id, { text: 'Projector' });

    assert.equal(pinned?.pinned, true);
    assert.equal(pinned?.updated_at.getTime(), before!.updated_at.getTime());
    assert.equal(same?.updated_at.getTime(), before!.updated_at.getTime());
  });

  it('a field left out keeps its value', async () => {
    const teacher = await newTeacher('Partial');
    const id = await noteFrom(teacher, 'Keep me', 1, true);

    const note = await updateTeacherNote(teacher, id, { text: 'Kept and edited' });

    assert.equal(note?.pinned, true);
  });

  it('another teacher’s note: null, and the note is untouched', async () => {
    const owner = await newTeacher('Owner');
    const intruder = await newTeacher('Intruder');
    const id = await noteFrom(owner, 'Mine', 1);

    assert.equal(await updateTeacherNote(intruder, id, { text: 'Yours now', pinned: true }), null);

    const [note] = (await findTeacherNotes(owner, null)).notes;
    assert.equal(note?.text, 'Mine');
    assert.equal(note?.pinned, false);
  });

  it('the database still refuses blank text on edit', async () => {
    const teacher = await newTeacher('BlankEdit');
    const id = await noteFrom(teacher, 'Something', 1);

    await assert.rejects(updateTeacherNote(teacher, id, { text: '  ' }), /not_blank/);
  });
});

describe('deleteTeacherNote', () => {
  it('deletes the teacher’s own note', async () => {
    const teacher = await newTeacher('Deleter');
    const id = await noteFrom(teacher, 'Bye', 1);

    assert.equal(await deleteTeacherNote(teacher, id), true);
    assert.equal((await findTeacherNotes(teacher, null)).total, 0);
  });

  it('another teacher’s note: false, and it stays', async () => {
    const owner = await newTeacher('Keeper');
    const intruder = await newTeacher('Remover');
    const id = await noteFrom(owner, 'Stay', 1);

    assert.equal(await deleteTeacherNote(intruder, id), false);
    assert.equal((await findTeacherNotes(owner, null)).total, 1);
  });

  it('deleting a teacher deletes their notes too', async () => {
    const teacher = await newTeacher('Leaving');
    await noteFrom(teacher, 'One', 1);

    await pool.query('DELETE FROM teachers WHERE id = $1', [teacher]);

    const left = await pool.query<{ n: number }>(
      'SELECT COUNT(*)::int AS n FROM teacher_notes WHERE teacher_id = $1',
      [teacher]
    );
    assert.equal(left.rows[0]?.n, 0);
  });
});
