import { useCallback, useEffect, useState } from 'react';

import { ApiError, isAbortError } from '../../api/apiClient';
import {
  deleteGrade,
  getGradeDetails,
  updateGrade,
  type GradeInput,
  type GradeSummary,
} from '../../api/students/grades';
import {
  createGroup,
  deleteGroup,
  renameGroup,
  type GroupInput,
  type GroupSummary,
} from '../../api/students/groups';
import {
  createStudent,
  getGradeStudents,
  type GradeStudent,
  type StudentInput,
} from '../../api/students/students';

// 'not-found': the grade was deleted, or the link is wrong. It gets its own
// screen ("this grade doesn't exist"), not the "try again" error.
type GradePageStatus = 'loading' | 'error' | 'not-found' | 'ready';

// Everything the grade page needs: the grade, its groups, its students, and
// the actions that change them.
//
// Mount it once per grade (GradePage gives each grade its own `key`), so
// switching grades always starts from a clean, loading state.
export function useGradePage(gradeId: string) {
  const [grade, setGrade] = useState<GradeSummary | null>(null);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [students, setStudents] = useState<GradeStudent[]>([]);
  const [status, setStatus] = useState<GradePageStatus>('loading');
  const [loadError, setLoadError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    // Both requests start at the same time instead of one after the other,
    // so the page waits for the slower one, not for the two added up.
    Promise.all([
      getGradeDetails(gradeId, controller.signal),
      getGradeStudents(gradeId, controller.signal),
    ])
      .then(([details, list]) => {
        setGrade(details.grade);
        setGroups(details.groups);
        setStudents(list);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) return;

        if (error instanceof ApiError && error.code === 'GRADE_NOT_FOUND') {
          setStatus('not-found');
          return;
        }

        console.error(error);
        setLoadError(error);
        setStatus('error');
      });

    return () => controller.abort();
  }, [gradeId, reloadKey]);

  const reload = useCallback(() => {
    setStatus('loading');
    setLoadError(null);
    setReloadKey((key) => key + 1);
  }, []);

  // Like the Students page: every action waits for the server, then updates
  // the screen. Each throws on failure, so the dialog that called it can say why.

  const editGrade = useCallback(
    async (input: GradeInput) => {
      setGrade(await updateGrade(gradeId, input));
    },
    [gradeId]
  );

  // The page leaves for the Students list after this succeeds.
  const removeGrade = useCallback(() => deleteGrade(gradeId), [gradeId]);

  const addGroup = useCallback(
    async (input: GroupInput) => {
      const group = await createGroup(gradeId, input);

      setGroups((previous) => [...previous, group]);

      return group;
    },
    [gradeId]
  );

  const editGroup = useCallback(async (groupId: string, input: GroupInput) => {
    const group = await renameGroup(groupId, input);

    setGroups((previous) => previous.map((item) => (item.id === groupId ? group : item)));
  }, []);

  // moveStudentsTo: where this group's students go (null when it has none).
  const removeGroup = useCallback(async (groupId: string, moveStudentsTo: string | null) => {
    await deleteGroup(groupId, moveStudentsTo);

    setGroups((previous) => previous.filter((item) => item.id !== groupId));

    // The server moved its students in the same transaction; do the same
    // here, so the screen matches without loading everything again.
    if (moveStudentsTo) {
      setStudents((previous) =>
        previous.map((student) =>
          student.groupId === groupId ? { ...student, groupId: moveStudentsTo } : student
        )
      );
    }
  }, []);

  const addStudent = useCallback(
    async (input: StudentInput) => {
      const student = await createStudent(gradeId, input);

      setStudents((previous) => [...previous, student]);

      return student;
    },
    [gradeId]
  );

  return {
    grade,
    groups,
    students,
    status,
    loadError,
    reload,
    editGrade,
    removeGrade,
    addGroup,
    editGroup,
    removeGroup,
    addStudent,
  };
}
