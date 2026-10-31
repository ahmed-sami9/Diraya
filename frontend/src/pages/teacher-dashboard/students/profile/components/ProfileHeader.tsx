import MoreHorizontalIcon from '../../../../../components/icons/MoreHorizontalIcon';
import PencilIcon from '../../../../../components/icons/PencilIcon';
import OptionsMenu from '../../../../../components/OptionsMenu';
import { formatGroupSchedule } from '../../../../../utils/formatSchedule';
import { getInitials } from '../../../../../utils/initials';

import type { ProfileActions, StudentProfile } from '../profileTypes';

import ContactCard from './ContactCard';

interface ProfileHeaderProps {
  profile: StudentProfile;
  actions: ProfileActions;
}

const joinedFormat = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });

// Share icon (an arrow out of a tray). Inline until it's used in a second
// place; then it moves to components/icons like the others.
function ShareIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <path d="m16 6-4-4-4 4" />
      <path d="M12 2v13" />
    </svg>
  );
}

const secondaryButton = `
  flex h-11 items-center justify-center gap-2 rounded-[10px]
  border border-border bg-surface px-4
  text-sm font-semibold text-ink
  cursor-pointer transition-colors
  hover:bg-surface-hover
  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
`;

// Who the student is and how to reach their family: the top of every tab.
function ProfileHeader({ profile, actions }: ProfileHeaderProps) {
  const { name, code, grade, group, parentPhone, phone, joinedAt } = profile;

  return (
    <section
      aria-label={`About ${name}`}
      className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-5 sm:px-7 sm:py-6"
    >
      <div className="flex flex-wrap items-center gap-4 sm:gap-5">
        <span
          aria-hidden="true"
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-tint text-lg font-extrabold text-primary sm:h-16 sm:w-16 sm:text-[22px]"
        >
          {getInitials(name)}
        </span>

        <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-[28px]">
              {name}
            </h1>
            <span className="rounded-md border border-border bg-page px-2 py-0.5 font-mono text-[13px] text-ink-secondary">
              {code}
            </span>
          </div>

          <p className="text-[15px] text-ink-secondary">
            {grade.name} · <strong className="font-semibold text-ink">{group.name}</strong> ·{' '}
            {formatGroupSchedule(group.sessions)}
          </p>

          {joinedAt && (
            <p className="text-[13px] text-ink-muted">
              Joined {joinedFormat.format(new Date(joinedAt))}
            </p>
          )}
        </div>

        {/* One row on every width: the labels shorten on phones instead. */}
        <div className="flex w-full gap-2.5 sm:w-auto">
          <button
            type="button"
            onClick={actions.shareWithParent}
            className={`${secondaryButton} flex-auto whitespace-nowrap sm:flex-none`}
          >
            <ShareIcon className="h-[18px] w-[18px]" />
            <span className="sm:hidden">Share</span>
            <span className="hidden sm:inline">Share with parent</span>
          </button>

          <button
            type="button"
            onClick={actions.editStudent}
            className={`${secondaryButton} flex-auto whitespace-nowrap sm:flex-none`}
          >
            <PencilIcon className="h-[18px] w-[18px]" />
            Edit
          </button>

          <OptionsMenu
            label={`More options for ${name}`}
            trigger={<MoreHorizontalIcon className="h-[18px] w-[18px]" />}
            buttonClassName="h-11 w-11 rounded-[10px] border border-border bg-surface text-ink-secondary hover:bg-surface-hover"
            items={[
              { label: 'Download PDF report', onSelect: actions.downloadReport },
              { label: 'Move to another group', onSelect: actions.moveToGroup },
            ]}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3 border-t border-border pt-4">
        <ContactCard
          label="Parent’s mobile"
          phone={parentPhone}
          whoLabel="parent"
        />
        {phone && (
          <ContactCard
            label="Student’s mobile"
            phone={phone}
            whoLabel="student"
          />
        )}
      </div>
    </section>
  );
}

export default ProfileHeader;
