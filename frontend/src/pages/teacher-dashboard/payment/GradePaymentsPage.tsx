import { Navigate, useLocation, useParams } from 'react-router-dom';

// /teacher/payments/grades/:gradeId -> /teacher/payments?grade=:gradeId
//
// A grade's payments now open inside the payments page (its grade chips).
// This keeps any old link or bookmark working instead of breaking it.
// replace: the old address doesn't stay in the Back history.
function GradePaymentsPage() {
  const { gradeId = '' } = useParams();
  const { search } = useLocation();

  const params = new URLSearchParams(search);
  params.set('grade', gradeId);

  return (
    <Navigate
      to={`/teacher/payments?${params.toString()}`}
      replace
    />
  );
}

export default GradePaymentsPage;
