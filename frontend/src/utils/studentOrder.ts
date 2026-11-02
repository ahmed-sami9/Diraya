import type { GradeStudent } from '../api/students/students';

// How the grade page orders its students. Types only at run time, so it's
// tested as plain functions.

export type SortOrder = 'custom' | 'name' | 'newest' | 'code';

const nameCompare = new Intl.Collator('en', { sensitivity: 'base' }).compare;

// "My order": the teacher's order within each group, groups in their own
// order. Students not placed yet come after the placed ones, by name.
function byTeacherOrder(groupIds: string[]) {
  const groupIndex = new Map(groupIds.map((id, index) => [id, index]));

  return (a: GradeStudent, b: GradeStudent) =>
    (groupIndex.get(a.groupId) ?? Infinity) - (groupIndex.get(b.groupId) ?? Infinity) ||
    (a.position ?? Infinity) - (b.position ?? Infinity) ||
    nameCompare(a.name, b.name);
}

export function sortStudents(
  students: GradeStudent[],
  sort: SortOrder,
  groupIds: string[]
): GradeStudent[] {
  const compare =
    sort === 'custom'
      ? byTeacherOrder(groupIds)
      : sort === 'name'
        ? (a: GradeStudent, b: GradeStudent) => nameCompare(a.name, b.name)
        : sort === 'newest'
          ? (a: GradeStudent, b: GradeStudent) => b.joinedAt.localeCompare(a.joinedAt)
          : (a: GradeStudent, b: GradeStudent) => a.code.localeCompare(b.code);

  return [...students].sort(compare);
}

// One drag: `movedId` dropped where `overId` was. Returns the new id order.
export function moveId(ids: string[], movedId: string, overId: string): string[] {
  const from = ids.indexOf(movedId);
  const to = ids.indexOf(overId);
  if (from === -1 || to === -1 || from === to) return ids;

  const next = [...ids];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}

// The saved order, applied to the list: position = index in `orderedIds`.
export function withPositions(students: GradeStudent[], orderedIds: string[]): GradeStudent[] {
  const position = new Map(orderedIds.map((id, index) => [id, index]));

  return students.map((student) =>
    position.has(student.id) ? { ...student, position: position.get(student.id)! } : student
  );
}

// Consecutive students of the same group, as blocks: the list "My order" shows
// is already sorted group by group, so each group is one block.
export function groupBlocks(
  students: GradeStudent[]
): { groupId: string; students: GradeStudent[] }[] {
  const blocks: { groupId: string; students: GradeStudent[] }[] = [];

  for (const student of students) {
    const last = blocks[blocks.length - 1];
    if (last && last.groupId === student.groupId) last.students.push(student);
    else blocks.push({ groupId: student.groupId, students: [student] });
  }

  return blocks;
}

type Rect = { top: number; bottom: number };

// Keeps a dragged row inside its block: up and down only, never past the
// block's first or last row. `transform` is how far it has moved from `row`.
export function clampToBlock<T extends { x: number; y: number }>(
  transform: T,
  row: Rect,
  block: Rect
): T {
  const y = Math.min(Math.max(transform.y, block.top - row.top), block.bottom - row.bottom);
  return { ...transform, x: 0, y };
}
