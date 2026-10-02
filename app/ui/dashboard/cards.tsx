import { BanknotesIcon, ClockIcon, UserGroupIcon, InboxIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { fetchCardData } from '@/app/lib/data';
import { Range, formatChange } from '@/app/lib/dashboard';
import { CardStat } from '@/app/lib/definitions';
import { formatCurrency } from '@/app/lib/utils';

const iconMap = {
  collected: BanknotesIcon,
  customers: UserGroupIcon,
  pending: ClockIcon,
  invoices: InboxIcon,
};

export default async function CardWrapper({ range }: { range: Range }) {
  const { collected, pending, invoices, customers } = await fetchCardData(range);

  return (
    <>
      <Card title="Collected" stat={collected} money range={range} type="collected" />
      <Card title="Pending" stat={pending} money range={range} type="pending" />
      <Card title="Total invoices" stat={invoices} range={range} type="invoices" />
      <Card title="Total customers" stat={customers} range={range} type="customers" />
    </>
  );
}

export function Card({
  title,
  stat,
  money = false,
  range,
  type,
}: {
  title: string;
  stat: CardStat;
  money?: boolean;
  range: Range;
  type: 'invoices' | 'customers' | 'pending' | 'collected';
}) {
  const Icon = iconMap[type];

  return (
    <div
      data-xenocat-card
      className="relative rounded-2xl border border-line bg-panel-glass p-5 pb-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
    >
      <span className="absolute right-4 top-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.04]">
        <Icon className="h-6 w-6 text-aura/40" />
      </span>
      <h3
        className={clsx(
          'text-[16.5px] font-bold',
          type === 'collected' ? 'text-plasma' : 'text-aura'
        )}
      >
        {title}
      </h3>
      <p className="mt-4 truncate text-[28px] font-bold leading-tight text-plasma">
        {money ? formatCurrency(stat.value) : stat.value}
      </p>
      <p className="mt-3 text-[13px] font-bold text-aura">
        {range === '12m' ? `${formatChange(stat.change)} vs previous 12 months` : 'All time'}
      </p>
    </div>
  );
}
