import { Link } from 'react-router-dom';

import Card from '../../../../components/Card';

import { teacherActions } from '../../teacherActions';

// Picked from the shared action list: the navbar's main button is always one
// of these, so both stay in step when an action is renamed or moved.
const actions = [
  teacherActions.takeAttendance,
  teacherActions.addStudent,
  teacherActions.addExam,
  teacherActions.recordPayment,
];

/** Shortcuts to the things a teacher does most often. */
function QuickActions() {
  return (
    <Card title="Quick actions">
      <div className="grid grid-cols-2 gap-2.5 p-5">
        {actions.map(({ to, label, icon: ActionIcon }) => (
          <Link
            key={label}
            to={to}
            className="
              flex flex-col items-start gap-2.5
              rounded-xl border border-border bg-surface
              p-3.5 text-sm font-semibold text-ink
              transition-colors
              hover:border-primary/40 hover:bg-primary-tint
              focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
            "
          >
            <ActionIcon className="h-[22px] w-[22px] text-primary" />
            {label}
          </Link>
        ))}
      </div>
    </Card>
  );
}

export default QuickActions;
