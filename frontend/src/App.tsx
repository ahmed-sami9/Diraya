import { Routes, Route, Navigate } from 'react-router-dom';
import TeacherSignIn from './pages/teacher-signIn/TeacherSignIn';

import TeacherDashboardLayout from './pages/teacher-dashboard/TeacherDashboardLayout';
import TeacherHomePage from './pages/teacher-dashboard/home/TeacherHomePage';

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

          {/* Later:

          <Route
            path="students"
            element={<StudentsPage />}
          />

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
