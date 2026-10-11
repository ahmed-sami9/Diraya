import { useOutletContext } from 'react-router-dom';

import NotesPanel from '../components/NotesPanel';
import SectionCard from '../components/SectionCard';
import type { ProfileOutletContext } from '../profileTypes';

// /teacher/students/:studentId/notes — all of the teacher's notes.
function NotesTab() {
  const { data, actions } = useOutletContext<ProfileOutletContext>();

  return (
    <div className="max-w-2xl">
      <SectionCard title="Your notes">
        <NotesPanel
          notes={data.notes}
          onAddNote={actions.addNote}
        />
      </SectionCard>
    </div>
  );
}

export default NotesTab;
