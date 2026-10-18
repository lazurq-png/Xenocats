import type { Arena } from './arena';
import { clockText } from './arena-storage';
import { PASSIVES, type Slots, WEAPONS, loadout } from './arsenal';
import { tierStyle } from './item-tier';

type ArenaState = ReturnType<Arena['state']>;
type Hero = ArenaState['heroes'][number];

/** A Keeper's Resolve as the HUD gives it: down (and when he is back), or how much is left. */
const resolveText = (hero: Hero) =>
  hero.down
    ? `down, back in ${Math.ceil(hero.backIn / 1000)} s`
    : `${Math.ceil(hero.resolve)} of ${Math.round(hero.maxResolve)}`;

/**
 * The pause menu's account of the run so far: time, level, Resolve, cats sent
 * home, and what each Keeper carries (arsenal.ts, loadout): weapons and passives
 * at their levels, the slots still free, and the evolutions within reach, side by
 * side where the screen is wide enough. Read from the run's state when it was
 * paused; the words are the level-up cards'.
 */
export function PauseSummary({ state }: { state: ArenaState }) {
  const coop = state.heroes.length > 1;
  const resolve = state.heroes
    .map((hero, i) => (coop ? `Player ${i + 1}: ${resolveText(hero)}` : resolveText(hero)))
    .join('; ');
  return (
    <div data-testid="survival-pause-summary" className="mt-4 text-left text-sm text-aura">
      <h3 className="font-semibold text-cream">The run</h3>
      <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-5">
        {(
          [
            ['Time', 'time', clockText(state.time)],
            [
              'Run length',
              'length',
              Number.isFinite(state.goalMs) ? clockText(state.goalMs) : 'Endless',
            ],
            ['Level', 'level', String(state.level)],
            ['Resolve', 'resolve', resolve],
            ['Sent home', 'sent-home', String(state.sentHome)],
          ] as const
        ).map(([label, id, value]) => (
          <div key={id}>
            <dt className="text-xs">{label}</dt>
            <dd data-testid={`survival-pause-${id}`} className="font-semibold text-cream">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      {state.heroes.map((hero, i) => (
        <KeeperLoadout
          key={i}
          hero={hero}
          slots={state.slots}
          index={i}
          title={coop ? `Player ${i + 1}` : 'What he carries'}
        />
      ))}
    </div>
  );
}

/** "3 of 8", or "3, no limit" in an endless run. */
const slotText = (held: number, free: number) =>
  Number.isFinite(free) ? `${held} of ${held + free}` : `${held}, no limit`;

function KeeperLoadout({
  hero,
  slots,
  index,
  title,
}: {
  hero: Hero;
  slots: Slots;
  index: number;
  title: string;
}) {
  const view = loadout(hero.weapons, hero.passives, slots);
  const heading = `survival-pause-keeper-${index + 1}-heading`;
  return (
    <section data-testid={`survival-pause-keeper-${index + 1}`} aria-labelledby={heading}>
      <h3 id={heading} className="mt-3 font-semibold text-cream">
        {title}
      </h3>
      <div className="mt-2 grid gap-x-6 gap-y-3 md:grid-cols-3">
        <div>
          <h4 className="font-semibold text-cream" data-testid="survival-pause-weapon-slots">
            Weapons {slotText(view.weapons.length, view.freeWeaponSlots)}
          </h4>
          <ul className="mt-1 grid gap-1">
            {view.weapons.map((w) => {
              const tier = tierStyle({ kind: 'weapon', id: w.id, level: w.level });
              return (
                <li key={w.id} data-weapon={w.id} data-level={w.level} data-tier={tier.tier}>
                  <span className={`font-semibold ${tier.className}`}>{w.name}</span>{' '}
                  {w.evolved ? '' : `${w.level} / ${w.maxLevel} `}
                  <span data-testid="survival-pause-tier" className={tier.className}>
                    ({tier.name})
                  </span>
                  {w.next && <span className="block text-xs">Next level: {w.next}</span>}
                  {w.includes.map((p) => (
                    <span key={p.id} data-includes={p.id} className="block text-xs">
                      With the {p.name}: {p.gives}
                    </span>
                  ))}
                </li>
              );
            })}
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-cream" data-testid="survival-pause-passive-slots">
            Passives {slotText(view.passives.length, view.freePassiveSlots)}
          </h4>
          {view.passives.length === 0 ? (
            <p className="mt-1 text-xs">None yet.</p>
          ) : (
            <ul className="mt-1 grid gap-1">
              {view.passives.map((p) => {
                const tier = tierStyle({ kind: 'passive', id: p.id, level: p.level });
                return (
                  <li key={p.id} data-passive={p.id} data-level={p.level} data-tier={tier.tier}>
                    <span className={`font-semibold ${tier.className}`}>{p.name}</span> {p.level} /{' '}
                    {p.maxLevel}{' '}
                    <span data-testid="survival-pause-tier" className={tier.className}>
                      ({tier.name})
                    </span>
                    : {p.gives}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div>
          {view.fusions.length === 0 && view.evolutions.length === 0 && (
            <>
              <h4 className="font-semibold text-cream">Within reach</h4>
              <p className="mt-1 text-xs">None.</p>
            </>
          )}
          {view.fusions.length > 0 && (
            <>
              <h4 className="font-semibold text-cream">Fusions within reach</h4>
              <ul className="mt-1 grid gap-1">
                {view.fusions.map((f) => (
                  <li key={f.to} data-fusion={f.to} data-ready={f.ready}>
                    <span
                      className={`font-semibold ${tierStyle({ kind: 'weapon', id: f.to, level: 8 }).className}`}
                    >
                      {WEAPONS[f.to].name}
                    </span>
                    :{' '}
                    {f.ready
                      ? 'ready. The next chest he opens fuses them, and frees a slot.'
                      : `needs ${f.missing.join(' and ')}, then a chest he opens.`}
                  </li>
                ))}
              </ul>
            </>
          )}
          {view.evolutions.length > 0 && (
            <>
              <h4 className={`font-semibold text-cream ${view.fusions.length > 0 ? 'mt-3' : ''}`}>
                Evolutions within reach
              </h4>
              <ul className="mt-1 grid gap-1">
                {view.evolutions.map((e) => (
                  <li key={e.to} data-evolution={e.to} data-ready={e.ready}>
                    <span
                      className={`font-semibold ${tierStyle({ kind: 'weapon', id: e.to, level: 8 }).className}`}
                    >
                      {WEAPONS[e.to].name}
                    </span>
                    :{' '}
                    {e.ready
                      ? `ready. The next chest he opens evolves it, and the ${PASSIVES[e.with].name} becomes part of it (its slot is freed).`
                      : e.after
                        ? `ready, after the ${WEAPONS[e.after].name}: one evolves at each chest he opens.`
                        : `needs ${e.missing.join(' and ')}, then a chest he opens.`}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
