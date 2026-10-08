// What a puppet show adds to the page while an attack lasts (puppets.ts): the
// Laser Ocicat's beams and the Decoy Burmese's fake copies of what it hits. All of
// it lives in one stage, a fixed layer appended to <body>, hidden from assistive
// technology and never itself hit (`data-xenocat-ignore`); it is removed when the
// last prop is. A copy looks like the element it copies, but is out of the tab
// order and does nothing when clicked.

import type { Size, Vec } from './effects';

/** On the stage element. */
export const STAGE_ATTRIBUTE = 'data-xenocat-props';

/** Below the cats (9998) and the cursor (9999), above the page. */
const STAGE_Z = 9997;

export const LASER_RED = '#ff3b3b';

// Inherited from the copied element's ancestors: the copy no longer has them.
const INHERITED = [
  'color',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'letter-spacing',
  'line-height',
  'text-align',
  'text-transform',
  'white-space',
];

// Removed from a copy and everything in it: no duplicate ids or test ids, and
// nothing that would join a form. A link keeps its `href`, to look like one; its
// clicks go nowhere.
const STRIPPED = ['id', 'name', 'for', 'form', 'data-testid'];

export type Stage = ReturnType<typeof createStage>;

export function createStage() {
  let stage: HTMLElement | null = null;
  let props = 0;

  function open(): HTMLElement {
    if (stage) return stage;
    stage = document.createElement('div');
    stage.setAttribute(STAGE_ATTRIBUTE, '');
    stage.setAttribute('aria-hidden', 'true');
    stage.setAttribute('data-xenocat-ignore', '');
    stage.style.cssText = `position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:${STAGE_Z}`;
    document.body.appendChild(stage);
    return stage;
  }

  function add(prop: HTMLElement) {
    open().appendChild(prop);
    props++;
  }

  return {
    /** A laser beam, off until drawn. */
    beam(): HTMLElement {
      const beam = document.createElement('div');
      beam.dataset.xenocatBeam = '';
      beam.style.cssText = [
        'position:absolute',
        'left:0',
        'top:0',
        'height:3px',
        'border-radius:2px',
        'transform-origin:0 50%',
        `background:linear-gradient(90deg, rgba(255,59,59,0.15), ${LASER_RED})`,
        `box-shadow:0 0 6px ${LASER_RED}, 0 0 14px ${LASER_RED}`,
        'opacity:0',
      ].join(';');
      add(beam);
      return beam;
    },

    /**
     * A copy of `element` (`size` big, with the inline `style` it had before any
     * attack), placed by `place`. Clicking it does nothing.
     */
    copy(element: HTMLElement, size: Size, style: string | null): HTMLElement {
      const holder = document.createElement('div');
      holder.dataset.xenocatDecoy = '';
      const computed = getComputedStyle(element);
      holder.style.cssText = [
        'position:absolute',
        'left:0',
        'top:0',
        `width:${size.width}px`,
        `height:${size.height}px`,
        'pointer-events:auto',
        ...INHERITED.map((property) => `${property}:${computed.getPropertyValue(property)}`),
      ].join(';');
      const copy = element.cloneNode(true) as HTMLElement;
      for (const part of [copy, ...copy.querySelectorAll<HTMLElement>('*')]) {
        for (const name of STRIPPED) part.removeAttribute(name);
        if (part.matches('a, button, input, select, textarea, [tabindex]')) {
          part.setAttribute('tabindex', '-1');
        }
      }
      if (style === null) copy.removeAttribute('style');
      else copy.setAttribute('style', style);
      Object.assign(copy.style, {
        position: 'static',
        margin: '0',
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        translate: 'none',
        transform: 'none',
      });
      holder.appendChild(copy);
      // A press on a copy neither focuses it nor follows it anywhere, and its click
      // reaches nothing else on the page.
      holder.addEventListener('mousedown', (event) => event.preventDefault());
      for (const type of ['click', 'auxclick']) {
        holder.addEventListener(type, (event) => {
          event.preventDefault();
          event.stopPropagation();
        });
      }
      add(holder);
      return holder;
    },

    /** Draws `beam` from `from` to `to`, or hides it. */
    drawBeam(beam: HTMLElement, from: Vec, to: Vec, on: boolean) {
      if (!on) {
        beam.style.opacity = '0';
        return;
      }
      const length = Math.hypot(to.x - from.x, to.y - from.y);
      beam.style.left = `${Math.round(from.x)}px`;
      beam.style.top = `${Math.round(from.y - 1.5)}px`;
      beam.style.width = `${Math.round(length)}px`;
      beam.style.rotate = `${Math.atan2(to.y - from.y, to.x - from.x)}rad`;
      beam.style.opacity = '1';
    },

    /** Puts a copy's centre at `centre`. */
    place(holder: HTMLElement, centre: Vec, size: Size) {
      holder.style.left = `${Math.round(centre.x - size.width / 2)}px`;
      holder.style.top = `${Math.round(centre.y - size.height / 2)}px`;
    },

    /** Takes props off the stage; the stage goes when the last one does. */
    remove(removed: readonly HTMLElement[]) {
      for (const prop of removed) {
        prop.remove();
        props--;
      }
      if (props <= 0 && stage) {
        stage.remove();
        stage = null;
        props = 0;
      }
    },
  };
}
