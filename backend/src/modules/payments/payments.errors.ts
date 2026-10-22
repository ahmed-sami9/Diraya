import { AppError } from '../../errors/AppError';

// "2026-10" -> "October 2026", for messages shown as they are.
const monthName = (month: string) =>
  new Date(`${month}-01T12:00:00Z`).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

// Codes match frontend/src/api/payments/payments.ts.
export const PaymentErrors = {
  paymentNotFound: () => new AppError(404, 'PAYMENT_NOT_FOUND', 'This payment no longer exists.'),

  alreadyVoided: () =>
    new AppError(409, 'PAYMENT_ALREADY_VOIDED', 'This payment was already voided.'),

  monthHasPayments: () =>
    new AppError(409, 'MONTH_HAS_PAYMENTS', 'This month has payments. Void them first to skip it.'),

  monthSkipped: (month: string) =>
    new AppError(
      409,
      'MONTH_SKIPPED',
      `${monthName(month)} is skipped for this student. Undo the skip to record a payment.`
    ),

  monthBeforeJoining: (month: string) =>
    new AppError(
      400,
      'MONTH_BEFORE_JOINING',
      `This student hadn’t joined yet in ${monthName(month)}.`
    ),
};
