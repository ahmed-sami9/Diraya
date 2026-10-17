import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import type { ExamResultRow } from '../../../api/exams/exams';
import SectionError from '../../../components/SectionError';
import { useExam } from '../../../hooks/exams/useExam';
import { useDelayedFlag } from '../../../hooks/useDelayedFlag';
import { todayInCairo } from '../../../utils/cairoDate';

import DeleteExamDialog from './components/DeleteExamDialog';
import {
  ExamHeader,
  GroupBreakdown,
  MarkSpread,
  NoResultsYet,
  ResultsList,
  SummaryTiles,
  type ResultsSort,
} from './components/ExamDetailSections';
import ExamFormDialog from './components/ExamFormDialog';
import { spreadOf, summarizeResults } from './examHelpers';

const SORTS: ResultsSort[] = ['lowest', 'highest', 'name'];

// Score order, with the rows that have no score after the ones that do:
// first "not entered" (work left to do), then "absent".
const STATUS_ORDER = { scored: 0, 'not-entered': 1, absent: 2 } as const;

function sortRows(rows: ExamResultRow[], sort: ResultsSort) {
  const byName = (a: ExamResultRow, b: ExamResultRow) =>
    a.student.name.localeCompare(b.student.name);

  return [...rows].sort((a, b) => {
    if (sort === 'name') return byName(a, b);

    const statusDifference = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (statusDifference !== 0) return statusDifference;

    const scoreDifference =
      sort === 'lowest' ? (a.score ?? 0) - (b.score ?? 0) : (b.score ?? 0) - (a.score ?? 0);

    // Same score: by name, so the order never jumps around between renders.
    return scoreDifference !== 0 ? scoreDifference : byName(a, b);
  });
}

// /teacher/exams/:examId?group=6&sort=highest
//
// One exam: what it is, how the grade did, and every student's result.
//
// The server sends the RAW rows (one per student). Every number on the page
// (average, failed, the spread, each group's average) is worked out here
// from those rows, so the tiles, the chart and the list can never disagree.
function ExamDetailPage() {
  const { examId = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const today = todayInCairo();

  const { state, reload, update, remove } = useExam(examId);
  const [dialog, setDialog] = useState<'edit' | 'delete' | null>(null);

  const detail = state.status === 'ready' ? state.detail : null;

  // Filter and sort live in the URL: Back from a student's profile returns
  // to the same view. Unknown values fall back to the defaults.
  const groupParam = searchParams.get('group');
  const groupId = detail?.groups.some((group) => group.id === groupParam) ? groupParam : null;
  const sortParam = searchParams.get('sort');
  const sort = SORTS.find((option) => option === sortParam) ?? 'lowest';

  const updateParams = (key: 'group' | 'sort', value: string | null) => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true }
    );
  };

  // Everything derived from the rows, recomputed only when they change.
  const derived = useMemo(() => {
    if (!detail) return null;

    const { exam, groups, results } = detail;

    return {
      summary: summarizeResults(exam, results),
      spread: spreadOf(exam, results),
      // Only groups that have students on this exam.
      byGroup: groups
        .map((group) => ({
          ...group,
          rows: results.filter((row) => row.group.id === group.id),
        }))
        .filter((group) => group.rows.length > 0)
        .map(({ rows, ...group }) => ({ ...group, summary: summarizeResults(exam, rows) })),
    };
  }, [detail]);

  const shownRows = useMemo(() => {
    if (!detail) return [];
    const rows = groupId
      ? detail.results.filter((row) => row.group.id === groupId)
      : detail.results;
    return sortRows(rows, sort);
  }, [detail, groupId, sort]);

  /* --------------------------------- States -------------------------------- */

  if (state.status === 'not-found') {
    return (
      <PageFrame title="Exam">
        <section className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface px-6 py-12 text-center">
          <h1 className="text-lg font-bold text-ink">This exam doesn’t exist any more</h1>
          <p className="max-w-sm text-sm text-ink-secondary">
            It may have been deleted, or the link is old.
          </p>
          <Link
            to="/teacher/exams"
            className="mt-3 flex h-11 items-center rounded-[10px] border border-border px-4 text-sm font-semibold text-ink hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Back to exams
          </Link>
        </section>
      </PageFrame>
    );
  }

  if (state.status === 'error') {
    return (
      <PageFrame title="Exam">
        <SectionError
          title="We couldn’t load this exam"
          error={state.error}
          onRetry={reload}
        />
      </PageFrame>
    );
  }

  if (!detail || !derived) {
    return (
      <PageFrame title="Exam">
        <DetailSkeleton />
      </PageFrame>
    );
  }

  /* --------------------------------- Ready --------------------------------- */

  const { exam, groups, results } = detail;
  const { summary, spread, byGroup } = derived;
  const hasAnyResult = summary.sat + summary.absent > 0;
  const enterMarksTo = `/teacher/exams/${exam.id}/marks${groupId ? `?group=${groupId}` : ''}`;

  return (
    <PageFrame title={exam.title}>
      <ExamHeader
        exam={exam}
        onEdit={() => setDialog('edit')}
        onDelete={() => setDialog('delete')}
      />

      {hasAnyResult ? (
        <>
          <SummaryTiles
            exam={exam}
            summary={summary}
          />

          {(summary.sat > 0 || byGroup.length > 1) && (
            <div className="flex flex-wrap items-stretch gap-5">
              {summary.sat > 0 && (
                <MarkSpread
                  bands={spread}
                  sat={summary.sat}
                />
              )}
              {byGroup.length > 1 && <GroupBreakdown groups={byGroup} />}
            </div>
          )}

          <ResultsList
            exam={exam}
            rows={shownRows}
            groups={groups.filter((group) => byGroup.some((item) => item.id === group.id))}
            groupId={groupId}
            sort={sort}
            enterMarksTo={enterMarksTo}
            onGroupChange={(id) => updateParams('group', id)}
            onSortChange={(value) => updateParams('sort', value === 'lowest' ? null : value)}
          />
        </>
      ) : (
        <NoResultsYet
          exam={exam}
          today={today}
          studentCount={results.length}
          enterMarksTo={enterMarksTo}
        />
      )}

      {dialog === 'edit' && (
        <ExamFormDialog
          exam={exam}
          grades={[]}
          defaultGradeId={null}
          today={today}
          // Pick the fields an edit may change. The form also sends the
          // grade, which stays as it is.
          onSubmit={({ title, kind, heldOn, maxMark, passMark }) =>
            update({ title, kind, heldOn, maxMark, passMark })
          }
          onClose={() => setDialog(null)}
        />
      )}

      {dialog === 'delete' && (
        <DeleteExamDialog
          title={exam.title}
          resultCount={summary.sat + summary.absent}
          onConfirm={async () => {
            await remove();
            // replace: Back shouldn't lead to a deleted exam.
            navigate('/teacher/exams', { replace: true });
          }}
          onClose={() => setDialog(null)}
        />
      )}
    </PageFrame>
  );
}

// The breadcrumb is always there, even while loading or on an error, so
// the way back is never missing.
function PageFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-5">
      <nav
        aria-label="Breadcrumb"
        className="flex min-w-0 items-center gap-2 text-sm"
      >
        <Link
          to="/teacher/exams"
          className="shrink-0 font-semibold text-ink-secondary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Exams &amp; marks
        </Link>
        <span
          aria-hidden="true"
          className="text-ink-muted"
        >
          /
        </span>
        <span
          aria-current="page"
          className="truncate font-semibold text-ink"
        >
          {title}
        </span>
      </nav>
      {children}
    </div>
  );
}

// Only after a short delay, so a fast answer never flashes it.
function DetailSkeleton() {
  const isVisible = useDelayedFlag(true);

  if (!isVisible) return null;

  return (
    <div
      role="status"
      className="flex animate-pulse flex-col gap-5"
    >
      <span className="sr-only">Loading the exam</span>
      <div className="h-[110px] rounded-2xl border border-border bg-surface" />
      <div className="grid grid-cols-2 gap-3 sm:gap-3.5 lg:grid-cols-4">
        {[0, 1, 2, 3].map((tile) => (
          <div
            key={tile}
            className="h-[112px] rounded-2xl border border-border bg-surface"
          />
        ))}
      </div>
      <div className="h-[360px] rounded-2xl border border-border bg-surface" />
    </div>
  );
}

export default ExamDetailPage;
