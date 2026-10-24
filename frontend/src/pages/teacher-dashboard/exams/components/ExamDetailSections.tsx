import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import type { Exam, ExamResultRow } from '../../../../api/exams/exams';
import OptionsMenu from '../../../../components/OptionsMenu';
import ChevronRightIcon from '../../../../components/icons/ChevronRightIcon';
import MoreHorizontalIcon from '../../../../components/icons/MoreHorizontalIcon';
import PencilIcon from '../../../../components/icons/PencilIcon';
import TrashIcon from '../../../../components/icons/TrashIcon';
import { secondaryButtonClasses } from '../../../../components/formStyles';
import {
  KIND_LABEL,
  TONE_BAR,
  TONE_TEXT,
  asDate,
  daysBetween,
  formatMark,
  percentOf,
  shortDay,
  toneOf,
  type ResultsSummary,
  type Tone,
} from '../examHelpers';

// The sections of one exam's page, top to bottom. Each one only displays
// what it's given; the page works out the numbers and owns the state.

const cardClasses = 'rounded-2xl border border-border bg-surface';

/* --------------------------------- Header --------------------------------- */

export function ExamHeader({
  exam,
  onEdit,
  onDelete,
}: {
  exam: Exam;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const passPercent = Math.round(percentOf(exam.passMark, exam.maxMark));

  return (
    <section
      aria-label="Exam"
      className={`${cardClasses} flex flex-wrap items-center gap-4 px-5 py-5 sm:px-6`}
    >
      <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-2.5">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">{exam.title}</h1>

        {/* The facts that frame every number below: what it's out of and
            where the pass line is. */}
        <ul
          aria-label="Exam details"
          className="flex flex-wrap gap-2 text-[13px] font-semibold"
        >
          <li className="rounded-full bg-primary-tint px-2.5 py-1 text-primary">
            {KIND_LABEL[exam.kind]}
          </li>
          {[
            `${exam.grade.name} · all groups`,
            shortDay.format(asDate(exam.heldOn)),
            `Out of ${exam.maxMark}`,
            `Pass mark ${formatMark(exam.passMark)} (${passPercent}%)`,
          ].map((fact) => (
            <li
              key={fact}
              className="rounded-full bg-page px-2.5 py-1 text-ink-secondary"
            >
              {fact}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={onEdit}
          className={`${secondaryButtonClasses} flex items-center gap-2`}
        >
          <PencilIcon className="h-4 w-4" />
          Edit
        </button>
        <OptionsMenu
          label={`More options for ${exam.title}`}
          trigger={<MoreHorizontalIcon className="h-5 w-5" />}
          buttonClassName="h-11 w-11 rounded-[10px] border border-border bg-surface text-ink-secondary hover:bg-surface-hover hover:text-ink"
          items={[
            {
              label: 'Delete exam',
              icon: <TrashIcon className="h-4 w-4" />,
              tone: 'danger',
              onSelect: onDelete,
            },
          ]}
        />
      </div>
    </section>
  );
}

/* ---------------------------------- Tiles --------------------------------- */

function Tile({
  label,
  value,
  valueClassName = 'text-ink',
  children,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  children: ReactNode;
}) {
  return (
    <div className={`${cardClasses} flex min-w-0 flex-col gap-1.5 px-4 py-4 sm:px-5`}>
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</span>
      <span className={`text-[26px] font-extrabold tabular-nums sm:text-3xl ${valueClassName}`}>
        {value}
      </span>
      <span className="text-[13px] text-ink-secondary">{children}</span>
    </div>
  );
}

// Four answers a teacher wants first: how did they do, how many sat it, who
// failed, who aced it.
export function SummaryTiles({ exam, summary }: { exam: Exam; summary: ResultsSummary }) {
  const { averagePercent, averageScore, highest, lowest } = summary;

  return (
    <section
      aria-label="Results at a glance"
      // Two across on phones (four tall cards would push the results far
      // down), four across from laptop width.
      className="grid grid-cols-2 gap-3 sm:gap-3.5 lg:grid-cols-4"
    >
      <Tile
        label="Average"
        value={averagePercent === null ? '—' : `${averagePercent}%`}
        valueClassName={
          averagePercent === null ? 'text-ink-muted' : TONE_TEXT[toneOf(averagePercent)]
        }
      >
        {averageScore === null || highest === null || lowest === null
          ? 'No marks yet'
          : `${formatMark(averageScore)} of ${exam.maxMark} · highest ${formatMark(highest)}, lowest ${formatMark(lowest)}`}
      </Tile>

      <Tile
        label="Sat the exam"
        value={String(summary.sat)}
      >
        {summary.absent} absent
        {summary.notEntered > 0 && (
          <>
            {' · '}
            <span className="font-semibold text-warning">{summary.notEntered} not entered yet</span>
          </>
        )}
      </Tile>

      <Tile
        label="Failed"
        value={String(summary.failed)}
        valueClassName={summary.failed > 0 ? 'text-danger' : 'text-ink'}
      >
        below {formatMark(exam.passMark)} of {exam.maxMark}
      </Tile>

      <Tile
        label="Full marks"
        value={String(summary.fullMarks)}
        valueClassName={summary.fullMarks > 0 ? 'text-success' : 'text-ink'}
      >
        scored {exam.maxMark} of {exam.maxMark}
      </Tile>
    </section>
  );
}

/* --------------------------------- Spread --------------------------------- */

// A small bar chart: how many students landed in each band. Bars are
// relative to the biggest band, so the shape reads even with few students.
export function MarkSpread({
  bands,
  sat,
}: {
  bands: { label: string; tone: Tone; count: number }[];
  sat: number;
}) {
  const biggest = Math.max(1, ...bands.map((band) => band.count));

  return (
    <section
      aria-labelledby="spread-title"
      className={`${cardClasses} flex flex-[1_1_420px] flex-col gap-3.5 px-5 py-5 sm:px-6`}
    >
      <h2
        id="spread-title"
        className="text-base font-bold text-ink"
      >
        How the marks spread{' '}
        <span className="text-[13px] font-medium text-ink-muted">
          · {sat} {sat === 1 ? 'student' : 'students'}
        </span>
      </h2>

      {/* A list, so screen readers hear "0–49%: 2" for each band. */}
      <ul className="flex flex-col gap-3">
        {bands.map((band) => (
          <li
            key={band.label}
            className="grid grid-cols-[72px_minmax(0,1fr)_32px] items-center gap-3"
          >
            <span className="text-[13px] font-semibold text-ink-secondary">{band.label}</span>
            <span
              aria-hidden="true"
              className="h-3.5 overflow-hidden rounded-md bg-page"
            >
              <span
                className={`block h-full rounded-md ${TONE_BAR[band.tone]}`}
                style={{ width: `${(band.count / biggest) * 100}%` }}
              />
            </span>
            <span className="text-right text-sm font-bold tabular-nums text-ink">
              <span className="sr-only">: </span>
              {band.count}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* -------------------------------- By group -------------------------------- */

export function GroupBreakdown({
  groups,
}: {
  groups: { id: string; name: string; summary: ResultsSummary }[];
}) {
  return (
    <section
      aria-labelledby="groups-title"
      className={`${cardClasses} flex flex-[1_1_300px] flex-col px-5 py-5 sm:px-6`}
    >
      <h2
        id="groups-title"
        className="mb-2 text-base font-bold text-ink"
      >
        By group
      </h2>

      <ul>
        {groups.map(({ id, name, summary }) => (
          <li
            key={id}
            className="flex items-center justify-between gap-3 border-t border-border-strong py-3"
          >
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-[15px] font-semibold text-ink">{name}</span>
              <span className="text-xs text-ink-muted">
                {summary.sat} sat · {summary.failed} failed
                {summary.notEntered > 0 && ` · ${summary.notEntered} not entered`}
              </span>
            </span>
            <span
              className={`text-xl font-extrabold tabular-nums ${
                summary.averagePercent === null
                  ? 'text-ink-muted'
                  : TONE_TEXT[toneOf(summary.averagePercent)]
              }`}
            >
              <span className="sr-only">Average: </span>
              {summary.averagePercent === null ? '—' : `${summary.averagePercent}%`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------ Nothing yet ------------------------------- */

// Instead of four tiles full of dashes: one sentence about what happens next.
export function NoResultsYet({
  exam,
  today,
  studentCount,
  enterMarksTo,
}: {
  exam: Exam;
  today: string;
  studentCount: number;
  enterMarksTo: string;
}) {
  const daysToGo = daysBetween(today, exam.heldOn);
  const isUpcoming = daysToGo > 0;

  return (
    <section className={`${cardClasses} flex flex-col items-center gap-2 px-6 py-12 text-center`}>
      <h2 className="text-lg font-bold text-ink">
        {isUpcoming
          ? `${daysToGo === 1 ? 'Tomorrow' : `In ${daysToGo} days`}, ${shortDay.format(asDate(exam.heldOn))}`
          : 'No marks entered yet'}
      </h2>
      <p className="max-w-sm text-sm text-ink-secondary">
        {isUpcoming
          ? `${studentCount} ${studentCount === 1 ? 'student' : 'students'} in ${exam.grade.name} will sit it. You can enter marks from the exam day.`
          : `Enter marks group by group. The average, the spread and who failed show up here as you go.`}
      </p>
      {!isUpcoming && <EnterMarksLink to={enterMarksTo} />}
    </section>
  );
}

export function EnterMarksLink({ to }: { to: string }) {
  return (
    <Link
      to={to}
      className="
        mt-2 flex h-11 shrink-0 items-center gap-2
        rounded-[10px] bg-primary-solid px-4
        text-sm font-semibold text-white
        transition-colors hover:bg-primary-hover
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
      "
    >
      <PencilIcon className="h-4 w-4" />
      Enter marks
    </Link>
  );
}

/* --------------------------------- Results -------------------------------- */

export type ResultsSort = 'lowest' | 'highest' | 'name';

const SORT_LABEL: Record<ResultsSort, string> = {
  lowest: 'Lowest first',
  highest: 'Highest first',
  name: 'Name',
};

const COLUMNS = 'md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(150px,1.4fr)_104px_20px]';

// One badge per row at most: the thing worth noticing about that student.
function badgeFor(exam: Exam, row: ExamResultRow) {
  if (row.status === 'not-entered')
    return { label: 'Not entered', classes: 'bg-warning-tint text-warning' };
  if (row.status === 'absent') return { label: 'Absent', classes: 'bg-page text-ink-secondary' };
  if (row.score === exam.maxMark)
    return { label: 'Full marks', classes: 'bg-success-tint text-success' };
  if (row.score !== null && row.score < exam.passMark)
    return { label: 'Failed', classes: 'bg-danger-tint text-danger' };
  return null;
}

function MarkCell({ exam, row }: { exam: Exam; row: ExamResultRow }) {
  if (row.status !== 'scored' || row.score === null) {
    return (
      <span className="text-sm text-ink-muted">
        {row.status === 'absent' ? 'Absent' : <span aria-label="no mark yet">—</span>}
      </span>
    );
  }

  const percent = Math.round(percentOf(row.score, exam.maxMark));
  const tone = toneOf(percent);

  return (
    <span className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-border lg:w-24"
      >
        <span
          className={`block h-full rounded-full ${TONE_BAR[tone]}`}
          style={{ width: `${percent}%` }}
        />
      </span>
      <span className="text-sm tabular-nums text-ink-secondary">
        <strong className={TONE_TEXT[tone]}>{formatMark(row.score)}</strong> / {exam.maxMark}
        <span className="text-ink-muted"> · {percent}%</span>
      </span>
    </span>
  );
}

const pillClasses = (selected: boolean) => `
  h-10 shrink-0 rounded-[10px] border px-3 text-[13px] cursor-pointer transition-colors
  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
  ${
    selected
      ? 'border-primary bg-primary-tint font-bold text-primary'
      : 'border-border bg-surface font-semibold text-ink hover:bg-surface-hover'
  }
`;

export function ResultsList({
  exam,
  rows,
  groups,
  groupId,
  sort,
  enterMarksTo,
  onGroupChange,
  onSortChange,
}: {
  exam: Exam;
  // Already filtered and sorted by the page.
  rows: ExamResultRow[];
  groups: { id: string; name: string }[];
  groupId: string | null;
  sort: ResultsSort;
  enterMarksTo: string;
  onGroupChange: (groupId: string | null) => void;
  onSortChange: (sort: ResultsSort) => void;
}) {
  return (
    <section
      aria-labelledby="results-title"
      className={cardClasses}
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-border-strong px-4 py-4 sm:px-5">
        <h2
          id="results-title"
          className="mr-auto text-base font-bold text-ink"
        >
          Results
        </h2>

        {/* Only worth a filter with more than one group. */}
        {groups.length > 1 && (
          <div
            role="group"
            aria-label="Show results by group"
            className="flex max-w-full gap-1.5 overflow-x-auto"
          >
            {[{ id: null, name: 'All' }, ...groups].map((group) => (
              <button
                key={group.id ?? 'all'}
                type="button"
                aria-pressed={group.id === groupId}
                onClick={() => onGroupChange(group.id)}
                className={pillClasses(group.id === groupId)}
              >
                {group.name}
              </button>
            ))}
          </div>
        )}

        <label className="flex items-center gap-2 text-[13px] font-semibold text-ink-secondary">
          Sort
          <select
            value={sort}
            onChange={(event) => onSortChange(event.target.value as ResultsSort)}
            className="h-10 cursor-pointer rounded-[10px] border border-border bg-surface px-2.5 text-[13px] font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {(Object.keys(SORT_LABEL) as ResultsSort[]).map((option) => (
              <option
                key={option}
                value={option}
              >
                {SORT_LABEL[option]}
              </option>
            ))}
          </select>
        </label>

        <EnterMarksLink to={enterMarksTo} />
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-ink-secondary">
          No students in this group sat this exam.
        </p>
      ) : (
        <>
          <div
            aria-hidden="true"
            className={`hidden items-center gap-4 border-b border-border-strong bg-page px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-muted md:grid ${COLUMNS}`}
          >
            <span>Student</span>
            <span>Group</span>
            <span>Mark</span>
            <span />
            <span />
          </div>

          {/* Each row opens the student's Marks tab: from "who failed?" to
              "how is this student doing overall?" in one click. */}
          <ul aria-label="Results">
            {rows.map((row) => {
              const badge = badgeFor(exam, row);

              return (
                <li
                  key={row.student.id}
                  className="border-b border-border-strong last:border-b-0"
                >
                  <Link
                    to={`/teacher/students/${row.student.id}/marks`}
                    className={`
                      flex items-center gap-3 px-4 py-3
                      transition-colors hover:bg-surface-hover
                      focus-visible:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary
                      md:grid md:gap-4 md:px-5 ${COLUMNS}
                    `}
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-[15px] font-semibold text-ink">
                        {row.student.name}
                      </span>
                      <span className="truncate text-xs text-ink-muted">
                        <span className="font-mono">{row.student.code}</span>
                        <span className="md:hidden"> · {row.group.name}</span>
                      </span>
                      {/* Phones: the mark and badge go under the name. */}
                      <span className="mt-1 flex flex-wrap items-center gap-2 md:hidden">
                        <MarkCell
                          exam={exam}
                          row={row}
                        />
                        {badge && row.status !== 'absent' && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-bold ${badge.classes}`}
                          >
                            {badge.label}
                          </span>
                        )}
                      </span>
                    </span>

                    <span className="hidden truncate text-sm text-ink-secondary md:block">
                      <span className="sr-only">Group: </span>
                      {row.group.name}
                    </span>

                    <span className="hidden md:block">
                      <span className="sr-only">Mark: </span>
                      <MarkCell
                        exam={exam}
                        row={row}
                      />
                    </span>

                    <span className="hidden md:block">
                      {badge && (
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold ${badge.classes}`}
                        >
                          {badge.label}
                        </span>
                      )}
                    </span>

                    <ChevronRightIcon className="h-[18px] w-[18px] shrink-0 text-ink-muted" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
