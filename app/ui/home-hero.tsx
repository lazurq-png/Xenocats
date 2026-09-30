import { BanknotesIcon, ClockIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import XenocatLogo from '@/app/ui/acme-logo';
import { CatSprite } from '@/app/ui/xenocats/cat-sprite';
import { catTypeById } from '@/app/ui/xenocats/cat-types';

/**
 * A drawn preview of the dashboard for the home page (replacing the course's
 * screenshots): the navigation panel, three summary cards, a small revenue chart —
 * and two of the cats, one asleep on a card.
 */
export default function HomeHero() {
  const sleeper = catTypeById('nebula-ragdoll')!;
  const watcher = catTypeById('pulsar-siamese')!;
  const bars = [38, 55, 47, 70, 62, 84];
  return (
    <div
      role="img"
      aria-label="A preview of the Xenocat Analytics dashboard, with an alien cat asleep on a card"
      className="relative w-full max-w-xl select-none"
    >
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
        <div className="flex items-center gap-1.5 border-b border-gray-100 px-4 py-3">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-2.5 w-2.5 rounded-full bg-gray-200" />
          ))}
        </div>
        <div className="flex gap-4 p-4">
          <div className="hidden w-36 flex-none flex-col gap-2 sm:flex">
            <div className="flex h-20 items-end rounded-lg bg-blue-600 p-2">
              <div className="origin-bottom-left scale-[0.6]">
                <XenocatLogo />
              </div>
            </div>
            {['Home', 'Invoices', 'Customers'].map((label, i) => (
              <div
                key={label}
                className={`rounded-md px-3 py-2 text-xs font-medium ${
                  i === 0 ? 'bg-sky-100 text-blue-600' : 'bg-gray-50 text-gray-600'
                }`}
              >
                {label}
              </div>
            ))}
          </div>
          <div className="min-w-0 grow">
            <p className="mb-3 text-sm font-semibold text-gray-900">Dashboard</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Collected', value: '$2,689', Icon: BanknotesIcon },
                { label: 'Pending', value: '$3,468', Icon: ClockIcon },
                { label: 'Customers', value: '8', Icon: UserGroupIcon },
              ].map(({ label, value, Icon }) => (
                <div key={label} className="relative rounded-lg bg-gray-50 p-2">
                  <div className="flex items-center gap-1 text-[10px] text-gray-500">
                    <Icon className="h-3 w-3" />
                    {label}
                  </div>
                  <p className="mt-2 rounded bg-white py-2 text-center text-sm font-semibold text-gray-900">
                    {value}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-lg bg-gray-50 p-3">
              <p className="mb-2 text-[10px] text-gray-500">Recent revenue</p>
              <div className="flex h-24 items-end gap-2 rounded bg-white p-2">
                {bars.map((height, i) => (
                  <div
                    key={i}
                    className="grow rounded-t bg-blue-300"
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* The cats: one asleep on the dashboard's edge, one watching from below. */}
      <div className="absolute -top-9 right-6">
        <CatSprite palette={sleeper.palette} look={sleeper.look} pose="asleep" size={72} />
      </div>
      <div className="absolute -bottom-8 -left-6">
        <CatSprite palette={watcher.palette} look={watcher.look} pose="awake" size={64} />
      </div>
    </div>
  );
}
