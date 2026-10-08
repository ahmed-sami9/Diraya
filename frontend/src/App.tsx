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
            element={<p className="text-ink-secondary">Grade page: coming next.</p>}
          />

          {/* Opened from the navbar search. Built with the student profile. */}
          <Route
            path="students/:studentId"
            element={<p className="text-ink-secondary">Student profile: coming soon.</p>}
          />

          {/* Later:

          <Route
            path="exams"
            element={<ExamsPage />}
          />

          */}
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
