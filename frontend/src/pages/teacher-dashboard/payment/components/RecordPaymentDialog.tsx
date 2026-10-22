import { useId, useMemo, useRef, useState, type FormEvent } from 'react';

import DialogShell from '../../../../components/DialogShell';
import {
  formErrorClasses,
  inputClasses,
  primaryButtonClasses,
  secondaryButtonClasses,
} from '../../../../components/formStyles';
import type { PaymentMethod } from '../../../../api/payments/payments';
import { useGradePayments } from '../../../../hooks/payments/usePayments';
import { isValidIsoDay, todayInCairo } from '../../../../utils/cairoDate';
import {
  METHODS,
  currentMonth,
  formatMoney,
  monthName,
  splitAmount,
  type IsoMonth,
} from '../paymentsHelpers';

interface RecordPaymentDialogProps {
  // The teacher's grades (id and name are enough here).
  grades: { id: string; name: string }[];
  // The grade the page is showing, if any: picked already, still changeable.
  defaultGradeId?: string | null;
  // Opened from a student's month: start with them and that month.
  initial?: { studentId: string; month: IsoMonth };
  // After a successful save, so the page can refresh what it shows.
  onRecorded?: () => void;
  onClose: () => void;
}

type Field = 'grade' | 'student' | 'months' | 'amount' | 'paidOn';
type FieldErrors = Partial<Record<Field, string>>;

const AMOUNT_LIMIT = 100_000;

// "Record payment": money received from one student, for one or more months.
//
// Grade first, then student. Picking a grade loads that grade's payments
// (the same request as the grade view), which gives both the student list
// and what each month still needs, so the amount can fill itself in. The
// teacher can type a different amount (a part payment); a line under the
// field shows how it will be split. The SERVER does the real split.
function RecordPaymentDialog({
  grades,
  defaultGradeId = null,
  initial,
  onRecorded,
  onClose,
}: RecordPaymentDialogProps) {
  const id = useId();
  const gradeRef = useRef<HTMLSelectElement>(null);
  const studentRef = useRef<HTMLSelectElement>(null);

  // Starts from the page's grade, or the only grade.
  const [gradeId, setGradeId] = useState(
    defaultGradeId ?? (grades.length === 1 ? grades[0]!.id : '')
  );
  const gradeData = useGradePayments(gradeId || null, currentMonth());
  const data = gradeData.state.status === 'ready' ? gradeData.state.data : null;
  const grade = grades.find((g) => g.id === gradeId);

  // Made once per dialog: the server saves a repeated requestId once, so
  // a double click (or a retry after a lost answer) can't pay twice.
  const [requestId] = useState(() => crypto.randomUUID());

  const [studentId, setStudentId] = useState(initial?.studentId ?? '');
  const [months, setMonths] = useState<IsoMonth[]>(initial ? [initial.month] : []);
  // null = "follow what the months need". Same idea as the exam's pass mark:
  // derived until the teacher types their own.
  const [customAmount, setCustomAmount] = useState<string | null>(null);
  const [paidOn, setPaidOn] = useState(todayInCairo());
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const students = useMemo(
    () => [...(data?.students ?? [])].sort((a, b) => a.student.name.localeCompare(b.student.name)),
    [data]
  );
  const row = students.find((item) => item.student.id === studentId);

  // The months on offer are the grade's months (three back, this one, one
  // ahead), each with what it still needs.
  const options = useMemo(() => {
    if (!row) return [];
    return row.cells.map((info) => {
      const isFuture = info.notDueReason === 'future';
      const needs = isFuture ? info.due : info.left;
      // Nothing to pay for: before they joined, skipped, or fully paid.
      const disabled =
        info.notDueReason === 'before-joining' || info.status === 'skipped' || needs === 0;
      const hint =
        info.notDueReason === 'before-joining'
          ? 'not joined'
          : info.status === 'skipped'
            ? 'skipped'
            : needs === 0
              ? 'paid'
              : isFuture
                ? `${needs} ahead`
                : `${needs} due`;
      return { month: info.month, needs, disabled, hint };
    });
  }, [row]);

  const needed = options
    .filter((option) => months.includes(option.month))
    .reduce((sum, option) => sum + option.needs, 0);
  const amountText = customAmount ?? (needed > 0 ? String(needed) : '');
  const amount = /^\d+$/.test(amountText.trim()) ? Number(amountText.trim()) : null;

  // A preview only: the server splits it for real.
  const split =
    amount && months.length > 0
      ? splitAmount(
          options.filter((option) => months.includes(option.month)),
          amount
        )
      : [];

  // Why the student list is empty or locked, in words.
  const studentsMessage = !grade
    ? 'Pick a grade first'
    : gradeData.state.status === 'loading'
      ? 'Loading students…'
      : gradeData.state.status === 'ready'
        ? 'Choose a student…'
        : 'Couldn’t load students';
  const loadError =
    gradeData.state.status === 'error'
      ? gradeData.state.error instanceof Error
        ? gradeData.state.error.message
        : 'Couldn’t load this grade’s students.'
      : null;

  const clearError = (field: Field) => {
    if (errors[field]) setErrors((previous) => ({ ...previous, [field]: undefined }));
  };

  const toggleMonth = (month: IsoMonth) => {
    setMonths((previous) =>
      previous.includes(month) ? previous.filter((m) => m !== month) : [...previous, month]
    );
    // The amount follows the months (unless typed), so its old error is
    // stale too.
    setErrors((previous) => ({
      ...previous,
      months: undefined,
      ...(customAmount === null ? { amount: undefined } : {}),
    }));
  };

  const requestClose = () => {
    if (!isSaving) onClose();
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSaving) return;

    const next: FieldErrors = {};
    if (!grade) next.grade = 'Pick the grade first.';
    else if (!row) next.student = 'Pick the student who paid.';
    if (months.length === 0) next.months = 'Pick at least one month.';
    if (amount === null || amount < 1) next.amount = 'A whole amount in pounds, like 350.';
    else if (amount > AMOUNT_LIMIT) next.amount = 'That’s more than any fee. Check the amount.';
    if (!isValidIsoDay(paidOn) || paidOn > todayInCairo())
      next.paidOn = 'Pick the day it was paid (today or before).';

    const firstInvalid = (['grade', 'student', 'months', 'amount', 'paidOn'] as const).find(
      (f) => next[f]
    );
    if (firstInvalid) {
      setErrors(next);
      document.getElementById(`${id}-${firstInvalid}`)?.focus();
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      await gradeData.record({
        requestId,
        studentId: row!.student.id,
        months,
        amount: amount!,
        paidOn,
        method,
        note: note.trim() || null,
      });
      onRecorded?.();
      onClose();
    } catch (error) {
      console.error(error);
      setFormError(
        error instanceof Error ? error.message : 'Something went wrong. Please try again.'
      );
      setIsSaving(false);
    }
  };

  const fieldError = (field: Field) =>
    errors[field] ? (
      <p
        id={`${id}-${field}-error`}
        className="text-[13px] text-danger"
      >
        {errors[field]}
      </p>
    ) : null;

  const describedBy = (field: Field) => (errors[field] ? `${id}-${field}-error` : undefined);
  const labelClasses = 'text-sm font-semibold text-ink';

  return (
    <DialogShell
      title="Record payment"
      description="Money received from a student, for one or more months."
      onRequestClose={requestClose}
      isBusy={isSaving}
      initialFocusRef={initial ? undefined : gradeId ? studentRef : gradeRef}
      maxWidthClassName="max-w-[520px]"
    >
      <form
        noValidate
        onSubmit={handleSubmit}
        className="flex flex-col gap-5"
      >
        {formError && (
          <p
            role="alert"
            className={formErrorClasses}
          >
            {formError}
          </p>
        )}

        {/* Grade, then student, side by side from tablet width. */}
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] sm:gap-3">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={`${id}-grade`}
              className={labelClasses}
            >
              Grade
            </label>
            <select
              ref={gradeRef}
              id={`${id}-grade`}
              value={gradeId}
              onChange={(event) => {
                setGradeId(event.target.value);
                // A new grade means new students: start the rest over.
                setStudentId('');
                setMonths([]);
                setCustomAmount(null);
                setErrors({});
              }}
              disabled={isSaving}
              aria-invalid={Boolean(errors.grade)}
              aria-describedby={describedBy('grade')}
              className={`${inputClasses(Boolean(errors.grade))} cursor-pointer`}
            >
              <option value="">Choose a grade…</option>
              {grades.map((option) => (
                <option
                  key={option.id}
                  value={option.id}
                >
                  {option.name}
                </option>
              ))}
            </select>
            {fieldError('grade')}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={`${id}-student`}
              className={labelClasses}
            >
              Student
            </label>
            {/* Grouped by group: the teacher thinks "Group A, Salma". A
                native select is type-to-jump on a keyboard, a proper picker
                on phones, and accessible for free. */}
            <select
              ref={studentRef}
              id={`${id}-student`}
              value={studentId}
              onChange={(event) => {
                setStudentId(event.target.value);
                setMonths([]);
                setCustomAmount(null);
                clearError('student');
              }}
              disabled={isSaving || !data}
              aria-invalid={Boolean(errors.student)}
              aria-describedby={describedBy('student')}
              className={`${inputClasses(Boolean(errors.student))} cursor-pointer`}
            >
              <option value="">{studentsMessage}</option>
              {data?.groups.map((group) => (
                <optgroup
                  key={group.id}
                  label={group.name}
                >
                  {students
                    .filter((item) => item.student.groupId === group.id)
                    .map(({ student: s }) => (
                      <option
                        key={s.id}
                        value={s.id}
                      >
                        {s.name} · {s.code}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
            {fieldError('student') ??
              (loadError && <p className="text-[13px] text-danger">{loadError}</p>)}
          </div>
        </div>

        <fieldset
          disabled={isSaving || !row}
          className="flex flex-col gap-1.5"
        >
          <legend className={`${labelClasses} mb-1.5`}>For which months</legend>
          {!row ? (
            <p className="text-[13px] text-ink-muted">Pick a student to see their months.</p>
          ) : (
            <div
              id={`${id}-months`}
              tabIndex={-1}
              aria-describedby={describedBy('months')}
              className="grid grid-cols-3 gap-2 sm:grid-cols-6"
            >
              {options.map((option) => {
                const checked = months.includes(option.month);
                return (
                  <label
                    key={option.month}
                    className={`
                      relative flex h-14 flex-col items-center justify-center gap-0.5 rounded-[10px] border text-center
                      transition-colors
                      has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary
                      ${
                        option.disabled
                          ? 'cursor-not-allowed border-border bg-page text-ink-muted'
                          : checked
                            ? 'cursor-pointer border-primary bg-primary-tint text-primary'
                            : 'cursor-pointer border-border bg-surface text-ink hover:bg-surface-hover'
                      }
                    `}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={option.disabled}
                      onChange={() => toggleMonth(option.month)}
                      className="sr-only"
                    />
                    <span className="text-sm font-bold">{monthName(option.month).slice(0, 3)}</span>
                    <span className="text-[11px] font-semibold">{option.hint}</span>
                  </label>
                );
              })}
            </div>
          )}
          {fieldError('months')}
        </fieldset>

        <div className="grid gap-5 sm:grid-cols-2 sm:gap-3">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={`${id}-amount`}
              className={labelClasses}
            >
              Amount (EGP)
            </label>
            <input
              id={`${id}-amount`}
              type="text"
              inputMode="numeric"
              value={amountText}
              onChange={(event) => {
                setCustomAmount(event.target.value);
                clearError('amount');
              }}
              disabled={isSaving}
              aria-invalid={Boolean(errors.amount)}
              aria-describedby={errors.amount ? `${id}-amount-error` : `${id}-amount-split`}
              className={`${inputClasses(Boolean(errors.amount))} text-base font-bold`}
            />
            {errors.amount
              ? fieldError('amount')
              : split.length > 0 && (
                  <p
                    id={`${id}-amount-split`}
                    className="text-xs text-ink-muted"
                  >
                    {split
                      .map((part) => `${monthName(part.month)} ${formatMoney(part.amount)}`)
                      .join(' + ')}
                  </p>
                )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={`${id}-paidOn`}
              className={labelClasses}
            >
              Paid on
            </label>
            <input
              id={`${id}-paidOn`}
              type="date"
              value={paidOn}
              max={todayInCairo()}
              onChange={(event) => {
                setPaidOn(event.target.value);
                clearError('paidOn');
              }}
              disabled={isSaving}
              aria-invalid={Boolean(errors.paidOn)}
              aria-describedby={describedBy('paidOn')}
              className={inputClasses(Boolean(errors.paidOn))}
            />
            {fieldError('paidOn')}
          </div>
        </div>

        <fieldset
          disabled={isSaving}
          className="flex flex-col gap-1.5"
        >
          <legend className={`${labelClasses} mb-1.5`}>How</legend>
          <div className="grid grid-cols-3 gap-2">
            {METHODS.map((option) => (
              <label
                key={option.value}
                className={`
                  flex h-11 cursor-pointer items-center justify-center gap-2 rounded-[10px] border px-1 text-center text-[13px] transition-colors sm:text-sm
                  has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary
                  ${
                    method === option.value
                      ? 'border-primary bg-primary-tint font-bold text-primary'
                      : 'border-border font-semibold text-ink hover:bg-surface-hover'
                  }
                `}
              >
                <input
                  type="radio"
                  name={`${id}-method`}
                  value={option.value}
                  checked={method === option.value}
                  onChange={() => setMethod(option.value)}
                  className="sr-only"
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={`${id}-note`}
            className={labelClasses}
          >
            Note <span className="font-normal text-ink-muted">(optional)</span>
          </label>
          <input
            id={`${id}-note`}
            type="text"
            value={note}
            maxLength={200}
            onChange={(event) => setNote(event.target.value)}
            disabled={isSaving}
            placeholder="e.g. paid by her uncle"
            className={inputClasses(false)}
          />
        </div>

        <div className="flex flex-wrap justify-end gap-2.5">
          <button
            type="button"
            onClick={requestClose}
            disabled={isSaving}
            className={secondaryButtonClasses}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            aria-busy={isSaving}
            className={primaryButtonClasses}
          >
            {isSaving ? 'Saving…' : amount ? `Record ${formatMoney(amount)}` : 'Record payment'}
          </button>
        </div>
      </form>
    </DialogShell>
  );
}

export default RecordPaymentDialog;
