/**
 * Tests for the Inventory and Project renderers.
 *
 * These two specs had no reference renderer at all, which left a third of the
 * format's document types unreadable without an application. Beyond the shared
 * self-containment and escaping rules, the cases that matter here are the
 * judgement calls: an inventory carries the most personal data in the format,
 * and a project carries substitution claims that must not be upgraded.
 */

import { describe, expect, it } from 'vitest';
import { parseInventoryDocument, type InventoryDocument } from '../inventory';
import { parseProjectDocument, type ProjectDocument } from '../project';
import { renderInventoryHtml, renderProjectHtml } from './index';

function inventory(overrides: Partial<InventoryDocument> = {}): InventoryDocument {
  return parseInventoryDocument({
    spec: 'inventory',
    specVersion: '1.0.0',
    id: 'urn:uuid:9b8c7d6e-5f40-4132-8a24-b3c4d5e6f708',
    revision: 'rev-1',
    title: 'My paints',
    items: [{ paint: { manufacturer: 'Some Brand', name: 'Steel' }, quantity: 2, unit: 'bottle' }],
    ...overrides,
  });
}

function project(overrides: Partial<ProjectDocument> = {}): ProjectDocument {
  return parseProjectDocument({
    spec: 'project',
    specVersion: '1.0.0',
    id: 'https://example.org/projects/squad',
    revision: 'rev-1',
    title: 'Rusted squad',
    status: 'active',
    ...overrides,
  });
}

describe('renderInventoryHtml', () => {
  it('renders a self-contained page with the paints owned', () => {
    const html = renderInventoryHtml(inventory());
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<h1>My paints</h1>');
    expect(html).toContain('Some Brand - Steel');
    expect(html).toContain('2 bottles');
    expect(html).not.toMatch(/<link\b/);
    expect(html).not.toMatch(/<script\b/);
    expect(html).not.toMatch(/src\s*=\s*["']https?:/i);
  });

  it('shows private data as given and says the page contains it', () => {
    // The renderer does not strip: the producer decides what to share (that is
    // what the shared export profile is for). What it must not do is contain
    // private data without saying so.
    const html = renderInventoryHtml(
      inventory({
        items: [
          {
            paint: { name: 'Steel' },
            visibility: 'private',
            private: { storageLocation: 'Drawer 1', notes: 'Almost empty' },
          },
        ],
      }),
    );
    expect(html).toContain('Drawer 1');
    expect(html).toContain('Almost empty');
    expect(html).toContain('private');
    expect(html).toContain('Profile');
    expect(html).toContain('1 private item(s)');
  });

  it('says so plainly when there is no private data at all', () => {
    expect(renderInventoryHtml(inventory())).toContain('no private data present');
  });

  it('escapes hostile strings anywhere in the document', () => {
    const html = renderInventoryHtml(
      inventory({
        title: 'Evil <script>alert(1)</script>',
        items: [
          {
            paint: { name: '"><img src=x onerror=alert(2)>' },
            private: { notes: '<b>not bold</b>' },
          },
        ],
      }),
    );
    expect(html).not.toMatch(/<script\b/);
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<b>not bold</b>');
  });
});

describe('renderProjectHtml', () => {
  it('renders subjects, stages and checklists', () => {
    const html = renderProjectHtml(
      project({
        subjects: [
          {
            name: 'Sergeant',
            status: 'in_progress',
            progress: 60,
            stages: [{ name: 'Basecoat', status: 'done' }],
            checklist: [{ task: 'Seal after weathering', done: false }],
          },
        ],
      }),
    );
    expect(html).toContain('Sergeant');
    expect(html).toContain('in progress');
    expect(html).toContain('60%');
    expect(html).toContain('Basecoat');
    expect(html).toContain('Seal after weathering');
  });

  it('keeps a substitution class distinct — a computed match never reads as tested', () => {
    const html = renderProjectHtml(
      project({
        substitutions: [
          {
            original: { name: 'Steel' },
            substitute: { name: 'Cold Steel' },
            type: 'mathematical',
            note: 'Nearest owned color by CIEDE2000.',
          },
        ],
      }),
    );
    expect(html).toContain('mathematical (color distance)');
    expect(html).not.toContain('verified');
  });

  it('flags a private journal entry rather than hiding it', () => {
    const html = renderProjectHtml(
      project({
        journal: [
          { body: 'Public note.', minutesSpent: 40 },
          { body: 'Personal note.', visibility: 'private' },
        ],
      }),
    );
    expect(html).toContain('Public note.');
    expect(html).toContain('Personal note.');
    expect(html).toContain('private');
  });

  it('labels logged time as a sum, never as a figure the author stated', () => {
    const html = renderProjectHtml(
      project({
        journal: [
          { body: 'Session one.', minutesSpent: 40 },
          { body: 'Session two.', minutesSpent: 35 },
        ],
      }),
    );
    expect(html).toContain('75 min (sum of journal entries)');
  });

  it('links result media rather than embedding it', () => {
    const html = renderProjectHtml(
      project({
        results: [
          { url: 'https://example.org/finished.jpg', kind: 'image', caption: 'Finished squad' },
        ],
      }),
    );
    expect(html).toContain('href="https://example.org/finished.jpg"');
    expect(html).not.toMatch(/<img\b/);
  });

  it('escapes hostile strings anywhere in the document', () => {
    const html = renderProjectHtml(
      project({
        title: 'Evil <script>alert(1)</script>',
        journal: [{ body: '"><img src=x onerror=alert(2)>' }],
      }),
    );
    expect(html).not.toMatch(/<script\b/);
    expect(html).not.toContain('<img src=x');
  });
});
