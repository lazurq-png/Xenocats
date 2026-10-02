import type { CatLook, CatPalette } from './cat-types';

// A 72×72 alien cat in two poses, assembled from a cat type's `look`: its build,
// ears, coat pattern, antenna and eyes. `.xenocat-body` is what breathes while
// asleep; `.xenocat-glow` (antenna tips and eyes) pulses.

export const DEFAULT_LOOK: CatLook = {
  build: 'sleek',
  ears: 'pointed',
  pattern: 'stripes',
  antenna: 'single',
  eyes: 'slit',
};

export function CatSprite({
  palette,
  look = DEFAULT_LOOK,
  pose,
  size = 72,
  art,
  still = false,
}: {
  palette: CatPalette;
  look?: CatLook;
  pose: 'awake' | 'asleep';
  size?: number;
  /** Rendered artwork for this pose (cat-art.ts), drawn instead of the SVG. */
  art?: string;
  /**
   * The glow held steady instead of pulsing: for a page of many sprites at once
   * (the /cats roster), where every pulse would be redrawn on every frame.
   */
  still?: boolean;
}) {
  if (art) {
    // `.xenocat-body` keeps the breathing and staged-entrance hooks; awake, the
    // cat's glow colour pulses around it in place of the SVG's glowing parts.
    return (
      <span className="xenocat-body block" style={{ width: size, height: size }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a sprite drawn at a fixed small size, not a content image */}
        <img
          src={art}
          alt=""
          width={size}
          height={size}
          draggable={false}
          className={
            pose === 'awake' ? (still ? 'xenocat-art-glow-still' : 'xenocat-art-glow') : undefined
          }
          style={{ '--xenocat-glow': palette.glow } as React.CSSProperties}
        />
      </span>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 72 72"
      className={still ? 'xenocat-still overflow-visible' : 'overflow-visible'}
    >
      {pose === 'asleep' ? (
        <Asleep palette={palette} look={look} />
      ) : (
        <Awake palette={palette} look={look} />
      )}
    </svg>
  );
}

type Parts = { palette: CatPalette; look: CatLook };

// ---------------------------------------------------------------- awake

function Awake({ palette: p, look }: Parts) {
  const fluffy = look.build === 'fluffy';
  const stocky = look.build === 'stocky';
  const body = fluffy ? { rx: 22, ry: 15 } : stocky ? { rx: 21, ry: 12.5 } : { rx: 19, ry: 14 };
  const headR = fluffy ? 16.5 : 15;
  return (
    <g className="xenocat-body">
      {/* tail */}
      <path
        d={look.tail === 'stub' ? 'M54 53 q5 -1 6 -5' : 'M54 54 C66 50 66 36 60 30'}
        fill="none"
        stroke={look.pattern === 'points' ? p.accent : p.body}
        strokeWidth={fluffy ? 9 : 6}
        strokeLinecap="round"
      />
      {/* body, belly, paws */}
      <ellipse cx="36" cy={stocky ? 53 : 51} rx={body.rx} ry={body.ry} fill={p.body} />
      <ellipse cx="36" cy="55" rx="10" ry="8" fill={p.belly} />
      <BodyPattern palette={p} look={look} />
      {[27, 45].map((x) => (
        <ellipse
          key={x}
          cx={x}
          cy="64"
          rx="5"
          ry="3"
          fill={look.pattern === 'points' ? p.accent : p.body}
          stroke={p.accent}
          strokeWidth="0.8"
        />
      ))}
      <Antenna palette={p} look={look} />
      <Ears palette={p} look={look} head={{ cx: 36, cy: 30, r: headR }} />
      {/* head */}
      {fluffy && (
        <path
          d="M20 30 l-3 3 l3 1 l-2 3 l4 0 M52 30 l3 3 l-3 1 l2 3 l-4 0"
          fill={p.body}
          stroke={p.body}
          strokeWidth="2"
        />
      )}
      <circle cx="36" cy="30" r={headR} fill={p.body} />
      <HeadPattern palette={p} look={look} />
      <ellipse cx="36" cy="36" rx="7" ry="5" fill={p.belly} />
      <Eyes palette={p} look={look} />
      {/* nose, mouth, whiskers */}
      <path d="M34.6 34.4 h2.8 l-1.4 1.8 z" fill={p.accent} />
      <path
        d="M36 36.2 q-1.6 2 -3.2 0.8 M36 36.2 q1.6 2 3.2 0.8"
        stroke={p.accent}
        strokeWidth="0.9"
        fill="none"
      />
      <path
        d="M26 35 l-7 -1.5 M26 37 l-7 1 M46 35 l7 -1.5 M46 37 l7 1"
        stroke={p.accent}
        strokeWidth="0.7"
        opacity="0.7"
      />
    </g>
  );
}

function Ears({ palette: p, look, head }: Parts & { head: { cx: number; cy: number; r: number } }) {
  const inner = look.pattern === 'points' ? p.accent : p.belly;
  switch (look.ears) {
    case 'big':
      return (
        <g>
          <path d="M20 26 L19 4 L34 17 Z" fill={p.body} />
          <path d="M52 26 L53 4 L38 17 Z" fill={p.body} />
          <path d="M22.5 21 L22 9 L30 16.5 Z" fill={inner} />
          <path d="M49.5 21 L50 9 L42 16.5 Z" fill={inner} />
        </g>
      );
    case 'folded':
      return (
        <g>
          <path d="M22 22 Q24 12 32 17 Q27 19 25 24 Z" fill={p.body} />
          <path d="M50 22 Q48 12 40 17 Q45 19 47 24 Z" fill={p.body} />
        </g>
      );
    case 'tufted':
      return (
        <g>
          <path d="M22 24 L24 8 L33 18 Z" fill={p.body} />
          <path d="M50 24 L48 8 L39 18 Z" fill={p.body} />
          <path d="M24.5 20 L25.5 12 L30 17 Z" fill={inner} />
          <path d="M47.5 20 L46.5 12 L42 17 Z" fill={inner} />
          <path
            d="M24 8 l-1 -5 M24 8 l1.5 -4.5 M48 8 l1 -5 M48 8 l-1.5 -4.5"
            stroke={p.accent}
            strokeWidth="1.2"
          />
        </g>
      );
    default:
      return (
        <g>
          <path d={`M22 ${head.cy - 6} L24 8 L33 18 Z`} fill={p.body} />
          <path d={`M50 ${head.cy - 6} L48 8 L39 18 Z`} fill={p.body} />
          <path d="M24.5 20 L25.5 12 L30 17 Z" fill={inner} />
          <path d="M47.5 20 L46.5 12 L42 17 Z" fill={inner} />
        </g>
      );
  }
}

function Antenna({ palette: p, look }: Parts) {
  switch (look.antenna) {
    case 'none':
      return null;
    case 'double':
      return (
        <g>
          <path d="M31 16 Q27 8 24 5" fill="none" stroke={p.accent} strokeWidth="1.5" />
          <path d="M41 16 Q45 8 48 5" fill="none" stroke={p.accent} strokeWidth="1.5" />
          <circle className="xenocat-glow" cx="24" cy="5" r="2.4" fill={p.glow} />
          <circle className="xenocat-glow" cx="48" cy="5" r="2.4" fill={p.glow} />
        </g>
      );
    case 'orb':
      return (
        <g>
          <path d="M36 16 L36 7" stroke={p.accent} strokeWidth="1.6" />
          <circle
            cx="36"
            cy="4"
            r="5.5"
            fill="none"
            stroke={p.glow}
            strokeWidth="0.8"
            opacity="0.6"
          />
          <circle className="xenocat-glow" cx="36" cy="4" r="3.6" fill={p.glow} />
        </g>
      );
    case 'zigzag':
      return (
        <g>
          <path d="M36 16 L33 12 L38 9 L34 5" fill="none" stroke={p.accent} strokeWidth="1.5" />
          <circle className="xenocat-glow" cx="34" cy="4" r="2.6" fill={p.glow} />
        </g>
      );
    default:
      return (
        <g>
          <path d="M36 16 Q34 9 38 4" fill="none" stroke={p.accent} strokeWidth="1.6" />
          <circle className="xenocat-glow" cx="38" cy="4" r="3" fill={p.glow} />
        </g>
      );
  }
}

function Eyes({ palette: p, look }: Parts) {
  if (look.eyes === 'visor') {
    return (
      <g className="xenocat-eyes">
        <rect x="23.5" y="25" width="25" height="8" rx="4" fill={p.accent} />
        <rect
          className="xenocat-glow"
          x="25"
          y="26.5"
          width="22"
          height="5"
          rx="2.5"
          fill={p.glow}
        />
        <path d="M27 29 h18" stroke="#ffffff" strokeWidth="0.8" opacity="0.8" />
      </g>
    );
  }
  if (look.eyes === 'spiral') {
    const swirl = (cx: number) =>
      `M${cx} 29 m0 -0.8 a0.8 0.8 0 1 1 -0.8 0.8 a1.8 1.8 0 1 1 1.8 1.8 a2.9 2.9 0 1 1 -2.9 -2.9 a3.9 3.9 0 1 1 3.9 3.9`;
    return (
      <g className="xenocat-eyes">
        {[30, 42].map((cx) => (
          <g key={cx}>
            <circle className="xenocat-glow" cx={cx} cy="29" r="5.2" fill={p.glow} />
            <path d={swirl(cx)} fill="none" stroke={p.accent} strokeWidth="1.1" />
          </g>
        ))}
      </g>
    );
  }
  const pupil = (cx: number) =>
    look.eyes === 'round' ? (
      <circle cx={cx} cy="29.5" r="2.4" fill={p.accent} />
    ) : (
      <ellipse cx={cx} cy="29" rx="1.3" ry="4.2" fill={p.accent} />
    );
  return (
    <g className="xenocat-eyes">
      {[30, 42].map((cx) => (
        <g key={cx}>
          <ellipse className="xenocat-glow" cx={cx} cy="29" rx="4.6" ry="5.6" fill={p.glow} />
          {pupil(cx)}
          <circle cx={cx + 1.4} cy="26.8" r="1.1" fill="#ffffff" />
        </g>
      ))}
      {look.eyes === 'three' && (
        <g>
          <ellipse className="xenocat-glow" cx="36" cy="21" rx="2.6" ry="3.2" fill={p.glow} />
          <ellipse cx="36" cy="21" rx="0.8" ry="2.4" fill={p.accent} />
        </g>
      )}
    </g>
  );
}

function HeadPattern({ palette: p, look }: Parts) {
  switch (look.pattern) {
    case 'spots':
      return (
        <Spots
          color={p.accent}
          at={[
            [29, 21],
            [43, 20],
            [36, 18],
          ]}
          r={1.3}
        />
      );
    case 'stripes':
      return (
        <path
          d="M30 17 q6 4 12 0 M29 20.5 q7 3 14 0"
          stroke={p.accent}
          strokeWidth="1.5"
          fill="none"
        />
      );
    case 'points':
      return <ellipse cx="36" cy="32" rx="9.5" ry="9" fill={p.accent} opacity="0.85" />;
    case 'patches':
      return <path d="M24 22 q5 -6 11 -4 q-2 6 -9 8 z" fill={p.glow} opacity="0.9" />;
    case 'wrinkles':
      return (
        <path
          d="M31 19 q5 2 10 0 M32 21.5 q4 1.5 8 0"
          stroke={p.accent}
          strokeWidth="0.9"
          fill="none"
          opacity="0.7"
        />
      );
    case 'frost':
      return (
        <Crystals
          color="#e0f2fe"
          at={[
            [27, 20],
            [45, 21],
          ]}
          size={2}
        />
      );
    case 'stars':
      return (
        <Stars
          color={p.glow}
          at={[
            [28, 20],
            [45, 22],
          ]}
        />
      );
    default:
      return null;
  }
}

function BodyPattern({ palette: p, look }: Parts) {
  switch (look.pattern) {
    case 'spots':
      return (
        <Spots
          color={p.accent}
          at={[
            [22, 47],
            [28, 42],
            [45, 43],
            [51, 49],
            [48, 57],
            [24, 56],
          ]}
          r={1.9}
        />
      );
    case 'stripes':
      return (
        <path
          d="M22 46 q3 -3 6 0 M44 46 q3 -3 6 0 M20 52 q3 -2 5 0 M47 52 q3 -2 5 0"
          stroke={p.accent}
          strokeWidth="1.6"
          fill="none"
        />
      );
    case 'patches':
      return (
        <g>
          <path d="M19 47 q4 -7 12 -4 q-1 8 -10 9 z" fill={p.accent} />
          <path d="M42 45 q7 -3 11 4 q-6 4 -11 1 z" fill={p.glow} opacity="0.9" />
        </g>
      );
    case 'wrinkles':
      return (
        <path
          d="M24 43 q3 2 6 0 M42 43 q3 2 6 0"
          stroke={p.accent}
          strokeWidth="0.9"
          fill="none"
          opacity="0.6"
        />
      );
    case 'frost':
      return (
        <Crystals
          color="#e0f2fe"
          at={[
            [22, 48],
            [49, 47],
            [30, 60],
          ]}
          size={2.4}
        />
      );
    case 'stars':
      return (
        <Stars
          color={p.glow}
          at={[
            [22, 47],
            [50, 49],
            [43, 58],
            [27, 58],
          ]}
        />
      );
    default:
      return null;
  }
}

/** Bengal-style rosettes: a ring with a darker centre. */
function Spots({ color, at, r }: { color: string; at: number[][]; r: number }) {
  return (
    <g>
      {at.map(([x, y]) => (
        <g key={`${x},${y}`}>
          <circle
            cx={x}
            cy={y}
            r={r * 1.5}
            fill="none"
            stroke={color}
            strokeWidth={r * 0.7}
            opacity="0.85"
          />
          <circle cx={x} cy={y} r={r * 0.6} fill={color} opacity="0.5" />
        </g>
      ))}
    </g>
  );
}

function Crystals({ color, at, size }: { color: string; at: number[][]; size: number }) {
  return (
    <g stroke={color} strokeWidth="1" strokeLinecap="round">
      {at.map(([x, y]) => (
        <path
          key={`${x},${y}`}
          d={`M${x - size} ${y} h${size * 2} M${x} ${y - size} v${size * 2} M${x - size * 0.7} ${
            y - size * 0.7
          } l${size * 1.4} ${size * 1.4} M${x + size * 0.7} ${y - size * 0.7} l${-size * 1.4} ${
            size * 1.4
          }`}
        />
      ))}
    </g>
  );
}

function Stars({ color, at }: { color: string; at: number[][] }) {
  return (
    <g fill={color}>
      {at.map(([x, y]) => (
        <path
          key={`${x},${y}`}
          className="xenocat-glow"
          d={`M${x} ${y - 2} l0.6 1.4 l1.4 0.6 l-1.4 0.6 l-0.6 1.4 l-0.6 -1.4 l-1.4 -0.6 l1.4 -0.6 z`}
        />
      ))}
    </g>
  );
}

// ---------------------------------------------------------------- asleep

function Asleep({ palette: p, look }: Parts) {
  const fluffy = look.build === 'fluffy';
  const earFill = look.pattern === 'points' ? p.accent : p.body;
  return (
    <g className="xenocat-body">
      {/* curled body */}
      <ellipse cx="38" cy="52" rx={fluffy ? 28 : 26} ry={fluffy ? 15 : 14} fill={p.body} />
      <AsleepPattern palette={p} look={look} />
      {/* tail wrapped round the front */}
      <path
        d={look.tail === 'stub' ? 'M62 52 q4 2 5 -2' : 'M62 54 C62 66 34 68 22 62'}
        fill="none"
        stroke={look.pattern === 'points' ? p.accent : p.body}
        strokeWidth={fluffy ? 9 : 6}
        strokeLinecap="round"
      />
      {/* ears */}
      {look.ears === 'folded' ? (
        <g>
          <path d="M14 42 Q15 34 21 38 Z" fill={earFill} />
          <path d="M32 40 Q31 33 26 37 Z" fill={earFill} />
        </g>
      ) : look.ears === 'big' ? (
        <g>
          <path d="M12 46 L10 28 L21 38 Z" fill={earFill} />
          <path d="M34 43 L34 27 L25 37 Z" fill={earFill} />
        </g>
      ) : (
        <g>
          <path d="M13 44 L14 31 L21 38 Z" fill={earFill} />
          <path d="M33 42 L31 30 L25 37 Z" fill={earFill} />
          {look.ears === 'tufted' && (
            <path d="M14 31 l-1 -4 M31 30 l1 -4" stroke={p.accent} strokeWidth="1.1" />
          )}
        </g>
      )}
      {/* head resting on the paws */}
      <circle cx="23" cy="47" r={fluffy ? 13 : 12} fill={p.body} />
      {look.pattern === 'points' && (
        <ellipse cx="23" cy="49" rx="8" ry="7" fill={p.accent} opacity="0.85" />
      )}
      <ellipse cx="23" cy="51" rx="6" ry="4" fill={p.belly} />
      {/* drooping antenna(e), dimmed */}
      {look.antenna === 'none' ? null : look.antenna === 'double' ? (
        <g>
          <path d="M19 36 Q17 29 12 29" fill="none" stroke={p.accent} strokeWidth="1.4" />
          <path d="M27 36 Q30 29 35 30" fill="none" stroke={p.accent} strokeWidth="1.4" />
          <circle cx="12" cy="29" r="2" fill={p.glow} opacity="0.45" />
          <circle cx="35" cy="30" r="2" fill={p.glow} opacity="0.45" />
        </g>
      ) : (
        <g>
          <path d="M23 35 Q27 28 33 30" fill="none" stroke={p.accent} strokeWidth="1.5" />
          <circle
            cx="33"
            cy="30"
            r={look.antenna === 'orb' ? 3.4 : 2.4}
            fill={p.glow}
            opacity="0.45"
          />
        </g>
      )}
      {/* closed eyes */}
      <path
        d="M16.5 46 q2.5 2 5 0 M24.5 46 q2.5 2 5 0"
        stroke={p.accent}
        strokeWidth="1.3"
        fill="none"
        strokeLinecap="round"
      />
      {look.eyes === 'three' && (
        <path d="M21.4 41 q1.6 1.2 3.2 0" stroke={p.accent} strokeWidth="1.1" fill="none" />
      )}
      <path d="M21.8 49.6 h2.4 l-1.2 1.4 z" fill={p.accent} />
    </g>
  );
}

function AsleepPattern({ palette: p, look }: Parts) {
  switch (look.pattern) {
    case 'spots':
      return (
        <Spots
          color={p.accent}
          at={[
            [38, 43],
            [47, 41],
            [55, 46],
            [44, 56],
            [56, 55],
          ]}
          r={1.9}
        />
      );
    case 'stripes':
      return (
        <path
          d="M34 41 q4 -4 8 0 M46 43 q4 -4 8 0 M40 57 q3 -3 6 0"
          stroke={p.accent}
          strokeWidth="1.6"
          fill="none"
        />
      );
    case 'patches':
      return (
        <g>
          <path d="M36 42 q7 -5 13 0 q-5 6 -13 3 z" fill={p.accent} />
          <path d="M50 52 q6 -4 10 2 q-5 5 -10 2 z" fill={p.glow} opacity="0.9" />
        </g>
      );
    case 'wrinkles':
      return (
        <path
          d="M38 44 q3 2 6 0 M48 46 q3 2 6 0"
          stroke={p.accent}
          strokeWidth="0.9"
          fill="none"
          opacity="0.6"
        />
      );
    case 'frost':
      return (
        <Crystals
          color="#e0f2fe"
          at={[
            [40, 45],
            [53, 48],
            [47, 58],
          ]}
          size={2.4}
        />
      );
    case 'stars':
      return (
        <Stars
          color={p.glow}
          at={[
            [40, 44],
            [52, 47],
            [46, 57],
            [58, 55],
          ]}
        />
      );
    default:
      return null;
  }
}
