import type { Arena } from './arena';
import { clockText } from './arena-storage';
import { WEAPONS, loadout } from './arsenal';

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
 * at their levels, the slots still free, and the evolutions within reach. Read
 * from the run's state when it was paused; the words are the level-up cards'.
 */
export function PauseSummary({ state }: { state: ArenaState }) {
  const coop = state.heroes.length > 1;
  const resolve = state.heroes
    .map((hero, i) => (coop ? `Player ${i + 1}: ${resolveText(hero)}` : resolveText(hero)))
    .join('; ');
  return (
    <div data-testid="survival-pause-summary" className="mt-4 text-left text-sm text-aura">
      <h3 className="font-semibold text-cream">The run</h3>
      <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
        {(
          [
            ['Time', 'time', clockText(state.time)],
            ['Run length', 'length', clockText(state.goalMs)],
            ['Level', 'level', `${state.level} (${state.xp} of ${state.xpToNext} to the next)`],
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
          index={i}
          title={coop ? `Player ${i + 1}` : 'What he carries'}
        />
      ))}
    </div>
  );
}

function KeeperLoadout({ hero, index, title }: { hero: Hero; index: number; title: string }) {
  const view = loadout(hero.weapons, hero.passives);
  const heading = `survival-pause-keeper-${index + 1}-heading`;
  return (
    <section data-testid={`survival-pause-keeper-${index + 1}`} aria-labelledby={heading}>
      <h3 id={heading} className="mt-3 font-semibold text-cream">
        {title}
      </h3>
      <h4 className="mt-2 font-semibold text-cream" data-testid="survival-pause-weapon-slots">
        Weapons {view.weapons.length} of {view.weapons.length + view.freeWeaponSlots}
      </h4>
      <ul className="mt-1 grid gap-1">
        {view.weapons.map((w) => (
          <li key={w.id} data-weapon={w.id} data-level={w.level}>
            <span className="font-semibold text-white">{w.name}</span>{' '}
            {w.evolved ? '(evolved)' : `${w.level} / ${w.maxLevel}`}
            {w.next && <span className="block text-xs">Next level: {w.next}</span>}
          </li>
        ))}
      </ul>
      <h4 className="mt-3 font-semibold text-cream" data-testid="survival-pause-passive-slots">
        Passives {view.passives.length} of {view.passives.length + view.freePassiveSlots}
      </h4>
      {view.passives.length === 0 ? (
        <p className="mt-1 text-xs">None yet.</p>
      ) : (
        <ul className="mt-1 grid gap-1">
          {view.passives.map((p) => (
            <li key={p.id} data-passive={p.id} data-level={p.level}>
              <span className="font-semibold text-white">{p.name}</span> {p.level} / {p.maxLevel}:{' '}
              {p.gives}
            </li>
          ))}
        </ul>
      )}
      {view.evolutions.length > 0 && (
        <>
          <h4 className="mt-3 font-semibold text-cream">Evolutions within reach</h4>
          <ul className="mt-1 grid gap-1">
            {view.evolutions.map((e) => (
              <li key={e.to} data-evolution={e.to} data-ready={e.ready}>
                <span className="font-semibold text-white">{WEAPONS[e.to].name}</span>:{' '}
                {e.ready
                  ? 'ready. The next chest he opens evolves it.'
                  : e.after
                    ? `ready, after the ${WEAPONS[e.after].name}: one evolves at each chest he opens.`
                    : `needs ${e.missing.join(' and ')}, then a chest he opens.`}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
