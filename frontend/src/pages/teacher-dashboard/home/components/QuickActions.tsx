import { Link } from 'react-router-dom';

import Card from '../../../../components/Card';

import UserPlusIcon from '../../../../components/icons/UserPlusIcon';
import ExamsIcon from '../../../../components/icons/ExamsIcon';
import PlusIcon from '../../../../components/icons/PlusIcon';
import PaymentsIcon from '../../../../components/icons/PaymentsIcon';

const actions = [
  { to: '/teacher/students', label: 'Add student', icon: UserPlusIcon },
  { to: '/teacher/exams', label: 'Create quiz', icon: PlusIcon },
  { to: '/teacher/exams', label: 'Record marks', icon: ExamsIcon },
  { to: '/teacher/payments', label: 'Record payment', icon: PaymentsIcon },
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
