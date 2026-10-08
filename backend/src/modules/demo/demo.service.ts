import { randomUUID } from 'node:crypto';

import { startTeacherSession } from '../auth/auth.session.service';

import { createDemoTeacher, deleteOldDemoTeachers } from './demo.repository';
import { seedDemoData } from './demo.seed';

const DEMO_POLICY = {
  // How long a demo teacher and its data are kept.
  maxAgeHours: 24,
  teacherName: 'Demo Teacher',
  // ".invalid" is reserved and can never receive mail, so nothing we send
  // (password reset, confirmation) can ever reach a demo account.
  emailDomain: 'demo.diraya.invalid',
} as const;

// "Try the demo": gives the visitor a brand-new teacher of their own, filled
// with the template data, and signs them in.
//
// Each visitor gets a separate teacher, so two people trying the demo at the
// same time never see or change each other's data.
export async function startDemoSession() {
  // Housekeeping first: remove demos that are past their lifetime. Doing it
  // here means no scheduled job is needed. If it fails, the visitor still
  // gets their demo; the leftovers are removed on a later visit.
  try {
    await deleteOldDemoTeachers(DEMO_POLICY.maxAgeHours);
  } catch (error) {
    console.error('Cleaning up old demo teachers failed:', error);
  }

  // The teachers table needs a unique email, so every demo gets its own.
  const teacher = await createDemoTeacher(
    {
      fullName: DEMO_POLICY.teacherName,
      email: `demo-${randomUUID()}@${DEMO_POLICY.emailDomain}`,
    },
    seedDemoData
  );

  // From here on it is an ordinary session: same cookie, same middleware,
  // same rules as any teacher. Never the long "remember me" kind.
  const { token, expiresAt } = await startTeacherSession(String(teacher.id), false);

  return {
    user: {
      id: String(teacher.id),
      name: teacher.full_name as string,
      email: teacher.email as string,
      role: 'teacher' as const,
      isDemo: true,
    },
    token,
    expiresAt,
  };
}
