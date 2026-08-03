/**
 * Tests for the shared render helpers' security-critical URL sanitizer.
 *
 * A document is untrusted input and the schema allows any absolute URI, so the
 * renderer must not turn a dangerous scheme (`javascript:`, `data:`, ...) into a
 * clickable `href`. `safeHref` is the trust boundary.
 */

import { describe, expect, it } from 'vitest';
import { safeHref, STYLE } from './shared';

describe('safeHref', () => {
  it('allows http, https, and mailto (any case)', () => {
    expect(safeHref('https://example.org/a.jpg')).toBe('https://example.org/a.jpg');
    expect(safeHref('http://example.org')).toBe('http://example.org');
    expect(safeHref('HTTPS://EXAMPLE.ORG')).toBe('HTTPS://EXAMPLE.ORG');
    expect(safeHref('mailto:a@example.org')).toBe('mailto:a@example.org');
  });

  it('rejects script-capable and other unlisted schemes', () => {
    expect(safeHref('javascript:alert(1)')).toBeNull();
    expect(safeHref('JavaScript:alert(1)')).toBeNull();
    expect(safeHref('data:text/html;base64,PHNjcmlwdD4=')).toBeNull();
    expect(safeHref('vbscript:msgbox(1)')).toBeNull();
    expect(safeHref('file:///etc/passwd')).toBeNull();
    expect(safeHref('urn:uuid:0')).toBeNull();
  });

  it('rejects a scheme-less string (a validated absolute-URI field always has one)', () => {
    expect(safeHref('//evil.example')).toBeNull();
    expect(safeHref('/relative/path')).toBeNull();
    expect(safeHref('not a url')).toBeNull();
  });
});

describe('print stylesheet (printable-document deliverable)', () => {
  it('defines page margins for print', () => {
    expect(STYLE).toMatch(/@page\s*\{[^}]*margin/);
  });

  it('keeps step numbers legible without background graphics (bordered, dark text)', () => {
    // A common print default drops background fills; the step-number badge must not
    // depend on its fill or the white number becomes invisible on white paper.
    const print = STYLE.slice(STYLE.indexOf('@media print'));
    expect(print).toMatch(/\.step-no\s*\{[^}]*border/);
    expect(print).toMatch(/\.step-no\s*\{[^}]*color:\s*#000/);
  });
});
