// Run with: npm test

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ExamSummary } from '../../../api/exams/exams';
import { examsMissingMarks, papersToMark } from './examHelpers.ts';

const TODAY = '2026-10-27';

const exam = (id: string, heldOn: string, entered: number, total: number): ExamSummary => ({
  id,
  title: `Exam ${id}`,
  kind: 'exam',
  heldOn,
  maxMark: 20,
  passMark: 10,
  grade: { id: '1', name: 'Grade 1' },
  results: { entered, total, averagePercent: null, failed: 0, fullMarks: 0 },
});

describe('examsMissingMarks', () => {
  it('a past exam with students not entered is missing marks', () => {
    const missing = examsMissingMarks([exam('1', '2026-10-26', 3, 10)], TODAY);

    assert.deepEqual(missing.map((item) => item.id), ['1']);
  });

  it('an exam held today is not counted yet: it may not have happened', () => {
    assert.deepEqual(examsMissingMarks([exam('1', TODAY, 0, 10)], TODAY), []);
  });

  it('upcoming exams are not counted', () => {
    assert.deepEqual(examsMissingMarks([exam('1', '2026-11-02', 0, 10)], TODAY), []);
  });

  it('a fully entered exam is not missing anything (absent counts as entered)', () => {
    assert.deepEqual(examsMissingMarks([exam('1', '2026-10-20', 10, 10)], TODAY), []);
  });

  it('lists the newest first, whatever order they came in', () => {
    const missing = examsMissingMarks(
      [exam('old', '2026-09-01', 0, 5), exam('new', '2026-10-25', 0, 5), exam('mid', '2026-10-01', 2, 5)],
      TODAY
    );

    assert.deepEqual(missing.map((item) => item.id), ['new', 'mid', 'old']);
  });
});

describe('papersToMark', () => {
  it('adds up the students still waiting across exams', () => {
    assert.equal(papersToMark([exam('1', '2026-10-25', 0, 10), exam('2', '2026-10-01', 7, 9)]), 12);
  });

  it('nothing missing: 0', () => {
    assert.equal(papersToMark([]), 0);
  });
});
