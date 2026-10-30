import { useOutletContext } from 'react-router-dom';

import PlusIcon from '../../../../../components/icons/PlusIcon';
import { primaryButtonClasses } from '../../../../../components/formStyles';

import EmptyHint from '../components/EmptyHint';
import PaymentList from '../components/PaymentList';
import SectionCard from '../components/SectionCard';
import { formatMoney } from '../profileFormat';
import type { ProfileOutletContext } from '../profileTypes';

// /teacher/students/:studentId/payments — every month, newest first, plus a
// total of what's still owed. Months paid ahead aren't owed yet, the same
// rule as the payments page.
function PaymentsTab() {
  const { data, actions } = useOutletContext<ProfileOutletContext>();
  const { payments, profile } = data;

  // The summary's fee row is this month (Egypt's calendar, from the server).
  const thisMonth = profile.summary.currentFee?.month;
  const owed = payments
    .filter((month) => !thisMonth || month.month <= thisMonth)
    .reduce((total, month) => total + Math.max(month.amountDue - month.amountPaid, 0), 0);

  return (
    <SectionCard
      title="Payments"
      subtitle={
        profile.monthlyFee !== null ? `${formatMoney(profile.monthlyFee)} / month` : undefined
      }
      action={
        <button
          type="button"
          onClick={actions.recordPayment}
          className={`${primaryButtonClasses} flex items-center gap-2`}
        >
          <PlusIcon className="h-[18px] w-[18px]" />
          Record payment
        </button>
      }
    >
      {owed > 0 && (
        <p className="rounded-[10px] bg-warning-tint px-3.5 py-2.5 text-sm font-semibold text-warning">
          {formatMoney(owed)} still owed
        </p>
      )}

      {payments.length === 0 ? (
        <EmptyHint>No payments recorded yet.</EmptyHint>
      ) : (
        <PaymentList payments={payments} />
      )}
    </SectionCard>
  );
}

export default PaymentsTab;
