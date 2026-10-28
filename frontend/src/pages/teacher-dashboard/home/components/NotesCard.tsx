import { Link } from 'react-router-dom';

import Card from '../../../../components/Card';
import EmptyState from '../../../../components/EmptyState';
import NotesIcon from '../../../../components/icons/NotesIcon';

import NoteComposer from '../../notes/components/NoteComposer';

/**
 * My notes on Home: a quick box to add one, then pinned notes first and the
 * newest after (HOME_NOTES_SHOWN). Pin, edit and delete live on the notes
 * page, so this card stays calm. Empty state for now: no backend yet.
 */
function NotesCard() {
  return (
    <Card
      title="My notes"
      action={
        <Link
          to="/teacher/notes"
          className="
            rounded-md text-[13px] font-semibold text-primary hover:underline
            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
          "
        >
          View all
        </Link>
      }
    >
      <div className="border-b border-border px-5 py-4">
        <NoteComposer variant="compact" />
      </div>

      <EmptyState
        icon={<NotesIcon className="h-6 w-6" />}
        title="No notes yet"
        description="Reminders for yourself, like things to print or people to call, will show here."
      />
    </Card>
  );
}

export default NotesCard;
