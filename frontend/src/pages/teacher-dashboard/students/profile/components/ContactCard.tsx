import MessageIcon from '../../../../../components/icons/MessageIcon';
import { isMobileDevice } from '../../../../../utils/device';
import { formatPhone, toInternational, whatsappChatUrl } from '../../../../../utils/phone';

interface ContactCardProps {
  label: string;
  // Normalized: "01012345678". Empty until the profile loads.
  phone: string;
  // Used in the buttons' names: "Call parent", "Message student on WhatsApp".
  whoLabel: string;
}

const iconLink = `
  flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px]
  border border-border bg-surface text-primary
  transition-colors hover:bg-primary-tint
  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
`;

// A phone number with one-tap Call and WhatsApp. Plain links (tel:, WhatsApp),
// not API calls: the phone or computer opens the right app by itself.
function ContactCard({ label, phone, whoLabel }: ContactCardProps) {
  const hasPhone = phone.length > 0;

  return (
    <div className="flex min-w-0 flex-[1_1_280px] items-center gap-3 rounded-xl bg-page py-2.5 pl-4 pr-3">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          {label}
        </span>
        <span className="truncate text-[15px] font-semibold tabular-nums text-ink">
          {hasPhone ? formatPhone(phone) : '—'}
        </span>
      </div>

      {hasPhone && (
        <>
          <a
            href={`tel:+${toInternational(phone)}`}
            aria-label={`Call ${whoLabel}`}
            className={iconLink}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-[18px] w-[18px]"
            >
              <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
            </svg>
          </a>
          <a
            href={whatsappChatUrl(phone, { onPhone: isMobileDevice() })}
            target="_blank"
            rel="noreferrer"
            aria-label={`Message ${whoLabel} on WhatsApp`}
            className={iconLink}
          >
            <MessageIcon className="h-[18px] w-[18px]" />
          </a>
        </>
      )}
    </div>
  );
}

export default ContactCard;
