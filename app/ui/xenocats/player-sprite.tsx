import type { Facing } from './walking';

// The cat ranger of Taming (fight.tsx): a 64×64 astronaut seen from above and a
// little in front, in eight facings. The east side is drawn; the west side mirrors
// it. The gun arm, drawn apart to turn to an exact aim through `gunRef`, was the old
// Survival's; nothing arms him since Survival became the arena (decisions.md, D27),
// and Taming draws him empty-handed.

export const PLAYER_SIZE = 64;

const SUIT = '#e0e0b3';
const TRIM = '#9d86ff';
const VISOR = '#070b14';
const GLOW = '#c1e838';

type Pose = {
  /** The visor's centre and width; none when facing away. */
  visor: { x: number; width: number } | null;
  /** The backpack's centre: behind the body unless facing away. */
  pack: { x: number; front: boolean } | null;
  /** The antenna leans away from where the ranger looks. */
  antenna: number;
};

// Facing east-ish, from the front (s) round to the back (n).
const POSES: Record<'s' | 'se' | 'e' | 'ne' | 'n', Pose> = {
  s: { visor: { x: 32, width: 18 }, pack: null, antenna: 32 },
  se: { visor: { x: 35, width: 15 }, pack: { x: 24, front: false }, antenna: 29 },
  e: { visor: { x: 39, width: 9 }, pack: { x: 21, front: false }, antenna: 26 },
  ne: { visor: { x: 41, width: 4 }, pack: { x: 28, front: true }, antenna: 27 },
  n: { visor: null, pack: { x: 32, front: true }, antenna: 32 },
};

const MIRRORED: Partial<Record<Facing, keyof typeof POSES>> = { sw: 'se', w: 'e', nw: 'ne' };

/** The gun drawn behind the body: when the ranger faces away. */
const gunBehind = (facing: Facing) => facing === 'n' || facing === 'ne' || facing === 'nw';

/** The gun element's transform for an aim at `angle` radians (screen y down). */
export function gunTransform(angle: number): string {
  // Upside down when aiming left otherwise: flip it so its top stays up.
  const flip = Math.cos(angle) < 0 ? -1 : 1;
  return `rotate(${angle}rad) scaleY(${flip})`;
}

const FACING_ANGLE: Record<Facing, number> = {
  e: 0,
  se: Math.PI / 4,
  s: Math.PI / 2,
  sw: (3 * Math.PI) / 4,
  w: Math.PI,
  nw: (-3 * Math.PI) / 4,
  n: -Math.PI / 2,
  ne: -Math.PI / 4,
};

export function PlayerSprite({
  facing,
  walking,
  gunRef,
  armed = true,
}: {
  facing: Facing;
  walking: boolean;
  /** Carrying the gun (no game does since D27), or empty-handed (Taming). */
  armed?: boolean;
  /** The gun the game loop turns; decoys leave it pointing the way they face. */
  gunRef?: React.Ref<HTMLDivElement>;
}) {
  const pose = POSES[MIRRORED[facing] ?? (facing as keyof typeof POSES)];
  const mirrored = facing in MIRRORED;
  const gun = (
    <div
      ref={gunRef}
      className="absolute left-1/2 top-[34px] h-0 w-0"
      style={{ transform: gunTransform(FACING_ANGLE[facing]) }}
    >
      <svg width="36" height="16" viewBox="0 0 36 16" className="absolute -top-2 left-0">
        {/* Arm, then the blaster; its muzzle glows where the beam leaves (30 px). */}
        <rect x="0" y="5" width="14" height="6" rx="3" fill={SUIT} />
        <rect x="11" y="3" width="17" height="9" rx="2.5" fill={TRIM} />
        <rect x="14" y="11" width="4" height="4" rx="1" fill={TRIM} />
        <rect x="25" y="5" width="6" height="5" rx="1.5" fill={VISOR} />
        <circle cx="31" cy="7.5" r="2.2" fill={GLOW} />
      </svg>
    </div>
  );

  return (
    <div
      className={walking ? 'xenocat-player xenocat-player-walking' : 'xenocat-player'}
      style={{ position: 'relative', width: PLAYER_SIZE, height: PLAYER_SIZE }}
    >
      {armed && gunBehind(facing) && gun}
      <svg
        width={PLAYER_SIZE}
        height={PLAYER_SIZE}
        viewBox="0 0 64 64"
        className="absolute inset-0 overflow-visible"
        style={mirrored ? { transform: 'scaleX(-1)' } : undefined}
      >
        <ellipse cx="32" cy="58" rx="15" ry="4" fill="#000" opacity="0.35" />
        <g className="xenocat-player-legs">
          <rect
            className="xenocat-player-leg-a"
            x="24"
            y="46"
            width="7"
            height="11"
            rx="3"
            fill={SUIT}
          />
          <rect
            className="xenocat-player-leg-b"
            x="33"
            y="46"
            width="7"
            height="11"
            rx="3"
            fill={SUIT}
          />
        </g>
        <g className="xenocat-player-body">
          {pose.pack && !pose.pack.front && (
            <rect x={pose.pack.x - 7} y="30" width="14" height="16" rx="3" fill={TRIM} />
          )}
          <rect x="20" y="30" width="24" height="20" rx="8" fill={SUIT} />
          <rect x="20" y="41" width="24" height="3" fill={TRIM} />
          {pose.visor && (
            // The chest light faces the same way as the visor.
            <circle cx={pose.visor.x} cy="36" r="2" fill={GLOW} />
          )}
          {pose.pack?.front && (
            <rect x={pose.pack.x - 8} y="31" width="16" height="15" rx="3" fill={TRIM} />
          )}
          <line
            x1="32"
            y1="10"
            x2={pose.antenna}
            y2="3"
            stroke={SUIT}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx={pose.antenna} cy="3" r="2.5" fill={GLOW} className="xenocat-glow" />
          <circle cx="32" cy="21" r="13" fill={SUIT} stroke={TRIM} strokeWidth="2.5" />
          {pose.visor && (
            <>
              <rect
                x={pose.visor.x - pose.visor.width / 2}
                y="15"
                width={pose.visor.width}
                height="11"
                rx={Math.min(5, pose.visor.width / 2)}
                fill={VISOR}
                stroke={GLOW}
                strokeWidth="1.2"
              />
              <rect
                x={pose.visor.x - pose.visor.width / 2 + 2}
                y="17"
                width={Math.max(pose.visor.width / 4, 1)}
                height="2"
                rx="1"
                fill="#fff"
                opacity="0.6"
              />
            </>
          )}
        </g>
      </svg>
      {armed && !gunBehind(facing) && gun}
    </div>
  );
}
