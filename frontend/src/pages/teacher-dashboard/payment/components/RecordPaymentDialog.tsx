import { useId, useMemo, useRef, useState, type FormEvent } from 'react';

import DialogShell from '../../../../components/DialogShell';
import {
  formErrorClasses,
  inputClasses,
  primaryButtonClasses,
  secondaryButtonClasses,
} from '../../../../components/formStyles';
import { isValidIsoDay, todayInCairo } from '../../../../utils/cairoDate';
import type { PaymentMethod } from '../PaymentsPage';
import {
  METHODS,
  addMonths,
  currentMonth,
  formatMoney,
  monthName,
  type IsoMonth,
} from '../paymentsHelpers';
import {
  splitAmount,
  studentMonth,
  type RecordPaymentInput,
  type SampleGrade,
  type SampleStudent,
  usePaymentsSample,
} from '../sample/samplePaymentsStore';

interface RecordPaymentDialogProps {
  grades: SampleGrade[];
  // The grade the page is showing, if any: picked already, still changeable.
  defaultGradeId?: string | null;
  // Opened from a student's month: start with them and that month.
  initial?: { studentId: string; month: IsoMonth };
  // Throws if it fails, so the dialog can show why.
  onSubmit: (input: RecordPaymentInput) => Promise<void> | void;
  onClose: () => void;
}

type Field = 'grade' | 'student' | 'months' | 'amount' | 'paidOn';
type FieldErrors = Partial<Record<Field, string>>;

const AMOUNT_LIMIT = 100_000;

// "Record payment": money received from one student, for one or more months.
//
// The months show what each still needs, so the amount can fill itself in.
// The teacher can type a different amount (a part payment); a note under the
// field shows exactly how it will be split across the months.
function RecordPaymentDialog({
  grades,
  defaultGradeId = null,
  initial,
  onSubmit,
  onClose,
}: RecordPaymentDialogProps) {
  const { state } = usePaymentsSample();
  const id = useId();
  const gradeRef = useRef<HTMLSelectElement>(null);
  const studentRef = useRef<HTMLSelectElement>(null);

  // Grade first, then student: a short list instead of everyone at once.
  // Starts from the student's grade, the page's grade, or the only grade.
  const [gradeId, setGradeId] = useState(
    (initial && state.students.find((s) => s.id === initial.studentId)?.gradeId) ??
      defaultGradeId ??
      (grades.length === 1 ? grades[0]!.id : '')
  );

  const students = useMemo(
    () =>
      state.students
        .filter((s) => s.gradeId === gradeId)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [state.students, gradeId]
  );
  const grade = grades.find((g) => g.id === gradeId);

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

  const student: SampleStudent | undefined = students.find((s) => s.id === studentId);

  // The months on offer: three back, this one, two ahead (paying ahead is
  // common). Each with what it still needs.
  const options = useMemo(() => {
    if (!student) return [];
    return [-3, -2, -1, 0, 1, 2].map((offset) => {
      const month = addMonths(currentMonth(), offset);
      const info = studentMonth(state, student, month);
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
      return { month, needs, disabled, hint };
    });
  }, [state, student]);

  const needed = options
    .filter((option) => months.includes(option.month))
    .reduce((sum, option) => sum + option.needs, 0);
  const amountText = customAmount ?? (needed > 0 ? String(needed) : '');
  const amount = /^\d+$/.test(amountText.trim()) ? Number(amountText.trim()) : null;

  const split =
    student && amount && months.length > 0
      ? splitAmount({ studentId: student.id, months, amount }, state)
      : [];

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
    else if (!student) next.student = 'Pick the student who paid.';
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
      await onSubmit({
        studentId: student!.id,
        months,
        amount: amount!,
        paidOn,
        method,
        note: note.trim() || null,
      });
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
              disabled={isSaving || !grade}
              aria-invalid={Boolean(errors.student)}
              aria-describedby={describedBy('student')}
              className={`${inputClasses(Boolean(errors.student))} cursor-pointer`}
            >
              <option value="">{grade ? 'Choose a student…' : 'Pick a grade first'}</option>
              {grade?.groups.map((group) => (
                <optgroup
                  key={group.id}
                  label={group.name}
                >
                  {students
                    .filter((s) => s.groupId === group.id)
                    .map((s) => (
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
            {fieldError('student')}
          </div>
        </div>

        <fieldset
          disabled={isSaving || !student}
          className="flex flex-col gap-1.5"
        >
          <legend className={`${labelClasses} mb-1.5`}>For which months</legend>
          {!student ? (
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
