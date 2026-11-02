import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type Modifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useRef } from 'react';
import { Link } from 'react-router-dom';

import type { GradeStudent, PaymentStatus } from '../../../../../api/students/students';
import { PAYMENT_STATUS } from '../../profile/profileFormat';
import ChevronRightIcon from '../../../../../components/icons/ChevronRightIcon';
import GripIcon from '../../../../../components/icons/GripIcon';
import { getInitials } from '../../../../../utils/initials';
import { pluralize } from '../../../../../utils/formatSession';
import { clampToBlock, groupBlocks, moveId } from '../../../../../utils/studentOrder';

interface StudentsTableProps {
  students: GradeStudent[];
  // Group id -> group name, to show each student's group.
  groupNames: Map<string, string>;
  // Given only when the list can be reordered ("My order", no search): each
  // row gets a drag handle. Receives the group and all its ids, in the new order.
  onReorder?: (groupId: string, orderedIds: string[]) => void;
  // "All students" in "My order": a heading above each group's block.
  showGroupHeadings?: boolean;
}

// The same column widths for the header and every row, so they line up.
const COLUMNS = 'md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(104px,1fr)_72px_88px_20px]';

// When a rate counts as good, worth watching, or a problem. One rule for
// attendance and marks, so the colours mean the same thing everywhere.
type Tone = 'good' | 'watch' | 'low';

const toneOf = (percent: number): Tone =>
  percent >= 85 ? 'good' : percent >= 65 ? 'watch' : 'low';

const TONE_TEXT: Record<Tone, string> = {
  good: 'text-success',
  watch: 'text-warning',
  low: 'text-danger',
};

const TONE_BAR: Record<Tone, string> = {
  good: 'bg-success',
  watch: 'bg-warning',
  low: 'bg-danger',
};

// "No data yet": a dash for the eye, words for screen readers.
function NoData() {
  return (
    <span className="text-sm text-ink-muted">
      <span aria-hidden="true">—</span>
      <span className="sr-only">no data yet</span>
    </span>
  );
}

function AttendanceCell({ rate }: { rate: number | null }) {
  if (rate === null) return <NoData />;

  const tone = toneOf(rate);

  return (
    <span className="flex items-center gap-2">
      {/* The bar is decoration; the number says the same thing. */}
      <span
        aria-hidden="true"
        className="h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-border"
      >
        <span
          className={`block h-full rounded-full ${TONE_BAR[tone]}`}
          style={{ width: `${rate}%` }}
        />
      </span>
      <span className={`text-sm font-semibold tabular-nums ${TONE_TEXT[tone]}`}>{rate}%</span>
    </span>
  );
}

function MarkCell({ mark }: { mark: number | null }) {
  if (mark === null) return <NoData />;

  return (
    <span className={`text-sm font-semibold tabular-nums ${TONE_TEXT[toneOf(mark)]}`}>{mark}%</span>
  );
}

function PaymentBadge({ status }: { status: PaymentStatus | null }) {
  if (status === null) return <NoData />;

  const { label, classes } = PAYMENT_STATUS[status];

  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${classes}`}>
      {label}
    </span>
  );
}

// One row: the whole row is a link to the profile.
function StudentRowLink({ student, groupName }: { student: GradeStudent; groupName: string }) {
  const hasSummary =
    student.attendanceRate !== null ||
    student.averageMark !== null ||
    student.paymentStatus !== null;

  return (
    <Link
      to={`/teacher/students/${student.id}`}
      className={`
        flex min-w-0 flex-1 items-center gap-3 px-4 py-3
        transition-colors
        hover:bg-surface-hover
        focus-visible:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary
        md:grid md:gap-4 md:px-5 ${COLUMNS}
      `}
    >
      <span className="flex min-w-0 flex-1 items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-tint text-[13px] font-bold text-primary"
        >
          {getInitials(student.name)}
        </span>

        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-[15px] font-semibold text-ink">{student.name}</span>
          <span className="truncate text-[13px] text-ink-secondary">
            <span className="font-mono">{student.code}</span>
            {/* Phones: the group has no column, so it goes here. */}
            <span className="md:hidden"> · {groupName}</span>
          </span>

          {/* Phones: the summary values that exist, on one line. */}
          {hasSummary && (
            <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 md:hidden">
              {student.attendanceRate !== null && (
                <span className="flex items-center gap-1 text-xs text-ink-secondary">
                  <span>Attendance</span>
                  <AttendanceCell rate={student.attendanceRate} />
                </span>
              )}
              {student.averageMark !== null && (
                <span className="flex items-center gap-1 text-xs text-ink-secondary">
                  <span>Marks</span>
                  <MarkCell mark={student.averageMark} />
                </span>
              )}
              {student.paymentStatus !== null && <PaymentBadge status={student.paymentStatus} />}
            </span>
          )}
        </span>
      </span>

      {/* Tablet and up: one column each. */}
      <span className="hidden truncate text-sm text-ink-secondary md:block">
        <span className="sr-only">Group: </span>
        {groupName}
      </span>

      <span className="hidden md:block">
        <span className="sr-only">Attendance: </span>
        <AttendanceCell rate={student.attendanceRate} />
      </span>

      <span className="hidden md:block">
        <span className="sr-only">Marks: </span>
        <MarkCell mark={student.averageMark} />
      </span>

      <span className="hidden md:block">
        <span className="sr-only">Payment: </span>
        <PaymentBadge status={student.paymentStatus} />
      </span>

      <ChevronRightIcon className="h-[18px] w-[18px] shrink-0 text-ink-muted" />
    </Link>
  );
}

// border-border-strong: the soft card border is too faint to separate rows at a glance.
const rowClasses = 'border-b border-border-strong last:border-b-0';

// A row with a drag handle. Only the handle starts a drag, so the rest of the
// row stays a normal link (and the page still scrolls under a finger).
function SortableRow({ student, groupName }: { student: GradeStudent; groupName: string }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: student.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`
        ${rowClasses} relative flex items-center bg-surface
        ${isDragging ? 'z-10 shadow-lg shadow-ink/15 ring-1 ring-border-strong' : ''}
      `}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Move ${student.name}`}
        // touch-none: a finger on the handle drags instead of scrolling the page.
        className="ml-1 flex h-11 w-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-ink-muted hover:bg-surface-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-primary active:cursor-grabbing md:ml-2"
      >
        <GripIcon className="h-[18px] w-[18px]" />
      </button>
      <StudentRowLink
        student={student}
        groupName={groupName}
      />
    </li>
  );
}

const SCREEN_READER_INSTRUCTIONS = {
  draggable:
    'To move a student, press Space, use the up and down arrow keys, then press Space again to drop. Escape cancels.',
};

// One group's students, draggable among themselves. Each block has its own
// drag area, and a dragged row is held inside the block: the order is saved
// per group, so a row can't be dropped into another group.
function SortableBlock({
  groupId,
  students,
  groupNames,
  label,
  onReorder,
}: {
  groupId: string;
  students: GradeStudent[];
  groupNames: Map<string, string>;
  label: string;
  onReorder: (groupId: string, orderedIds: string[]) => void;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const sensors = useSensors(
    // 4px before a drag starts, so a plain click on the handle does nothing.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const ids = students.map((student) => student.id);
  const nameOf = (id: string | number) => students.find((s) => s.id === id)?.name ?? 'Student';
  const placeOf = (id: string | number) =>
    `position ${ids.indexOf(String(id)) + 1} of ${ids.length}`;

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}, ${placeOf(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${nameOf(active.id)} is at ${placeOf(over.id)}.` : `${nameOf(active.id)} is here.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${nameOf(active.id)} dropped at ${placeOf(over.id)}.`
        : `${nameOf(active.id)} dropped. The order didn’t change.`,
    onDragCancel: ({ active }) => `Cancelled. ${nameOf(active.id)} is back where it was.`,
  };

  const keepInBlock: Modifier = ({ transform, activeNodeRect }) => {
    const block = listRef.current?.getBoundingClientRect();
    return block && activeNodeRect ? clampToBlock(transform, activeNodeRect, block) : transform;
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    onReorder(groupId, moveId(ids, String(active.id), String(over.id)));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[keepInBlock]}
      onDragEnd={handleDragEnd}
      accessibility={{ announcements, screenReaderInstructions: SCREEN_READER_INSTRUCTIONS }}
    >
      <SortableContext
        items={ids}
        strategy={verticalListSortingStrategy}
      >
        <ul
          ref={listRef}
          aria-label={label}
        >
          {students.map((student) => (
            <SortableRow
              key={student.id}
              student={student}
              groupName={groupNames.get(student.groupId) ?? ''}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

// The grade's students: one row each, and the whole row opens the profile.
//
// Each row carries a quick summary (attendance, marks, this month's fee), so
// a teacher can skim the whole grade and spot who needs attention without
// opening a single profile.
//
// It's a list of links, not a <table>: each row is ONE thing to click, and a
// table can't make a whole row a link without tricks. Hidden labels
// ("Attendance", "Marks"...) make each link read in full for screen readers.
//
// One markup, two layouts: a grid row from tablet width (md:), a compact
// card on phones, where the group moves under the name and only the
// summary values that exist are shown.
//
// With onReorder, rows can be dragged by their handle within their group:
// mouse, touch, or keyboard (Space, the arrow keys, Space again), with what
// happens read out.
function StudentsTable({
  students,
  groupNames,
  onReorder,
  showGroupHeadings = false,
}: StudentsTableProps) {
  const blocks = groupBlocks(students);
  const grouped = showGroupHeadings || Boolean(onReorder);

  return (
    <div>
      {/* Column titles: decorative (each row says what it is). Tablet and up.
          A tinted band with a firm line under it, so the header reads as
          separate from the first row. With handles, it moves over to line up. */}
      <div
        aria-hidden="true"
        className={`
          hidden items-center gap-4 border-b border-border-strong bg-page py-2.5 pr-5
          text-xs font-semibold uppercase tracking-wide text-ink-muted
          md:grid ${COLUMNS} ${onReorder ? 'pl-[64px]' : 'pl-5'}
        `}
      >
        <span>Student</span>
        <span>Group</span>
        <span>Attendance</span>
        <span>Marks</span>
        <span>Payment</span>
        <span />
      </div>

      {grouped ? (
        blocks.map((block) => {
          const groupName = groupNames.get(block.groupId) ?? '';

          return (
            <section
              key={block.groupId}
              aria-label={showGroupHeadings ? groupName : undefined}
            >
              {showGroupHeadings && (
                <h3 className="border-b border-border-strong bg-page/60 px-4 py-2 text-[13px] font-bold text-ink-secondary sm:px-5">
                  {groupName}{' '}
                  <span className="font-normal text-ink-muted">
                    · {pluralize(block.students.length, 'student')}
                  </span>
                </h3>
              )}
              {onReorder ? (
                <SortableBlock
                  groupId={block.groupId}
                  students={block.students}
                  groupNames={groupNames}
                  label={showGroupHeadings ? `Students in ${groupName}` : 'Students'}
                  onReorder={onReorder}
                />
              ) : (
                <ul aria-label={`Students in ${groupName}`}>
                  {block.students.map((student) => (
                    <li
                      key={student.id}
                      className={rowClasses}
                    >
                      <StudentRowLink
                        student={student}
                        groupName={groupName}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })
      ) : (
        <ul aria-label="Students">
          {students.map((student) => (
            <li
              key={student.id}
              className={rowClasses}
            >
              <StudentRowLink
                student={student}
                groupName={groupNames.get(student.groupId) ?? ''}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default StudentsTable;
