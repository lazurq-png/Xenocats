// The Shop's upgrade icons that Heroicons has nothing close to: a coat, a hat, a lint
// roller, pockets... Drawn on Heroicons' 20 px solid grid, in the current colour, so
// they sit beside the Heroicons the Shop still uses.

import type { SVGProps } from 'react';

type Props = SVGProps<SVGSVGElement>;

/** A circle as a sub-path: inside an even-odd fill, a hole. */
const dot = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;

function Solid({ children, ...props }: Props) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

function Lines({ children, ...props }: Props) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

/** Thick Coat: a belted trench coat. */
export function CoatIcon(props: Props) {
  return (
    <Solid {...props}>
      <path
        fillRule="evenodd"
        d={`M7 2h6l4 3.2V12h-2l.6 6.2H4.4L5 12H3V5.2Z M8 2l2 4.4L12 2Z M9.7 6.4h.6v11.8h-.6Z M5 10h10v.9H5Z ${dot(8.4, 8, 0.6)} ${dot(11.6, 8, 0.6)}`}
      />
    </Solid>
  );
}

/** Wide Brim: a hat with a wide brim. */
export function HatIcon(props: Props) {
  return (
    <Solid {...props}>
      <path d="M6.8 9 7.2 5C7.4 3.4 8.5 2.8 10 2.8s2.6.6 2.8 2.2l.4 4Z" />
      <path d="M6.6 10.2h6.8l.2 1.6H6.4Z" />
      <ellipse cx="10" cy="13.4" rx="9" ry="2.4" />
    </Solid>
  );
}

/** Brisk Step: a boot, in a hurry. */
export function BootIcon(props: Props) {
  return (
    <Solid {...props}>
      <path d="M7 2.5h5v7.3l4.6 2c1 .5 1.6 1.4 1.6 2.5v.9H7Z" />
      <rect x="6.4" y="16" width="12" height="1.8" rx=".9" />
      <rect x="1" y="6" width="4" height="1.3" rx=".65" />
      <rect x="2" y="9.4" width="3" height="1.3" rx=".65" />
      <rect x="1" y="12.8" width="4" height="1.3" rx=".65" />
    </Solid>
  );
}

/** Long Arms: an arm reaching out, a long way, its hand open. */
export function ReachIcon(props: Props) {
  return (
    <Solid {...props}>
      <path d="M1 7.6h7.4v4.8H1Z" />
      <path d="M9.4 8.6h3.6v2.8H9.4Z" />
      <path d="M13 7.4c0-.5.4-.9.9-.9h1.4c.5 0 .9.4.9.9v5.2c0 .5-.4.9-.9.9h-1.4a.9.9 0 0 1-.9-.9Z" />
      <rect x="15.4" y="6.6" width="3.8" height="1.5" rx=".75" />
      <rect x="15.4" y="9.25" width="4.2" height="1.5" rx=".75" />
      <rect x="15.4" y="11.9" width="3.6" height="1.5" rx=".75" />
      <rect x="13.6" y="2.6" width="1.5" height="4.6" rx=".75" transform="rotate(-20 14.35 4.9)" />
    </Solid>
  );
}

/** Second Opinion: a die, for a reroll. */
export function DieIcon(props: Props) {
  return (
    <Solid {...props}>
      <path
        fillRule="evenodd"
        d={`M4.5 2h11A2.5 2.5 0 0 1 18 4.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 2 15.5v-11A2.5 2.5 0 0 1 4.5 2Z ${dot(6.5, 6.5, 1.4)} ${dot(10, 10, 1.4)} ${dot(13.5, 13.5, 1.4)}`}
      />
    </Solid>
  );
}

/** Shrug: shoulders up, palms up. */
export function ShrugIcon(props: Props) {
  return (
    <Lines {...props}>
      <circle cx="10" cy="5" r="2.4" fill="currentColor" stroke="none" />
      <path d="M6.6 18v-6.4c0-1.4 1-2.4 2.4-2.4h2c1.4 0 2.4 1 2.4 2.4V18" />
      <path d="M6.6 11.4 3.4 9.6 2.4 6.6M13.4 11.4l3.2-1.8 1-3" />
    </Lines>
  );
}

/** Lint Roller: the roller and its handle. */
export function LintRollerIcon(props: Props) {
  return (
    <Solid {...props}>
      <path
        fillRule="evenodd"
        d="M4.5 2h9A1.5 1.5 0 0 1 15 3.5v4A1.5 1.5 0 0 1 13.5 9h-9A1.5 1.5 0 0 1 3 7.5v-4A1.5 1.5 0 0 1 4.5 2Z M6.2 3h.6v5h-.6Z M9 3h.6v5H9Z M11.8 3h.6v5h-.6Z"
      />
      <path d="M15 5h2.2c.5 0 .8.3.8.8v5c0 .5-.3.8-.8.8H11.4V12h-1.2v-1.2c0-.5.3-.8.8-.8h5.8V6.2H15Z" />
      <rect x="9.3" y="12" width="3" height="6.5" rx="1.2" />
    </Solid>
  );
}

/** Deep Pockets: a pocket with its flap buttoned. */
export function PocketIcon(props: Props) {
  return (
    <Solid {...props}>
      <path fillRule="evenodd" d={`M2.5 2h15v3.8L10 8.4 2.5 5.8Z ${dot(10, 5.6, 1)}`} />
      <path d="M3 7.6 10 10l7-2.4V13c0 3-3.2 5-7 5s-7-2-7-5Z" />
    </Solid>
  );
}

/** Spare Pocket: a pocket, and one more. */
export function SparePocketIcon(props: Props) {
  return (
    <Solid {...props}>
      <path d="M1.5 5h11v2.8L7 9.8 1.5 7.8Z" />
      <path d="M2 9.4 7 11.2l5-1.8v4.1c0 2.3-2.3 3.7-5 3.7s-5-1.4-5-3.7Z" />
      <rect x="13.4" y="3.6" width="5.6" height="1.6" rx=".8" />
      <rect x="15.4" y="1.6" width="1.6" height="5.6" rx=".8" />
    </Solid>
  );
}

/** Patience: an hourglass. */
export function HourglassIcon(props: Props) {
  return (
    <Solid {...props}>
      <rect x="3.5" y="1.5" width="13" height="2" rx="1" />
      <rect x="3.5" y="16.5" width="13" height="2" rx="1" />
      <path d="M5 3.5h10c0 3.4-3.4 4.9-3.4 6.5s3.4 3.1 3.4 6.5H5c0-3.4 3.4-4.9 3.4-6.5S5 6.9 5 3.5Z" />
    </Solid>
  );
}

/** Lucky Coat Button: a four-holed coat button. */
export function CoatButtonIcon(props: Props) {
  return (
    <Solid {...props}>
      <path
        fillRule="evenodd"
        d={`${dot(10, 10, 8)} ${dot(10, 10, 6.4)} ${dot(10, 10, 5.5)} ${dot(8.2, 8.2, 1.1)} ${dot(11.8, 8.2, 1.1)} ${dot(8.2, 11.8, 1.1)} ${dot(11.8, 11.8, 1.1)}`}
      />
    </Solid>
  );
}

/** Second Wind: a gust of wind. */
export function WindIcon(props: Props) {
  return (
    <Lines {...props}>
      <path d="M2 7.5h9.5a2.5 2.5 0 1 0-2.5-2.5" />
      <path d="M2 11h12.5a2.5 2.5 0 1 1-2.5 2.5" />
      <path d="M2 14.5h6" />
    </Lines>
  );
}
