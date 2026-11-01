import { useEffect, useState } from 'react';

import { isAbortError } from '../../../../../api/apiClient';
import { getGradeDetails } from '../../../../../api/students/grades';
import type { GroupSummary } from '../../../../../api/students/groups';
import type { StudentDetails } from '../../../../../api/students/students';
import StudentFormDialog from '../../grade/components/StudentFormDialog';
import type { StudentProfile } from '../profileTypes';

interface EditStudentDialogProps {
  profile: StudentProfile;
  onSubmit: (details: StudentDetails) => Promise<void>;
  onClose: () => void;
}

// The grade page's student form, in edit mode. The profile doesn't know the
// grade's other groups, so they're loaded here; until then (or if that
// fails) the list holds the current group, and the other fields work as usual.
function EditStudentDialog({ profile, onSubmit, onClose }: EditStudentDialogProps) {
  const [groups, setGroups] = useState<GroupSummary[]>([profile.group]);
  const [groupsStatus, setGroupsStatus] = useState<'loading' | 'ready' | 'failed'>('loading');

  useEffect(() => {
    const controller = new AbortController();

    getGradeDetails(profile.grade.id, controller.signal)
      .then((details) => {
        setGroups(details.groups);
        setGroupsStatus('ready');
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) return;
        console.error(error);
        setGroupsStatus('failed');
      });

    return () => controller.abort();
  }, [profile.grade.id]);

  return (
    <StudentFormDialog
      mode="edit"
      gradeName={profile.grade.name}
      groups={groups}
      groupHint={
        groupsStatus === 'loading'
          ? 'Loading the grade’s other groups…'
          : groupsStatus === 'failed'
            ? 'Couldn’t load the other groups. You can still change the rest.'
            : undefined
      }
      student={{
        fullName: profile.name,
        parentPhone: profile.parentPhone,
        phone: profile.phone,
        groupId: profile.group.id,
      }}
      onSubmit={onSubmit}
      onClose={onClose}
    />
  );
}

export default EditStudentDialog;
