// API tests for /api/v1/teacher/exams: the whole path a request takes
// (auth -> validation -> controller -> service -> repository -> database)
// and the exact JSON the frontend receives.
//
// Run:  npx tsx --test src/modules/exams/exams.api.test.ts
//
// No server needs to be running: the test starts the app on a free port.
// It needs the same .env as the server (DB_PASSWORD, JWT_SECRET). It creates
// its own teachers and deletes them at the end (everything they own goes
// with them).

import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { after, before, describe, it } from 'node:test';

import app from '../../app';
import { pool } from '../../config/db';
import { getFrontendOrigin } from '../../config/frontendOrigin';
import { todayInCairo } from '../../utils/cairoDate';
import { AUTH_COOKIE_NAME } from '../auth/auth.cookie';
import { startTeacherSession } from '../auth/session/auth.session.service';

const TODAY = todayInCairo();
// Tomorrow in Egypt, from today's date (safe across month ends).
const TOMORROW = new Date(Date.parse(`${TODAY}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

let server: Server;
let baseUrl = '';

type Call = (method: string, path: string, body?: unknown) => Promise<[number, any]>;

// A signed-in teacher: a real session, sent as the real cookie.
async function signedInTeacher(name: string): Promise<{ id: string; call: Call }> {
  const row = await pool.query<{ id: string }>(
    `INSERT INTO teachers (full_name, email) VALUES ($1, $2) RETURNING id::text AS id`,
    [name, `exams-api-${name}-${Date.now()}@example.com`]
  );
  const id = row.rows[0]!.id;
  const { token } = await startTeacherSession(id, false);

  const call: Call = async (method, path, body) => {
    const response = await fetch(`${baseUrl}/api/v1/teacher${path}`, {
      method,
      headers: {
        cookie: `${AUTH_COOKIE_NAME}=${token}`,
        origin: getFrontendOrigin(),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? null : JSON.stringify(body),
    });
    const text = await response.text();
    return [response.status, text ? JSON.parse(text) : null];
  };

  return { id, call };
}

let A: Call;
let B: Call;
const teacherIds: string[] = [];
let gradeId = '';
let otherGradeId = ''; // teacher A's second grade
let groupA = '';
let groupB = '';
const st: Record<string, { id: string; name: string; code: string }> = {};
let otherGradeStudent = '';

const examBody = (overrides: Record<string, unknown> = {}) => ({
  title: 'Unit 3 test',
  kind: 'exam',
  gradeId,
  heldOn: TODAY,
  maxMark: 40,
  passMark: 20,
  ...overrides,
});

before(async () => {
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const a = await signedInTeacher('a');
  const b = await signedInTeacher('b');
  A = a.call;
  B = b.call;
  teacherIds.push(a.id, b.id);

  // Through the real endpoints: grades start with "Group 1".
  const [, grade] = await A('POST', '/grades', { name: 'Grade 3', monthlyFee: 350 });
  gradeId = grade.grade.id;
  const [, detail] = await A('GET', `/grades/${gradeId}`);
  groupA = detail.groups[0].id;
  const [, group] = await A('POST', `/grades/${gradeId}/groups`, { name: 'Group B' });
  groupB = group.group.id;

  const add = async (grade: string, group: string, fullName: string) => {
    const [status, body] = await A('POST', `/grades/${grade}/students`, {
      fullName,
      parentPhone: '01012345678',
      phone: null,
      groupId: group,
      notes: null,
    });
    assert.equal(status, 201, JSON.stringify(body));
    return { id: body.student.id, name: fullName, code: body.student.code };
  };

  st.omar = await add(gradeId, groupA, 'Omar Adel');
  st.salma = await add(gradeId, groupA, 'Salma Hany');
  st.karim = await add(gradeId, groupB, 'Karim Omran');

  const [, other] = await A('POST', '/grades', { name: 'Grade 1', monthlyFee: 0 });
  otherGradeId = other.grade.id;
  const [, otherDetail] = await A('GET', `/grades/${otherGradeId}`);
  otherGradeStudent = (await add(otherGradeId, otherDetail.groups[0].id, 'Nour Grade1')).id;
});

after(async () => {
  server.close();
  await pool.query('DELETE FROM teachers WHERE id = ANY ($1::bigint[])', [teacherIds]);
  await pool.end();
});

/* ---------------------------------- Guards -------------------------------- */

describe('guards', () => {
  it('401 without a session', async () => {
    const response = await fetch(`${baseUrl}/api/v1/teacher/exams`);
    assert.equal(response.status, 401);
  });

  it('403 for a write from another origin (CSRF check)', async () => {
    const response = await fetch(`${baseUrl}/api/v1/teacher/exams`, {
      method: 'POST',
      headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
      body: JSON.stringify(examBody()),
    });
    assert.equal(response.status, 403);
  });

  it('404 EXAM_NOT_FOUND for an id that isn’t a number', async () => {
    const [status, body] = await A('GET', '/exams/abc');
    assert.deepEqual([status, body.code], [404, 'EXAM_NOT_FOUND']);
  });
});

/* ---------------------------------- Create -------------------------------- */

describe('POST /exams', () => {
  it('201 with the exam and its (empty) results, shaped like the frontend’s ExamSummary', async () => {
    const [status, body] = await A('POST', '/exams', examBody({ passMark: 20.5 }));
    assert.equal(status, 201);
    assert.deepEqual(
      { ...body.exam, id: typeof body.exam.id },
      {
        id: 'string',
        title: 'Unit 3 test',
        kind: 'exam',
        heldOn: TODAY,
        maxMark: 40,
        passMark: 20.5,
        grade: { id: gradeId, name: 'Grade 3' },
        results: { entered: 0, total: 3, averagePercent: null, failed: 0, fullMarks: 0 },
      }
    );
  });

  it('trims the title', async () => {
    const [, body] = await A('POST', '/exams', examBody({ title: '  Quiz 1  ', kind: 'quiz' }));
    assert.equal(body.exam.title, 'Quiz 1');
  });

  for (const [why, overrides] of [
    ['blank title', { title: '   ' }],
    ['unknown kind', { kind: 'final' }],
    ['impossible date', { heldOn: '2026-02-30' }],
    ['"out of" 0', { maxMark: 0 }],
    ['"out of" not whole', { maxMark: 40.5 }],
    ['pass mark above "out of"', { passMark: 41 }],
    ['pass mark not a half', { passMark: 20.3 }],
    ['pass mark 0', { passMark: 0 }],
    ['grade id not a number', { gradeId: 'x' }],
  ] as const) {
    it(`400 INVALID_INPUT: ${why}`, async () => {
      const [status, body] = await A('POST', '/exams', examBody(overrides));
      assert.deepEqual([status, body.code], [400, 'INVALID_INPUT']);
    });
  }

  it('404 GRADE_NOT_FOUND for another teacher’s grade', async () => {
    const [status, body] = await B('POST', '/exams', examBody());
    assert.deepEqual([status, body.code], [404, 'GRADE_NOT_FOUND']);
  });
});

/* ------------------------------ Read + results ---------------------------- */

describe('an exam, from empty to marked', () => {
  let examId = '';
  before(async () => {
    const [, body] = await A('POST', '/exams', examBody({ title: 'Flow exam' }));
    examId = body.exam.id;
  });

  it('GET: everyone "not entered", with the grade’s groups', async () => {
    const [status, body] = await A('GET', `/exams/${examId}`);
    assert.equal(status, 200);
    assert.deepEqual(body.groups, [
      { id: groupA, name: 'Group 1' },
      { id: groupB, name: 'Group B' },
    ]);
    assert.deepEqual(
      body.results.map((r: any) => [r.student.name, r.group.name, r.status, r.score]),
      [
        ['Karim Omran', 'Group B', 'not-entered', null],
        ['Omar Adel', 'Group 1', 'not-entered', null],
        ['Salma Hany', 'Group 1', 'not-entered', null],
      ]
    );
    assert.deepEqual(body.results[1].student, st.omar);
  });

  it('PUT: saves marks and absences, answers with the fresh page', async () => {
    const [status, body] = await A('PUT', `/exams/${examId}/results`, {
      results: [
        { studentId: st.omar!.id, status: 'scored', score: 40 },
        { studentId: st.salma!.id, status: 'absent', score: null },
        { studentId: st.karim!.id, status: 'scored', score: 14.5 },
      ],
    });
    assert.equal(status, 200);
    assert.deepEqual(
      body.results.map((r: any) => [r.student.name, r.status, r.score]),
      [
        ['Karim Omran', 'scored', 14.5],
        ['Omar Adel', 'scored', 40],
        ['Salma Hany', 'absent', null],
      ]
    );
  });

  it('PUT twice with the same marks: same answer (idempotent)', async () => {
    const same = { results: [{ studentId: st.omar!.id, status: 'scored', score: 40 }] };
    const [, first] = await A('PUT', `/exams/${examId}/results`, same);
    const [, second] = await A('PUT', `/exams/${examId}/results`, same);
    assert.deepEqual(first, second);
  });

  it('the list counts them like the page: average of those who sat it', async () => {
    const [, body] = await A('GET', '/exams');
    const exam = body.exams.find((e: any) => e.id === examId);
    // (40 + 14.5) / 2 = 27.25 of 40 = 68.1% -> 68
    assert.deepEqual(exam.results, {
      entered: 3,
      total: 3,
      averagePercent: 68,
      failed: 1,
      fullMarks: 1,
    });
  });

  it('"not-entered" clears a result', async () => {
    const [, body] = await A('PUT', `/exams/${examId}/results`, {
      results: [{ studentId: st.karim!.id, status: 'not-entered', score: null }],
    });
    const karim = body.results.find((r: any) => r.student.id === st.karim!.id);
    assert.deepEqual([karim.status, karim.score], ['not-entered', null]);
    // Put it back for the tests below.
    await A('PUT', `/exams/${examId}/results`, {
      results: [{ studentId: st.karim!.id, status: 'scored', score: 14.5 }],
    });
  });

  for (const [why, results] of [
    ['absent with a score', [{ studentId: '1', status: 'absent', score: 30 }]],
    ['scored without a score', [{ studentId: '1', status: 'scored', score: null }]],
    ['a quarter mark', [{ studentId: '1', status: 'scored', score: 30.25 }]],
    ['a negative mark', [{ studentId: '1', status: 'scored', score: -1 }]],
    ['an unknown status', [{ studentId: '1', status: 'late', score: null }]],
    ['nothing to save', []],
    [
      'the same student twice',
      [
        { studentId: '1', status: 'absent', score: null },
        { studentId: '1', status: 'absent', score: null },
      ],
    ],
  ] as const) {
    it(`PUT 400 INVALID_INPUT: ${why}`, async () => {
      const [status, body] = await A('PUT', `/exams/${examId}/results`, { results });
      assert.deepEqual([status, body.code], [400, 'INVALID_INPUT']);
    });
  }

  it('PUT 400 SCORE_ABOVE_MAX_MARK, with the limit in the message', async () => {
    const [status, body] = await A('PUT', `/exams/${examId}/results`, {
      results: [{ studentId: st.omar!.id, status: 'scored', score: 45 }],
    });
    assert.deepEqual(
      [status, body.code, body.message],
      [400, 'SCORE_ABOVE_MAX_MARK', 'The highest mark is 40.']
    );
  });

  it('PUT 400 STUDENT_NOT_FOUND for another grade’s student, and nothing is saved', async () => {
    const [, before] = await A('GET', `/exams/${examId}`);
    const [status, body] = await A('PUT', `/exams/${examId}/results`, {
      results: [
        { studentId: st.omar!.id, status: 'scored', score: 1 },
        { studentId: otherGradeStudent, status: 'scored', score: 30 },
      ],
    });
    assert.deepEqual([status, body.code], [400, 'STUDENT_NOT_FOUND']);
    const [, afterwards] = await A('GET', `/exams/${examId}`);
    assert.deepEqual(afterwards, before, 'Omar kept his 40');
  });

  it('another teacher: 404 for GET, PUT, PATCH and DELETE', async () => {
    const results = { results: [{ studentId: st.omar!.id, status: 'absent', score: null }] };
    const statuses = [
      (await B('GET', `/exams/${examId}`))[0],
      (await B('PUT', `/exams/${examId}/results`, results))[0],
      (await B('PATCH', `/exams/${examId}`, { ...examBody(), gradeId: undefined }))[0],
      (await B('DELETE', `/exams/${examId}`))[0],
    ];
    assert.deepEqual(statuses, [404, 404, 404, 404]);
    assert.equal((await A('GET', `/exams/${examId}`))[0], 200, 'still there');
  });
});

describe('PUT on a future exam', () => {
  it('400 DATE_IN_FUTURE', async () => {
    const [, created] = await A('POST', '/exams', examBody({ title: 'Future', heldOn: TOMORROW }));
    const [status, body] = await A('PUT', `/exams/${created.exam.id}/results`, {
      results: [{ studentId: st.omar!.id, status: 'scored', score: 30 }],
    });
    assert.deepEqual([status, body.code], [400, 'DATE_IN_FUTURE']);
  });
});

/* ----------------------------------- Edit --------------------------------- */

describe('PATCH /exams/:examId', () => {
  let examId = '';
  const edit = (overrides: Record<string, unknown> = {}) => ({
    title: 'Edited',
    kind: 'quiz',
    heldOn: TODAY,
    maxMark: 40,
    passMark: 20,
    ...overrides,
  });

  before(async () => {
    const [, body] = await A('POST', '/exams', examBody({ title: 'To edit' }));
    examId = body.exam.id;
    await A('PUT', `/exams/${examId}/results`, {
      results: [
        { studentId: st.omar!.id, status: 'scored', score: 35 },
        { studentId: st.karim!.id, status: 'scored', score: 25 },
      ],
    });
  });

  it('200 with the fresh page; a higher pass mark changes who failed', async () => {
    const [status, body] = await A('PATCH', `/exams/${examId}`, edit({ passMark: 30 }));
    assert.equal(status, 200);
    assert.deepEqual([body.exam.title, body.exam.kind, body.exam.passMark], ['Edited', 'quiz', 30]);
    const [, list] = await A('GET', '/exams');
    assert.equal(
      list.exams.find((e: any) => e.id === examId).results.failed,
      1,
      'Karim (25) now fails'
    );
  });

  it('400 when the body has a gradeId (the grade can’t change)', async () => {
    const [status, body] = await A('PATCH', `/exams/${examId}`, {
      ...edit(),
      gradeId: otherGradeId,
    });
    assert.deepEqual([status, body.code], [400, 'INVALID_INPUT']);
  });

  it('409 SCORES_ABOVE_MAX_MARK when "out of" goes below a saved mark; nothing changes', async () => {
    const [status, body] = await A(
      'PATCH',
      `/exams/${examId}`,
      edit({ maxMark: 30, passMark: 15 })
    );
    assert.deepEqual([status, body.code], [409, 'SCORES_ABOVE_MAX_MARK']);
    const [, page] = await A('GET', `/exams/${examId}`);
    assert.equal(page.exam.maxMark, 40);
  });

  it('400 DATE_IN_FUTURE when an exam with marks moves to a future day', async () => {
    const [status, body] = await A('PATCH', `/exams/${examId}`, edit({ heldOn: TOMORROW }));
    assert.deepEqual([status, body.code], [400, 'DATE_IN_FUTURE']);
  });

  it('raising "out of" is fine', async () => {
    const [status, body] = await A(
      'PATCH',
      `/exams/${examId}`,
      edit({ maxMark: 50, passMark: 25 })
    );
    assert.deepEqual([status, body.exam.maxMark], [200, 50]);
  });
});

/* ---------------------------------- Delete -------------------------------- */

describe('DELETE /exams/:examId', () => {
  it('204, then the exam is gone (404)', async () => {
    const [, created] = await A('POST', '/exams', examBody({ title: 'To delete' }));
    const id = created.exam.id;
    await A('PUT', `/exams/${id}/results`, {
      results: [{ studentId: st.omar!.id, status: 'absent', score: null }],
    });

    const [status, body] = await A('DELETE', `/exams/${id}`);
    assert.deepEqual([status, body], [204, null]);
    assert.equal((await A('GET', `/exams/${id}`))[0], 404);
    assert.equal((await A('DELETE', `/exams/${id}`))[0], 404, 'deleting twice: 404');
  });
});

/* ----------------------------------- List --------------------------------- */

describe('GET /exams', () => {
  it('only the teacher’s own exams, newest first', async () => {
    const [, mine] = await A('GET', '/exams');
    const [, theirs] = await B('GET', '/exams');
    assert.ok(mine.exams.length > 0);
    assert.deepEqual(theirs.exams, []);
    const days = mine.exams.map((e: any) => e.heldOn);
    assert.deepEqual(days, [...days].sort().reverse());
  });
});
