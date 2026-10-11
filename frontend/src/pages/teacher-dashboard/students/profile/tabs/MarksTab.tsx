import { useOutletContext } from 'react-router-dom';

import EmptyHint from '../components/EmptyHint';
import ExamList from '../components/ExamList';
import SectionCard from '../components/SectionCard';
import type { ProfileOutletContext } from '../profileTypes';

// /teacher/students/:studentId/marks — every exam and quiz, newest first.
function MarksTab() {
  const { data } = useOutletContext<ProfileOutletContext>();
  const average = data.profile.summary.marks.average;

  return (
    <SectionCard
      title="Exams & marks"
      subtitle={average !== null ? `average ${average}%` : undefined}
    >
      {data.exams.length === 0 ? (
        <EmptyHint>No marks yet. Exams and quizzes appear here once you record them.</EmptyHint>
      ) : (
        <ExamList exams={data.exams} />
      )}
    </SectionCard>
  );
}

export default MarksTab;
