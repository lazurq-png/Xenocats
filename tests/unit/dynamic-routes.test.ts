import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// proxy.ts's matcher leaves out paths ending in an image's extension (so a signed-in
// user's <img> is not redirected), and so a request for one gets neither the proxy's
// session check nor its Content-Security-Policy. A page is reached that way only by a
// route whose last segment is dynamic (`/dashboard/invoices/look.png` is the invoice
// page with the id `look.png`). Today there is one, and it holds: its own session check
// (smoke.spec.ts) and an id that must be a UUID, so such a path is always its not-found
// page (docs/ai/night-2026-11-02/decisions.md, D194). A new one fails this test until
// the same is checked for it and it is added below.

const KNOWN = ['app/dashboard/invoices/[id]/page.tsx'];

/** Every page.tsx and route.ts under `dir` whose folder is a dynamic segment. */
function endingInADynamicSegment(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name).replaceAll('\\', '/');
    if (entry.isDirectory()) found.push(...endingInADynamicSegment(path));
    else if (
      /^(page\.tsx|route\.ts)$/.test(entry.name) &&
      /^\[.+\]$/.test(dir.split(/[\\/]/).at(-1) ?? '')
    ) {
      found.push(path);
    }
  }
  return found;
}

describe('routes whose last segment is dynamic', () => {
  it('are the ones checked against a path past the proxy (D194), and no other', () => {
    expect(
      endingInADynamicSegment('app').sort(),
      'A route ends in a dynamic segment: check that a path ending in .png (which skips proxy.ts) cannot show it anything from the request or an account, then add it to KNOWN'
    ).toEqual(KNOWN);
  });
});
