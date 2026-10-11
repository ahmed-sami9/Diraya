import { PAYMENT_STATUS, formatMoney, formatMonth, formatShortDate } from '../profileFormat';
import type { PaymentMonth } from '../profileTypes';

// One row per month: what was paid, what's left, and a status badge. The
// "left" amount is computed here (due - paid) rather than sent, so it can
// never disagree with the two numbers it comes from.
function PaymentList({ payments }: { payments: PaymentMonth[] }) {
  return (
    <ul aria-label="Monthly fees">
      {payments.map((payment) => {
        const left = payment.amountDue - payment.amountPaid;
        const badge = PAYMENT_STATUS[payment.status];

        return (
          <li
            key={payment.month}
            className="flex items-center justify-between gap-3 border-t border-border-strong py-3"
          >
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[15px] font-semibold text-ink">
                {formatMonth(payment.month)}
              </span>
              <span className="text-xs text-ink-muted">
                {payment.status === 'paid'
                  ? formatMoney(payment.amountPaid)
                  : `${formatMoney(payment.amountPaid)} of ${formatMoney(payment.amountDue)}`}
                {payment.lastPaidAt && ` · ${formatShortDate(payment.lastPaidAt)}`}
                {left > 0 && (
                  <span className="font-semibold text-warning"> · {formatMoney(left)} left</span>
                )}
              </span>
            </span>

            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${badge.classes}`}
            >
              {badge.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default PaymentList;
