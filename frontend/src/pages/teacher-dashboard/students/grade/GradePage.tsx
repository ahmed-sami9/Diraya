import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import type { GroupSummary } from '../../../../api/students/groups';
import ChevronRightIcon from '../../../../components/icons/ChevronRightIcon';
import MoreHorizontalIcon from '../../../../components/icons/MoreHorizontalIcon';
import PencilIcon from '../../../../components/icons/PencilIcon';
import PlusIcon from '../../../../components/icons/PlusIcon';
import SearchIcon from '../../../../components/icons/SearchIcon';
import TrashIcon from '../../../../components/icons/TrashIcon';
import UserPlusIcon from '../../../../components/icons/UserPlusIcon';
import OptionsMenu from '../../../../components/OptionsMenu';
import SectionError from '../../../../components/SectionError';
import { useDelayedFlag } from '../../../../hooks/useDelayedFlag';
import { useGradePage } from '../../../../hooks/students/useGradePage';
import { pluralize } from '../../../../utils/formatSession';

import DeleteGradeDialog from '../components/DeleteGradeDialog';
import GradeFormDialog from '../components/GradeFormDialog';

import DeleteGroupDialog from './components/DeleteGroupDialog';
import GradeHeader from './components/GradeHeader';
import GradeSwitcher from './components/GradeSwitcher';
import GroupFilter, { type GroupFilterValue } from './components/GroupFilter';
import GroupFormDialog from './components/GroupFormDialog';
import StudentFormDialog from './components/StudentFormDialog';
import StudentsTable from './components/StudentsTable';

// Which dialog is open. One value, so two can never be open together.
type DialogState =
  | { type: 'add-student' }
  | { type: 'add-group' }
  | { type: 'rename-group'; group: GroupSummary }
  | { type: 'delete-group'; group: GroupSummary }
  | { type: 'edit-grade' }
  | { type: 'delete-grade' }
  | null;

type SortOrder = 'name' | 'newest' | 'code';

const nameCompare = new Intl.Collator('en', { sensitivity: 'base' }).compare;

// The route: /teacher/students/grades/:gradeId
//
// The `key` gives each grade its own fresh page state. Switching grades from
// the breadcrumb changes the key, so React starts over: no grade's students
// or filter can leak into the next one.
function GradePage() {
  const { gradeId = '' } = useParams();

  return (
    <GradePageContent
      key={gradeId}
      gradeId={gradeId}
    />
  );
}

function GradePageContent({ gradeId }: { gradeId: string }) {
  const page = useGradePage(gradeId);
  const { grade, groups, students, status } = page;

  const navigate = useNavigate();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortOrder>('name');
  // Read by screen readers after adding a student ("Omar Adel added as 26-0042").
  const [announcement, setAnnouncement] = useState('');

  // The selected group lives in the URL (?group=12), so it survives a
  // refresh, works with the Back button, and can be shared.
  const [searchParams, setSearchParams] = useSearchParams();
  const groupParam = searchParams.get('group');

  // A plain string for the memos below: an object would be new on every
  // render and make them recompute every time. An unknown id (a deleted
  // group, an old link) falls back to "All students".
  const filterGroupId =
    groupParam && groups.some((group) => group.id === groupParam) ? groupParam : null;

  const filter: GroupFilterValue = filterGroupId ? { groupId: filterGroupId } : 'all';

  const setFilter = (value: GroupFilterValue) => {
    const next = new URLSearchParams(searchParams);

    if (value === 'all') next.delete('group');
    else next.set('group', value.groupId);

    // replace: changing the filter shouldn't add a step to the Back button.
    setSearchParams(next, { replace: true });
  };

  // Counted from the student list rather than stored, so they can never
  // disagree with what the table shows.
  const { countsByGroup, groupNames } = useMemo(() => {
    const counts = new Map<string, number>();

    for (const student of students) {
      counts.set(student.groupId, (counts.get(student.groupId) ?? 0) + 1);
    }

    return {
      countsByGroup: counts,
      groupNames: new Map(groups.map((group) => [group.id, group.name])),
    };
  }, [students, groups]);

  const selectedGroup = filterGroupId
    ? groups.find((group) => group.id === filterGroupId)
    : undefined;

  const inFilter = useMemo(
    () =>
      filterGroupId ? students.filter((student) => student.groupId === filterGroupId) : students,
    [students, filterGroupId]
  );

  const shown = useMemo(() => {
    const text = query.trim().toLowerCase();

    const matches = text
      ? inFilter.filter(
          (student) =>
            student.name.toLowerCase().includes(text) || student.code.toLowerCase().includes(text)
        )
      : inFilter;

    return [...matches].sort((a, b) =>
      sort === 'name'
        ? nameCompare(a.name, b.name)
        : sort === 'newest'
          ? b.joinedAt.localeCompare(a.joinedAt)
          : a.code.localeCompare(b.code)
    );
  }, [inFilter, query, sort]);

  const closeDialog = () => setDialog(null);

  return (
    <div className="flex flex-col gap-5">
      {/* Breadcrumb: back to all grades, and a quick switch to another one. */}
      <nav
        aria-label="Breadcrumb"
        className="flex min-w-0 items-center gap-2 pl-1 text-sm"
      >
        <Link
          to="/teacher/students"
          className="
            flex h-9 shrink-0 items-center gap-1 rounded-lg px-1.5
            font-semibold text-ink-secondary
            hover:text-ink
            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
          "
        >
          <ChevronRightIcon className="h-4 w-4 rotate-180" />
          Students
        </Link>
        <span
          aria-hidden="true"
          className="text-ink-muted"
        >
          /
        </span>
        {grade ? (
          <GradeSwitcher
            currentGradeId={grade.id}
            currentGradeName={grade.name}
          />
        ) : (
          <span className="h-5 w-36 animate-pulse rounded bg-border" />
        )}
      </nav>

      {status === 'loading' && <GradePageSkeleton />}

      {status === 'error' && (
        <SectionError
          title="We couldn’t load this grade"
          error={page.loadError}
          onRetry={page.reload}
        />
      )}

      {status === 'not-found' && (
        <section className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface px-6 py-12 text-center">
          <h1 className="text-lg font-bold text-ink">This grade doesn’t exist</h1>
          <p className="max-w-sm text-sm text-ink-secondary">
            It may have been deleted, or the link is wrong.
          </p>
          <Link
            to="/teacher/students"
            className="mt-3 flex h-11 items-center rounded-[10px] border border-border px-4 text-sm font-semibold text-ink hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Back to your grades
          </Link>
        </section>
      )}

      {status === 'ready' && grade && (
        <>
          <GradeHeader
            grade={grade}
            studentCount={students.length}
            groupCount={groups.length}
            onAddStudent={() => setDialog({ type: 'add-student' })}
            onEditGrade={() => setDialog({ type: 'edit-grade' })}
            onDeleteGrade={() => setDialog({ type: 'delete-grade' })}
          />

          <section
            aria-label={`Students in ${grade.name}`}
            className="rounded-2xl border border-border bg-surface"
          >
            <div className="border-b border-border bg-page/60 p-4 sm:px-5">
              <GroupFilter
                groups={groups}
                totalCount={students.length}
                countsByGroup={countsByGroup}
                value={filter}
                onChange={setFilter}
                onAddGroup={() => setDialog({ type: 'add-group' })}
              />
            </div>

            {/* Shown whenever a group is picked, even an empty one, so its
                Rename / Delete options are always reachable. */}
            {(students.length > 0 || selectedGroup) && (
              <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
                <label className="flex h-10 min-w-0 flex-1 basis-full items-center gap-2 rounded-[10px] border border-border px-3 text-ink-muted focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary-tint sm:max-w-[340px] sm:basis-56">
                  <SearchIcon className="h-4 w-4 shrink-0" />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setAnnouncement('');
                    }}
                    placeholder="Filter by name or code"
                    aria-label={`Filter students in ${grade.name}`}
                    className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
                  />
                </label>

                <p
                  aria-live="polite"
                  className="flex-1 text-[13px] text-ink-muted"
                >
                  {announcement ||
                    `Showing ${shown.length} of ${pluralize(inFilter.length, 'student')}`}
                </p>

                <label className="flex items-center gap-2 text-[13px] font-semibold text-ink-secondary">
                  Sort
                  <select
                    value={sort}
                    onChange={(event) => setSort(event.target.value as SortOrder)}
                    className="h-10 cursor-pointer rounded-[10px] border border-border bg-surface px-2.5 text-[13px] font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <option value="name">Name</option>
                    <option value="newest">Newest first</option>
                    <option value="code">Code</option>
                  </select>
                </label>

                {selectedGroup && (
                  <OptionsMenu
                    label={`Options for ${selectedGroup.name}`}
                    trigger={
                      <>
                        <span className="max-w-[120px] truncate">{selectedGroup.name}</span>
                        <MoreHorizontalIcon className="h-4 w-4" />
                      </>
                    }
                    buttonClassName="h-10 rounded-[10px] border border-border bg-surface px-3 text-[13px] font-semibold text-ink-secondary hover:bg-surface-hover hover:text-ink"
                    items={[
                      {
                        label: 'Rename group',
                        icon: <PencilIcon className="h-4 w-4 text-ink-secondary" />,
                        onSelect: () => setDialog({ type: 'rename-group', group: selectedGroup }),
                      },
                      {
                        label: 'Delete group',
                        icon: <TrashIcon className="h-4 w-4" />,
                        tone: 'danger',
                        onSelect: () => setDialog({ type: 'delete-group', group: selectedGroup }),
                      },
                    ]}
                  />
                )}
              </div>
            )}

            {students.length === 0 ? (
              <EmptyMessage
                title="No students in this grade yet"
                text="Add your first student. You only need their name and a parent’s mobile number."
                actionLabel="Add your first student"
                onAction={() => setDialog({ type: 'add-student' })}
              />
            ) : inFilter.length === 0 ? (
              <EmptyMessage
                title={`No students in ${selectedGroup?.name ?? 'this group'} yet`}
                text="Add a student here. Their attendance will be taken with this group."
                actionLabel="Add student"
                onAction={() => setDialog({ type: 'add-student' })}
              />
            ) : shown.length === 0 ? (
              <EmptyMessage
                title={`No students match “${query.trim()}”`}
                text="Check the spelling, or search by their code."
              />
            ) : (
              <StudentsTable
                students={shown}
                groupNames={groupNames}
              />
            )}
          </section>
        </>
      )}

      {/* Dialogs: mounted only while open, so each opening starts fresh. */}
      {grade && dialog?.type === 'add-student' && (
        <StudentFormDialog
          gradeName={grade.name}
          groups={groups}
          defaultGroupId={selectedGroup?.id ?? null}
          onSubmit={async (input) => {
            const student = await page.addStudent(input);
            setAnnouncement(`${student.name} added as ${student.code}`);
          }}
          onClose={closeDialog}
        />
      )}

      {grade && dialog?.type === 'add-group' && (
        <GroupFormDialog
          gradeName={grade.name}
          onSubmit={async (input) => {
            const group = await page.addGroup(input);
            // Jump to the new group, ready to add students to it.
            setFilter({ groupId: group.id });
          }}
          onClose={closeDialog}
        />
      )}

      {grade && dialog?.type === 'rename-group' && (
        <GroupFormDialog
          gradeName={grade.name}
          group={dialog.group}
          onSubmit={(input) => page.editGroup(dialog.group.id, input)}
          onClose={closeDialog}
        />
      )}

      {dialog?.type === 'delete-group' && (
        <DeleteGroupDialog
          group={dialog.group}
          studentCount={countsByGroup.get(dialog.group.id) ?? 0}
          // Where its students can go: the grade's other groups.
          otherGroups={groups.filter((group) => group.id !== dialog.group.id)}
          onConfirm={async (moveStudentsTo) => {
            await page.removeGroup(dialog.group.id, moveStudentsTo);
            // Follow the students to their new group, or show everyone.
            setFilter(moveStudentsTo ? { groupId: moveStudentsTo } : 'all');
          }}
          onClose={closeDialog}
        />
      )}

      {grade && dialog?.type === 'edit-grade' && (
        <GradeFormDialog
          grade={grade}
          onSubmit={page.editGrade}
          onClose={closeDialog}
        />
      )}

      {grade && dialog?.type === 'delete-grade' && (
        <DeleteGradeDialog
          // The live count, not the one loaded with the page.
          grade={{ ...grade, studentCount: students.length }}
          onConfirm={async () => {
            await page.removeGrade();
            navigate('/teacher/students', { replace: true });
          }}
          onClose={closeDialog}
        />
      )}
    </div>
  );
}

interface EmptyMessageProps {
  title: string;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}

// The message inside the students card when there's nothing to list.
function EmptyMessage({ title, text, actionLabel, onAction }: EmptyMessageProps) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span
        aria-hidden="true"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-tint text-primary"
      >
        <UserPlusIcon className="h-6 w-6" />
      </span>
      <h2 className="mt-3 text-base font-bold text-ink">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-ink-secondary">{text}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 flex h-11 items-center gap-2 rounded-[10px] bg-primary px-[18px] text-sm font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary cursor-pointer"
        >
          <PlusIcon className="h-[18px] w-[18px]" />
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// Placeholder shapes while the grade loads. Only after a short delay, so a
// fast answer never flashes them.
function GradePageSkeleton() {
  const isVisible = useDelayedFlag(true);

  if (!isVisible) return null;

  return (
    <div
      role="status"
      className="flex animate-pulse flex-col gap-5"
    >
      <span className="sr-only">Loading grade</span>
      <div className="h-[210px] rounded-2xl border border-border bg-surface" />
      <div className="h-[420px] rounded-2xl border border-border bg-surface" />
    </div>
  );
}

export default GradePage;
