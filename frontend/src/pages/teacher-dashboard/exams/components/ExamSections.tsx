import { Link } from 'react-router-dom';

import type { ExamSummary } from '../../../../api/exams/exams';
import AlertTriangleIcon from '../../../../components/icons/AlertTriangleIcon';
import ChevronRightIcon from '../../../../components/icons/ChevronRightIcon';
import {
  KIND_LABEL,
  TONE_BAR,
  TONE_TEXT,
  asDate,
  dayNumber,
  examPath,
  shortDay,
  shortMonth,
  toneOf,
  whenLabel,
} from '../examHelpers';

// The three sections of the exams list page, kept in one file for now.
// Each can move to its own file later without changing anything else.

function SectionTitle({ id, children }: { id: string; children: string }) {
  return (
    <h2
      id={id}
      className="text-[13px] font-bold uppercase tracking-wider text-ink-muted"
    >
      {children}
    </h2>
  );
}

/* --------------------------- Missing marks banner -------------------------- */

// The one thing on this page that asks the teacher to act. It names the
// newest exam with missing marks and counts the rest, instead of listing
// them all: one clear next step beats a wall of warnings.
export function MissingMarksBanner({ exams }: { exams: ExamSummary[] }) {
  const [first, ...rest] = exams;
  const left = first.results.total - first.results.entered;

  return (
    <Link
      to={examPath(first.id)}
      className="
        flex flex-wrap items-center gap-x-3 gap-y-1
        rounded-2xl bg-warning-tint px-4 py-3.5 text-warning
        transition-opacity hover:opacity-90
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
        sm:px-5
      "
    >
      <AlertTriangleIcon className="h-5 w-5 shrink-0" />
      <span className="min-w-[200px] flex-1 text-sm">
        <strong>Marks still missing</strong> · {first.title}, {first.grade.name}: {left}{' '}
        {left === 1 ? 'student' : 'students'} not entered yet
        {rest.length > 0 && ` (and ${rest.length} more ${rest.length === 1 ? 'exam' : 'exams'})`}
      </span>
      <span className="text-sm font-bold">Enter them →</span>
    </Link>
  );
}

/* --------------------------------- Upcoming -------------------------------- */

export function UpcomingExams({ exams, today }: { exams: ExamSummary[]; today: string }) {
  return (
    <section
      aria-labelledby="upcoming-title"
      className="flex flex-col gap-3"
    >
      <SectionTitle id="upcoming-title">Upcoming</SectionTitle>

      {exams.length === 0 ? (
        <p className="text-sm text-ink-secondary">Nothing scheduled. Add an exam to plan ahead.</p>
      ) : (
        // auto-fill: as many 280px+ cards per row as fit, from phone to desktop.
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3.5">
          {exams.map((exam) => {
            const date = asDate(exam.heldOn);

            return (
              <li key={exam.id}>
                <Link
                  to={examPath(exam.id)}
                  className="
                    flex h-full items-center gap-4
                    rounded-2xl border border-border bg-surface px-4 py-4
                    transition-colors hover:bg-surface-hover
                    focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
                  "
                >
                  {/* A calendar tile: the date is what matters first. */}
                  <span
                    aria-hidden="true"
                    className="flex h-[60px] w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-primary-tint text-primary"
                  >
                    <span className="text-[22px] font-extrabold leading-none">
                      {dayNumber.format(date)}
                    </span>
                    <span className="text-xs font-bold uppercase">{shortMonth.format(date)}</span>
                  </span>

                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-base font-bold text-ink">{exam.title}</span>
                    <span className="truncate text-[13px] text-ink-secondary">
                      {exam.grade.name} · {KIND_LABEL[exam.kind]} · out of {exam.maxMark}
                    </span>
                    <span className="text-xs font-semibold text-primary">
                      {/* The tile is hidden from screen readers, so the date is said here. */}
                      <span className="sr-only">{shortDay.format(date)}, </span>
                      {whenLabel(today, exam.heldOn)}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ----------------------------------- Past ---------------------------------- */

// Same column widths for the header and every row, so they line up.
const COLUMNS = 'md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_140px_64px_88px_112px_20px]';

function NoData() {
  return (
    <span className="text-sm text-ink-muted">
      <span aria-hidden="true">—</span>
      <span className="sr-only">no marks yet</span>
    </span>
  );
}

function AverageCell({ percent }: { percent: number | null }) {
  if (percent === null) return <NoData />;
  const tone = toneOf(percent);

  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className="h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-border"
      >
        <span
          className={`block h-full rounded-full ${TONE_BAR[tone]}`}
          style={{ width: `${percent}%` }}
        />
      </span>
      <span className={`text-sm font-bold tabular-nums ${TONE_TEXT[tone]}`}>{percent}%</span>
    </span>
  );
}

function EnteredCell({ entered, total }: { entered: number; total: number }) {
  const isDone = entered === total;
  const percent = total === 0 ? 0 : Math.round((entered / total) * 100);

  return (
    <span className="flex flex-col gap-1">
      <span
        className={`text-[13px] font-semibold ${isDone ? 'text-ink-secondary' : 'text-warning'}`}
      >
        {entered} of {total}
      </span>
      <span
        aria-hidden="true"
        className="h-1 w-full max-w-[96px] overflow-hidden rounded-full bg-border"
      >
        <span
          className={`block h-full ${isDone ? 'bg-success' : 'bg-warning'}`}
          style={{ width: `${percent}%` }}
        />
      </span>
    </span>
  );
}

// Like the students table: a list of links, not a <table>, so each row is
// ONE thing to click. A grid row from tablet width, a compact card on phones.
export function PastExamsTable({ exams }: { exams: ExamSummary[] }) {
  return (
    <section
      aria-labelledby="past-title"
      className="flex flex-col gap-3"
    >
      <SectionTitle id="past-title">Past</SectionTitle>

      {exams.length === 0 ? (
        <p className="text-sm text-ink-secondary">No exams held yet.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <div
            aria-hidden="true"
            className={`
              hidden items-center gap-4 border-b border-border-strong bg-page px-5 py-2.5
              text-xs font-semibold uppercase tracking-wide text-ink-muted
              md:grid ${COLUMNS}
            `}
          >
            <span>Exam</span>
            <span>Grade</span>
            <span>Average</span>
            <span>Failed</span>
            <span>Full marks</span>
            <span>Entered</span>
            <span />
          </div>

          <ul aria-label="Past exams">
            {exams.map((exam) => {
              const { averagePercent, failed, fullMarks, entered, total } = exam.results;

              return (
                <li
                  key={exam.id}
                  className="border-b border-border-strong last:border-b-0"
                >
                  <Link
                    to={examPath(exam.id)}
                    className={`
                      flex items-center gap-3 px-4 py-3.5
                      transition-colors hover:bg-surface-hover
                      focus-visible:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary
                      md:grid md:gap-4 md:px-5 ${COLUMNS}
                    `}
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-[15px] font-semibold text-ink">
                        {exam.title}
                      </span>
                      <span className="truncate text-xs text-ink-muted">
                        {shortDay.format(asDate(exam.heldOn))} · {KIND_LABEL[exam.kind]} · out of{' '}
                        {exam.maxMark}
                        {/* Phones: the grade has no column, so it goes here. */}
                        <span className="md:hidden"> · {exam.grade.name}</span>
                      </span>

                      {/* Phones: the numbers that matter most, on one line. */}
                      <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-secondary md:hidden">
                        <span className="flex items-center gap-1">
                          Average <AverageCell percent={averagePercent} />
                        </span>
                        {failed > 0 && (
                          <span className="font-semibold text-danger">{failed} failed</span>
                        )}
                        {entered < total && (
                          <span className="font-semibold text-warning">
                            {total - entered} missing
                          </span>
                        )}
                      </span>
                    </span>

                    {/* Tablet and up: one column each. */}
                    <span className="hidden truncate text-sm text-ink-secondary md:block">
                      <span className="sr-only">Grade: </span>
                      {exam.grade.name}
                    </span>

                    <span className="hidden md:block">
                      <span className="sr-only">Average: </span>
                      <AverageCell percent={averagePercent} />
                    </span>

                    <span
                      className={`hidden text-sm font-bold tabular-nums md:block ${failed > 0 ? 'text-danger' : 'text-ink-secondary'}`}
                    >
                      <span className="sr-only">Failed: </span>
                      {failed}
                    </span>

                    <span className="hidden text-sm font-semibold tabular-nums text-ink md:block">
                      <span className="sr-only">Full marks: </span>
                      {fullMarks}
                    </span>

                    <span className="hidden md:block">
                      <span className="sr-only">Entered: </span>
                      <EnteredCell
                        entered={entered}
                        total={total}
                      />
                    </span>

                    <ChevronRightIcon className="h-[18px] w-[18px] shrink-0 text-ink-muted" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
