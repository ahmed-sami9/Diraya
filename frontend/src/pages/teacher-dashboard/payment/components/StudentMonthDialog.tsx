import { useId, useState } from 'react';
import { Link } from 'react-router-dom';

import DialogShell from '../../../../components/DialogShell';
import {
  formErrorClasses,
  inputClasses,
  primaryButtonClasses,
  secondaryButtonClasses,
} from '../../../../components/formStyles';
import { METHODS, STATUS_STYLE, formatMoney, formatMonth } from '../paymentsHelpers';
import type { PaymentStudent, StudentMonth } from '../../../../api/payments/payments';

interface StudentMonthDialogProps {
  student: PaymentStudent;
  gradeName: string;
  groupName: string;
  info: StudentMonth;
  onRecordPayment: () => void;
  // Each one saves on the server, then the page shows the fresh numbers.
  // They throw if the server refuses, so the dialog can say why.
  onVoid: (paymentId: string, reason: string) => Promise<void>;
  onSkip: (reason: string) => Promise<void>;
  onUnskip: () => Promise<void>;
  onSaveNote: (text: string) => Promise<void>;
  onClose: () => void;
}

const dayFormat = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const formatDay = (day: string) => dayFormat.format(new Date(`${day}T12:00:00Z`));
const methodLabel = (value: string) => METHODS.find((m) => m.value === value)?.label ?? value;

// One student, one month: the math (fee, discount, due, paid, left), every
// payment for it (voided ones stay visible), a note, and the actions.
//
// Two small "are you sure, and why?" steps live inline instead of in a
// second dialog: voiding a payment and skipping the month both need a
// reason, and a dialog on top of a dialog is hard to use on a phone.
function StudentMonthDialog({
  student,
  gradeName,
  groupName,
  info,
  onRecordPayment,
  onVoid,
  onSkip,
  onUnskip,
  onSaveNote,
  onClose,
}: StudentMonthDialogProps) {
  const id = useId();
  // Which inline step is open: voiding one payment, or skipping the month.
  const [step, setStep] = useState<{ kind: 'void'; paymentId: string } | { kind: 'skip' } | null>(
    null
  );
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [note, setNote] = useState(info.note ?? '');
  // One action at a time; its error (from the server) is shown at the top.
  const [isBusy, setIsBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const noteChanged = note.trim() !== (info.note ?? '');

  const status = STATUS_STYLE[info.status];
  const hasLivePayments = info.payments.some((p) => !p.voided);
  const discount = info.gradeFee - info.due;

  const openStep = (next: typeof step) => {
    setStep(next);
    setReason('');
    setReasonError(null);
  };

  // Runs one server action: busy while it runs, its error shown if it fails.
  // Returns whether it worked, so the caller can close its inline step.
  const run = async (action: () => Promise<void>) => {
    if (isBusy) return false;
    setIsBusy(true);
    setActionError(null);
    try {
      await action();
      return true;
    } catch (error) {
      console.error(error);
      setActionError(
        error instanceof Error ? error.message : 'Something went wrong. Please try again.'
      );
      return false;
    } finally {
      setIsBusy(false);
    }
  };

  const confirmStep = async () => {
    if (!reason.trim()) {
      setReasonError('Write a short reason. It stays on record.');
      document.getElementById(`${id}-reason`)?.focus();
      return;
    }
    const current = step;
    const done = await run(() =>
      current?.kind === 'void' ? onVoid(current.paymentId, reason.trim()) : onSkip(reason.trim())
    );
    if (done) setStep(null);
  };

  const reasonBox = (label: string, confirmLabel: string) => (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-page p-3">
      <label
        htmlFor={`${id}-reason`}
        className="text-sm font-semibold text-ink"
      >
        {label}
      </label>
      <input
        id={`${id}-reason`}
        type="text"
        value={reason}
        maxLength={200}
        autoFocus
        onChange={(event) => {
          setReason(event.target.value);
          setReasonError(null);
        }}
        aria-invalid={Boolean(reasonError)}
        aria-describedby={reasonError ? `${id}-reason-error` : undefined}
        className={inputClasses(Boolean(reasonError))}
      />
      {reasonError && (
        <p
          id={`${id}-reason-error`}
          className="text-[13px] text-danger"
        >
          {reasonError}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => setStep(null)}
          className={secondaryButtonClasses}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={confirmStep}
          disabled={isBusy}
          aria-busy={isBusy}
          className={primaryButtonClasses}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );

  return (
    <DialogShell
      title={`${student.name} · ${formatMonth(info.month)}`}
      description={
        <>
          {gradeName} · {groupName} ·{' '}
          <Link
            to={`/teacher/students/${student.id}/payments`}
            className="font-semibold text-primary hover:underline"
          >
            Open profile
          </Link>
        </>
      }
      onRequestClose={onClose}
      maxWidthClassName="max-w-[500px]"
    >
      <div className="flex flex-col gap-5">
        {actionError && (
          <p
            role="alert"
            className={formErrorClasses}
          >
            {actionError}
          </p>
        )}

        {/* The math, line by line, so "why do I owe 75?" answers itself. */}
        {info.status === 'not-due' ? (
          <p className="rounded-xl bg-page p-4 text-sm text-ink-secondary">
            {info.notDueReason === 'before-joining'
              ? `${student.name} joined after this month, so nothing is due.`
              : 'This month hasn’t started. Payments made ahead will show here.'}
          </p>
        ) : (
          <dl className="flex flex-col gap-2 rounded-xl bg-page p-4 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-secondary">Grade fee this month</dt>
              <dd className="tabular-nums">{formatMoney(info.gradeFee)}</dd>
            </div>
            {info.status === 'skipped' ? (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-secondary">
                  Skipped: <span className="text-ink">“{info.skipReason}”</span>
                </dt>
                <dd className="tabular-nums">− {formatMoney(info.gradeFee)}</dd>
              </div>
            ) : (
              discount > 0 && (
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-secondary">
                    Discount −{info.discountPercent}%
                    {student.discountReason && (
                      <span className="block text-xs text-ink-muted">{student.discountReason}</span>
                    )}
                  </dt>
                  <dd className="text-primary tabular-nums">− {formatMoney(discount)}</dd>
                </div>
              )
            )}
            <div className="h-px bg-border-strong" />
            <div className="flex justify-between gap-3 font-bold">
              <dt>Due</dt>
              <dd className="tabular-nums">{formatMoney(info.due)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-secondary">Paid</dt>
              <dd className="font-semibold text-success tabular-nums">{formatMoney(info.paid)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="font-bold">Left</dt>
              <dd className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${status.pill}`}>
                  {status.label}
                </span>
                <span className="text-lg font-extrabold tabular-nums">
                  {formatMoney(info.left)}
                </span>
              </dd>
            </div>
          </dl>
        )}

        <section
          aria-labelledby={`${id}-payments`}
          className="flex flex-col gap-2"
        >
          <h3
            id={`${id}-payments`}
            className="text-[13px] font-bold uppercase tracking-wide text-ink-muted"
          >
            Payments for this month
          </h3>
          {info.payments.length === 0 ? (
            <p className="text-sm text-ink-secondary">None yet.</p>
          ) : (
            <ul className="overflow-hidden rounded-xl border border-border">
              {info.payments.map((payment) => (
                <li
                  key={payment.id}
                  className={`flex flex-col gap-2 border-b border-border-strong px-3.5 py-3 last:border-b-0 ${payment.voided ? 'bg-page' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span
                        className={`text-[15px] tabular-nums ${payment.voided ? 'font-semibold text-ink-muted line-through' : 'font-bold text-ink'}`}
                      >
                        {formatMoney(payment.amount)} · {methodLabel(payment.method)}
                      </span>
                      <span className="text-xs text-ink-muted">
                        {formatDay(payment.paidOn)}
                        {payment.note && ` · “${payment.note}”`}
                      </span>
                      {payment.voided && (
                        <span className="text-xs text-ink-secondary">
                          <strong>Voided {formatDay(payment.voided.on)}:</strong> “
                          {payment.voided.reason}”
                        </span>
                      )}
                    </span>
                    {!payment.voided && step === null && (
                      <button
                        type="button"
                        onClick={() => openStep({ kind: 'void', paymentId: payment.id })}
                        className="h-9 shrink-0 cursor-pointer rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-ink-secondary hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        Void
                      </button>
                    )}
                  </div>
                  {step?.kind === 'void' &&
                    step.paymentId === payment.id &&
                    reasonBox('Why void this payment?', 'Void payment')}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-ink-muted">
            Payments are never deleted. A voided one stops counting but stays here, with why.
          </p>
        </section>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={`${id}-note`}
            className="text-sm font-semibold text-ink"
          >
            Note for this month
          </label>
          <textarea
            id={`${id}-note`}
            rows={2}
            maxLength={500}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="e.g. will pay the rest on Saturday"
            className={`${inputClasses(false)} h-auto resize-y py-2.5`}
          />
          {noteChanged && (
            <button
              type="button"
              onClick={() => run(() => onSaveNote(note))}
              disabled={isBusy}
              className="self-end text-sm font-semibold text-primary hover:underline"
            >
              Save note
            </button>
          )}
        </div>

        {step?.kind === 'skip' &&
          reasonBox(`Why skip ${formatMonth(info.month)}?`, 'Skip this month')}

        {step === null && info.status !== 'not-due' && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2.5">
              {info.status !== 'skipped' && info.left > 0 && (
                <button
                  type="button"
                  onClick={onRecordPayment}
                  className={`${primaryButtonClasses} flex-[1_1_200px]`}
                >
                  Record the {formatMoney(info.left)} left
                </button>
              )}
              {info.status === 'skipped' ? (
                <button
                  type="button"
                  onClick={() => run(onUnskip)}
                  disabled={isBusy}
                  className={`${secondaryButtonClasses} flex-[1_1_160px]`}
                >
                  Undo skip
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => openStep({ kind: 'skip' })}
                  disabled={hasLivePayments}
                  className={`${secondaryButtonClasses} flex-[1_1_160px]`}
                >
                  Skip this month…
                </button>
              )}
            </div>
            {/* Say why a button is off, instead of leaving it a mystery. */}
            {info.status !== 'skipped' && hasLivePayments && (
              <p className={`${formErrorClasses} border-0 bg-page text-xs text-ink-secondary`}>
                This month has payments. Void them first to skip it.
              </p>
            )}
          </div>
        )}
      </div>
    </DialogShell>
  );
}

export default StudentMonthDialog;
