// My notes through HTTP: /teacher/notes (list, Home limit, add, edit, pin,
// delete), what the API refuses, ownership, and the demo's notes.
// Real database (diraya_test_db), real app.

import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { after, before, describe, it } from 'node:test';

import app from '../../app';
import { pool } from '../../config/db';
import { getFrontendOrigin } from '../../config/frontendOrigin';
import { assertTestDatabase } from '../../test/assertTestDatabase';
import { AUTH_COOKIE_NAME } from '../auth/auth.cookie';
import { startTeacherSession } from '../auth/session/auth.session.service';
import { seedDemoData } from '../demo/demo.seed';

let server: Server;
let baseUrl = '';
const teacherIds: string[] = [];

type Call = (method: string, path: string, body?: unknown) => Promise<[number, any]>;

async function request(token: string | null, method: string, path: string, body?: unknown) {
  const response = await fetch(`${baseUrl}/api/v1/teacher${path}`, {
    method,
    headers: {
      origin: getFrontendOrigin(),
      ...(token ? { cookie: `${AUTH_COOKIE_NAME}=${token}` } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? null : JSON.stringify(body),
  });
  const text = await response.text();
  return [response.status, text ? JSON.parse(text) : null] as [number, any];
}

async function newTeacher(name: string): Promise<{ id: string; call: Call }> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO teachers (full_name, email) VALUES ($1, $2) RETURNING id::text AS id`,
    [name, `notes-api-${name}-${Date.now()}@example.com`]
  );
  const id = result.rows[0]!.id;
  teacherIds.push(id);

  const { token } = await startTeacherSession(id, false);
  return { id, call: (method, path, body) => request(token, method, path, body) };
}

// A note written `daysAgo` days ago, straight into the table.
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

before(async () => {
  await assertTestDatabase();
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  server.close();
  await pool.query('DELETE FROM teachers WHERE id = ANY ($1::bigint[])', [teacherIds]);
  await pool.end();
});

describe('no session', () => {
  it('every notes route answers 401', async () => {
    for (const [method, path] of [
      ['GET', '/notes'],
      ['POST', '/notes'],
      ['PATCH', '/notes/1'],
      ['DELETE', '/notes/1'],
    ] as const) {
      const body = method === 'GET' ? undefined : { text: 'x' };
      assert.equal((await request(null, method, path, body))[0], 401, `${method} ${path}`);
    }
  });
});

describe('GET /teacher/notes', () => {
  it('a new teacher: no notes and total 0', async () => {
    const t = await newTeacher('Empty');

    assert.deepEqual(await t.call('GET', '/notes'), [200, { notes: [], total: 0 }]);
  });

  it('pinned first, then newest, with every field the page needs', async () => {
    const t = await newTeacher('Lister');
    await noteFrom(t.id, 'old', 20);
    await noteFrom(t.id, 'pinned', 40, true);
    await noteFrom(t.id, 'new', 1);

    const [status, body] = await t.call('GET', '/notes');

    assert.equal(status, 200);
    assert.deepEqual(texts(body.notes), ['pinned', 'new', 'old']);
    assert.equal(body.total, 3);
    assert.deepEqual(Object.keys(body.notes[0]).sort(), [
      'createdAt',
      'id',
      'pinned',
      'text',
      'updatedAt',
    ]);
  });

  it('?limit=2 (the Home card): two notes, but total counts them all', async () => {
    const t = await newTeacher('Home');
    for (let day = 1; day <= 4; day++) await noteFrom(t.id, `day ${day}`, day);

    const [status, body] = await t.call('GET', '/notes?limit=2');

    assert.equal(status, 200);
    assert.deepEqual(texts(body.notes), ['day 1', 'day 2']);
    assert.equal(body.total, 4);
  });

  it('a bad limit is a 400', async () => {
    const t = await newTeacher('BadLimit');

    for (const limit of ['0', '-1', 'abc', '1.5', '51', '']) {
      const [status, body] = await t.call('GET', `/notes?limit=${limit}`);
      assert.equal(status, 400, `limit=${limit}`);
      assert.equal(body.code, 'INVALID_INPUT');
    }
  });

  it('never shows another teacher’s notes', async () => {
    const t = await newTeacher('Private');
    const other = await newTeacher('Other');
    await noteFrom(other.id, 'not yours', 1);

    assert.equal((await t.call('GET', '/notes'))[1].total, 0);
  });
});

describe('POST /teacher/notes', () => {
  it('201 with the saved note: trimmed, unpinned, never edited', async () => {
    const t = await newTeacher('Adder');

    const [status, body] = await t.call('POST', '/notes', { text: '  Print the Unit 3 test  ' });

    assert.equal(status, 201);
    assert.equal(body.note.text, 'Print the Unit 3 test');
    assert.equal(body.note.pinned, false);
    assert.match(body.note.id, /^\d+$/);
    assert.equal(body.note.createdAt, body.note.updatedAt);
    assert.equal((await t.call('GET', '/notes'))[1].total, 1);
  });

  it('exactly 1000 characters is fine', async () => {
    const t = await newTeacher('Long');

    assert.equal((await t.call('POST', '/notes', { text: 'x'.repeat(1000) }))[0], 201);
  });

  it('400 for a missing, blank, too long, non-text note or unknown fields, and nothing is saved', async () => {
    const t = await newTeacher('Refused');

    for (const body of [
      {},
      { text: '' },
      { text: '    ' },
      { text: 'x'.repeat(1001) },
      { text: 42 },
      { text: 'ok', pinned: true }, // pin after creating, with PATCH
    ]) {
      const [status, answer] = await t.call('POST', '/notes', body);
      assert.equal(status, 400, JSON.stringify(body).slice(0, 40));
      assert.equal(answer.code, 'INVALID_INPUT');
    }

    assert.equal((await t.call('GET', '/notes'))[1].total, 0);
  });
});

describe('PATCH /teacher/notes/:noteId', () => {
  it('pinning: pinned, and not counted as an edit (updatedAt stays)', async () => {
    const t = await newTeacher('Pinner');
    const id = await noteFrom(t.id, 'Projector', 3);
    const before = (await t.call('GET', '/notes'))[1].notes[0];

    const [status, body] = await t.call('PATCH', `/notes/${id}`, { pinned: true });

    assert.equal(status, 200);
    assert.equal(body.note.pinned, true);
    assert.equal(body.note.updatedAt, before.updatedAt);
  });

  it('editing the text: new text and updatedAt, same createdAt', async () => {
    const t = await newTeacher('Editor');
    const id = await noteFrom(t.id, 'Call Adam', 3);
    const before = (await t.call('GET', '/notes'))[1].notes[0];

    const [, body] = await t.call('PATCH', `/notes/${id}`, { text: " Call Adam's father " });

    assert.equal(body.note.text, "Call Adam's father");
    assert.equal(body.note.createdAt, before.createdAt);
    assert.ok(body.note.updatedAt > before.updatedAt);
  });

  it('400 for an empty change, a blank text, a non-boolean pin or unknown fields', async () => {
    const t = await newTeacher('BadPatch');
    const id = await noteFrom(t.id, 'Stays', 1);

    for (const body of [{}, { text: '  ' }, { pinned: 'yes' }, { text: 'ok', colour: 'red' }]) {
      assert.equal((await t.call('PATCH', `/notes/${id}`, body))[0], 400, JSON.stringify(body));
    }

    assert.equal((await t.call('GET', '/notes'))[1].notes[0].text, 'Stays');
  });

  it('404 for another teacher’s note (untouched) and for an id that isn’t a number', async () => {
    const owner = await newTeacher('Owner');
    const intruder = await newTeacher('Intruder');
    const id = await noteFrom(owner.id, 'Mine', 1);

    const [status, body] = await intruder.call('PATCH', `/notes/${id}`, { pinned: true });
    assert.equal(status, 404);
    assert.equal(body.code, 'NOTE_NOT_FOUND');
    assert.equal((await owner.call('GET', '/notes'))[1].notes[0].pinned, false);

    assert.equal((await owner.call('PATCH', '/notes/abc', { pinned: true }))[0], 404);
  });
});

describe('DELETE /teacher/notes/:noteId', () => {
  it('204, then it’s gone: a second delete is 404', async () => {
    const t = await newTeacher('Deleter');
    const id = await noteFrom(t.id, 'Bye', 1);

    assert.deepEqual(await t.call('DELETE', `/notes/${id}`), [204, null]);
    assert.equal((await t.call('GET', '/notes'))[1].total, 0);
    assert.equal((await t.call('DELETE', `/notes/${id}`))[0], 404);
  });

  it('404 for another teacher’s note, which stays', async () => {
    const owner = await newTeacher('Keeper');
    const intruder = await newTeacher('Remover');
    const id = await noteFrom(owner.id, 'Stay', 1);

    assert.equal((await intruder.call('DELETE', `/notes/${id}`))[0], 404);
    assert.equal((await owner.call('GET', '/notes'))[1].total, 1);
  });
});

describe('the demo', () => {
  it('a new demo teacher has My notes to show: pinned ones first', async () => {
    const t = await newTeacher('Demo');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await seedDemoData(client, t.id);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    const [, body] = await t.call('GET', '/notes?limit=5');

    assert.equal(body.total, 6);
    assert.equal(body.notes.length, 5);
    assert.deepEqual(
      body.notes.slice(0, 2).map((note: { pinned: boolean }) => note.pinned),
      [true, true]
    );
  });
});
