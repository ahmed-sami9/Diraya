// Run with: npm test

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { GradeStudent } from '../api/students/students';

import { clampToBlock, groupBlocks, moveId, sortStudents, withPositions } from './studentOrder.ts';

const student = (
  name: string,
  groupId: string,
  position: number | null,
  extra: Partial<GradeStudent> = {}
): GradeStudent => ({
  id: name,
  code: '26-0001',
  name,
  groupId,
  joinedAt: '2026-09-01T10:00:00.000Z',
  attendanceRate: null,
  averageMark: null,
  paymentStatus: null,
  position,
  ...extra,
});

const names = (list: GradeStudent[]) => list.map((s) => s.name);

describe('sortStudents: My order', () => {
  it('placed students by position, then the unplaced by name', () => {
    const list = [
      student('Zeina', 'g1', null),
      student('Mona', 'g1', 1),
      student('adam', 'g1', null),
      student('Sara', 'g1', 0),
    ];

    assert.deepEqual(names(sortStudents(list, 'custom', ['g1'])), [
      'Sara',
      'Mona',
      'adam',
      'Zeina',
    ]);
  });

  it('All students: group by group, in the groups’ own order', () => {
    const list = [student('A1', 'g1', 0), student('B1', 'g2', 0), student('B0', 'g2', null)];

    assert.deepEqual(names(sortStudents(list, 'custom', ['g2', 'g1'])), ['B1', 'B0', 'A1']);
  });
});

describe('sortStudents: the quick views ignore the order', () => {
  const list = [
    student('Mona', 'g1', 0, { code: '26-0002', joinedAt: '2026-10-01T10:00:00.000Z' }),
    student('adam', 'g1', 1, { code: '26-0003', joinedAt: '2026-08-01T10:00:00.000Z' }),
    student('Sara', 'g1', 2, { code: '26-0001', joinedAt: '2026-09-01T10:00:00.000Z' }),
  ];

  it('by name, ignoring capitals', () => {
    assert.deepEqual(names(sortStudents(list, 'name', ['g1'])), ['adam', 'Mona', 'Sara']);
  });

  it('newest first', () => {
    assert.deepEqual(names(sortStudents(list, 'newest', ['g1'])), ['Mona', 'Sara', 'adam']);
  });

  it('by code', () => {
    assert.deepEqual(names(sortStudents(list, 'code', ['g1'])), ['Sara', 'Mona', 'adam']);
  });
});

describe('moveId', () => {
  it('down and up', () => {
    assert.deepEqual(moveId(['a', 'b', 'c', 'd'], 'a', 'c'), ['b', 'c', 'a', 'd']);
    assert.deepEqual(moveId(['a', 'b', 'c', 'd'], 'd', 'b'), ['a', 'd', 'b', 'c']);
  });

  it('dropped on itself or outside: unchanged', () => {
    const ids = ['a', 'b'];
    assert.equal(moveId(ids, 'a', 'a'), ids);
    assert.equal(moveId(ids, 'a', 'zzz'), ids);
  });
});

describe('withPositions', () => {
  it('gives the moved group 0, 1, 2… and leaves other groups alone', () => {
    const list = [
      student('Mona', 'g1', null),
      student('Sara', 'g1', null),
      student('Omar', 'g2', 5),
    ];

    assert.deepEqual(
      withPositions(list, ['Sara', 'Mona']).map((s) => [s.name, s.position]),
      [
        ['Mona', 1],
        ['Sara', 0],
        ['Omar', 5],
      ]
    );
  });
});

describe('groupBlocks', () => {
  it('one block per group, in list order', () => {
    const list = [student('A', 'g2', 0), student('B', 'g2', 1), student('C', 'g1', 0)];

    assert.deepEqual(
      groupBlocks(list).map((block) => [block.groupId, names(block.students)]),
      [
        ['g2', ['A', 'B']],
        ['g1', ['C']],
      ]
    );
  });
});

describe('clampToBlock: a dragged row can’t leave its group', () => {
  const block = { top: 100, bottom: 400 };
  const row = { top: 200, bottom: 260 };

  it('moves freely inside the block, sideways never', () => {
    assert.deepEqual(clampToBlock({ x: 30, y: 50, scaleX: 1, scaleY: 1 }, row, block), {
      x: 0,
      y: 50,
      scaleX: 1,
      scaleY: 1,
    });
  });

  it('stops at the first and last row', () => {
    assert.equal(clampToBlock({ x: 0, y: -500 }, row, block).y, -100);
    assert.equal(clampToBlock({ x: 0, y: 500 }, row, block).y, 140);
  });
});
