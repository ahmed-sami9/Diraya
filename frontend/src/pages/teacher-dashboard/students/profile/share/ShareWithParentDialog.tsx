import { useId, useRef, useState } from 'react';

import DialogShell from '../../../../../components/DialogShell';
import { primaryButtonClasses, secondaryButtonClasses } from '../../../../../components/formStyles';
import MessageIcon from '../../../../../components/icons/MessageIcon';
import { isMobileDevice } from '../../../../../utils/device';
import { formatPhone, whatsappChatUrl } from '../../../../../utils/phone';
import type { StudentProfile } from '../profileTypes';

import { buildParentMessage } from './parentMessage';

interface ShareWithParentDialogProps {
  profile: StudentProfile;
  teacherName: string;
  onClose: () => void;
  // The PDF instead: for a teacher who prefers a file, or when WhatsApp won't open.
  onDownloadReport: () => void;
}

type Status = 'idle' | 'opened' | 'copied' | 'copy-failed';

// Shows the update for the parent, editable, then hands it to WhatsApp.
//
// The teacher presses Send in WhatsApp, not here: the app never learns
// whether it was sent, so the status only says what really happened.
function ShareWithParentDialog({
  profile,
  teacherName,
  onClose,
  onDownloadReport,
}: ShareWithParentDialogProps) {
  const [text, setText] = useState(() => buildParentMessage(profile, teacherName));
  const [status, setStatus] = useState<Status>('idle');
  // Once per dialog: a device doesn't change while it's open.
  const [onPhone] = useState(() => isMobileDevice());

  const messageId = useId();
  const hintId = useId();
  const openRef = useRef<HTMLAnchorElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const isEmpty = text.trim() === '';
  // Stored empty for students added before the number was required.
  const hasPhone = profile.parentPhone !== '';
  const whatsappName = onPhone ? 'WhatsApp' : 'WhatsApp Web';

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus('copied');
    } catch {
      // No clipboard (an old browser, or a page not on https): select it instead.
      textRef.current?.select();
      setStatus('copy-failed');
    }
  };

  const statusText: Record<Status, string> = {
    idle: '',
    opened: onPhone
      ? 'WhatsApp opened. Press Send there to deliver it.'
      : 'WhatsApp Web opened in a new tab. Press Send there to deliver it.',
    copied: 'Message copied. Paste it into any chat.',
    'copy-failed': 'Couldn’t copy automatically. The message is selected: copy it yourself.',
  };

  return (
    <DialogShell
      title="Share with parent"
      description={
        hasPhone
          ? `Opens ${whatsappName} with this message ready. You check it and press Send.`
          : 'No parent’s number is saved for this student. Copy the message and send it yourself.'
      }
      onRequestClose={onClose}
      initialFocusRef={openRef}
      maxWidthClassName="max-w-[560px]"
    >
      <div className="flex flex-col gap-4">
        {hasPhone && (
          <p className="flex flex-wrap items-baseline gap-x-2 rounded-[10px] bg-page px-3.5 py-2.5 text-sm">
            <span className="font-semibold text-ink-secondary">To</span>
            <span className="font-semibold text-ink">Parent of {profile.name}</span>
            <span className="tabular-nums text-ink-muted">{formatPhone(profile.parentPhone)}</span>
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={messageId}
            className="text-sm font-semibold text-ink"
          >
            Message
          </label>
          <textarea
            id={messageId}
            ref={textRef}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setStatus('idle');
            }}
            aria-describedby={hintId}
            rows={10}
            className="w-full resize-y rounded-[10px] border border-border bg-surface px-3.5 py-3 text-sm leading-relaxed text-ink outline-none transition-colors hover:border-ink-muted/40 focus:border-primary focus:ring-[3px] focus:ring-primary-tint"
          />
          <p
            id={hintId}
            className="text-xs text-ink-muted"
          >
            You can edit it. *Words between stars* show in bold on WhatsApp.
          </p>
        </div>

        {/* Polite: read out after the click, without interrupting. */}
        <p
          role="status"
          className={`text-sm font-semibold ${status === 'copy-failed' ? 'text-warning' : 'text-success'} ${status === 'idle' ? 'sr-only' : ''}`}
        >
          {statusText[status]}
        </p>

        {/* Phones: the main action on top, full width, where the thumb is. */}
        <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={copyMessage}
            disabled={isEmpty}
            className={secondaryButtonClasses}
          >
            Copy message
          </button>

          {!hasPhone ? null : isEmpty ? (
            <button
              type="button"
              disabled
              className={`${primaryButtonClasses} flex items-center justify-center gap-2`}
            >
              <MessageIcon className="h-[18px] w-[18px]" />
              Open {whatsappName}
            </button>
          ) : (
            // A real link, not window.open: browsers never block a link the
            // teacher clicked, and it can be long-pressed or opened in a tab.
            <a
              ref={openRef}
              href={whatsappChatUrl(profile.parentPhone, { text, onPhone })}
              target="_blank"
              rel="noreferrer"
              onClick={() => setStatus('opened')}
              className={`${primaryButtonClasses} flex items-center justify-center gap-2`}
            >
              <MessageIcon className="h-[18px] w-[18px]" />
              Open {whatsappName}
            </a>
          )}
        </div>

        <p className="border-t border-border pt-4 text-center text-sm text-ink-secondary">
          Prefer a file?{' '}
          <button
            type="button"
            onClick={onDownloadReport}
            className="cursor-pointer rounded font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Download PDF report
          </button>
        </p>
      </div>
    </DialogShell>
  );
}

export default ShareWithParentDialog;
