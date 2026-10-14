import { lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import TeacherSignIn from './pages/teacher-signIn/TeacherSignIn';
import TeacherResetPassword from './pages/teacher-reset-password/TeacherResetPassword';
import TeacherVerifyEmail from './pages/teacher-verify-email/TeacherVerifyEmail';

import TeacherDashboardLayout from './pages/teacher-dashboard/TeacherDashboardLayout';
import TeacherHomePage from './pages/teacher-dashboard/home/TeacherHomePage';

// Loaded only when the teacher first opens Students. Until it arrives, the
// layout's <Suspense> shows the page loader (after a short delay).
const StudentsPage = lazy(() => import('./pages/teacher-dashboard/students/StudentsPage'));
const GradePage = lazy(() => import('./pages/teacher-dashboard/students/grade/GradePage'));

// The student profile: one layout (header, summary, tab bar) and a lazy page
// per tab, so a tab's code loads only when it's opened.
const StudentProfileLayout = lazy(
  () => import('./pages/teacher-dashboard/students/profile/StudentProfileLayout')
);
const OverviewTab = lazy(
  () => import('./pages/teacher-dashboard/students/profile/tabs/OverviewTab')
);
const AttendanceTab = lazy(
  () => import('./pages/teacher-dashboard/students/profile/tabs/AttendanceTab')
);
const MarksTab = lazy(() => import('./pages/teacher-dashboard/students/profile/tabs/MarksTab'));
const PaymentsTab = lazy(
  () => import('./pages/teacher-dashboard/students/profile/tabs/PaymentsTab')
);
const NotesTab = lazy(() => import('./pages/teacher-dashboard/students/profile/tabs/NotesTab'));

// Opened from the navbar's "Take attendance" button and the Home quick actions.
const AttendancePage = lazy(() => import('./pages/teacher-dashboard/attendance/AttendancePage'));

import ProtectedRoute from './components/ProtectedRoute';
import PublicOnlyRoute from './components/PublicOnlyRoute';

function App() {
  return (
    <Routes>
      {/* Entry point */}
      <Route
        path="/"
        element={
          <Navigate
            to="/teacher"
            replace
          />
        }
      />

      {/* Pages for users who are NOT authenticated */}
      <Route element={<PublicOnlyRoute />}>
        <Route
          path="/teacher/sign-in"
          element={<TeacherSignIn />}
        />
      </Route>

      {/* Password reset, opened from the link in the reset email. It sits
          outside PublicOnlyRoute on purpose: a teacher who is still signed in
          on this browser must be able to use the link too. */}
      <Route
        path="/teacher/reset-password"
        element={<TeacherResetPassword />}
      />

      {/* Email confirmation, opened from the link sent after sign-up. Outside
          PublicOnlyRoute for the same reason as the reset page. */}
      <Route
        path="/teacher/verify-email"
        element={<TeacherVerifyEmail />}
      />

      {/* Teacher-protected area */}
      <Route element={<ProtectedRoute allowedRole="teacher" />}>
        <Route
          path="/teacher"
          element={<TeacherDashboardLayout />}
        >
          <Route
            index
            element={<TeacherHomePage />}
          />

          <Route
            path="students"
            element={<StudentsPage />}
          />

          {/* Opened from a grade card. The grade page is the next to build. */}
          <Route
            path="students/grades/:gradeId"
            element={<GradePage />}
          />

          {/* A student's profile, opened from the grade table or the navbar
              search. Each tab is a child route rendered in the layout's
              <Outlet />. "grades" above is a fixed word, so React Router
              always prefers it over this :studentId. */}
          <Route
            path="students/:studentId"
            element={<StudentProfileLayout />}
          >
            <Route
              index
              element={<OverviewTab />}
            />
            <Route
              path="attendance"
              element={<AttendanceTab />}
            />
            <Route
              path="marks"
              element={<MarksTab />}
            />
            <Route
              path="payments"
              element={<PaymentsTab />}
            />
            <Route
              path="notes"
              element={<NotesTab />}
            />
          </Route>

          {/* Placeholders, so the navbar button and the quick actions never
              lead to an empty page. Each is replaced when its page is built. */}
          <Route
            path="attendance"
            element={<AttendancePage />}
          />

          <Route
            path="exams"
            element={<p className="text-ink-secondary">Exams &amp; marks: coming soon.</p>}
          />

          <Route
            path="payments"
            element={<p className="text-ink-secondary">Payments: coming soon.</p>}
          />
        </Route>
      </Route>

      {/* Wrong role */}
      <Route
        path="/unauthorized"
        element={<div>You don't have permission to access this page.</div>}
      />
    </Routes>
  );
}

export default App;
