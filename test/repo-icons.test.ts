/**
 * The two generated lists must stay one list.
 *
 * `scripts/gen-repo-icons.mjs` emits `media/repo-icons.js` (what the picker
 * draws) and `src/repo-icon-ids.ts` (what the host will accept). They are
 * written from one table in one run, so they agree the moment they are
 * generated — and they drift the first time somebody hand-edits one of them.
 * The failure is silent and one-sided: the picker offers a mark, the user picks
 * it, `setRepoIcon` drops it on the floor, and nothing anywhere says why.
 */
import { describe, expect, it } from "vitest";
import { Window } from "happy-dom";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { REPO_ICON_IDS, isRepoIcon } from "../src/sessions";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

interface Marks {
  VIEW_BOX: string;
  DEFAULT_ID: string;
  GROUPS: { id: string; label: string; icons: [string, string][] }[];
  IDS: string[];
  has: (id: string) => boolean;
  labelFor: (id: string) => string;
  svg: (id: string) => string;
}

function loadMarks(): Marks {
  const window = new Window({ url: "https://example.test/" });
  window.eval(read("../media/repo-icons.js"));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).GrokRepoIcons as Marks;
}

const marks = loadMarks();

describe("project mark catalogue", () => {
  it("offers the host exactly the ids the host accepts", () => {
    expect([...marks.IDS].sort()).toEqual([...REPO_ICON_IDS].sort());
    for (const id of marks.IDS) expect(isRepoIcon(id)).toBe(true);
  });

  it("puts every choosable mark in exactly one group, and the default in none", () => {
    const grouped = marks.GROUPS.flatMap((g) => g.icons.map(([id]) => id));
    expect(new Set(grouped).size).toBe(grouped.length);
    expect(grouped).not.toContain(marks.DEFAULT_ID);
    // The default is still a legitimate value on the wire — it is only absent
    // from the picker, so that one appearance never has two controls.
    expect(marks.has(marks.DEFAULT_ID)).toBe(true);
    expect(isRepoIcon(marks.DEFAULT_ID)).toBe(true);
    expect([...grouped, marks.DEFAULT_ID].sort()).toEqual([...marks.IDS].sort());
  });

  it("draws every id on one grid, and nothing for an id it does not know", () => {
    for (const id of marks.IDS) {
      const svg = marks.svg(id);
      expect(svg, id).toContain(`viewBox="${marks.VIEW_BOX}"`);
      expect(svg, id).toContain('fill="currentColor"');
      // A mark with no path renders as an empty box — the exact failure the
      // relay's screens gate was written for, cheaper to catch here.
      expect(/\sd="[^"]{10,}"/.test(svg), id).toBe(true);
      // The default is drawn but never offered, so it alone has no label: the
      // picker's own cell says "Default folder" and stores "" (no mark).
      if (id !== marks.DEFAULT_ID) expect(marks.labelFor(id).length, id).toBeGreaterThan(0);
    }
    expect(marks.svg("")).toBe("");
    expect(marks.svg("not_a_material_symbol")).toBe("");
    expect(marks.has("not_a_material_symbol")).toBe(false);
  });

  it("takes an empty choice as 'no mark' and refuses anything else", () => {
    expect(isRepoIcon("")).toBe(true);
    expect(isRepoIcon("not_a_material_symbol")).toBe(false);
    expect(isRepoIcon(undefined)).toBe(false);
    expect(isRepoIcon(null)).toBe(false);
    expect(isRepoIcon(7)).toBe(false);
  });

  it("names every mark distinctly, so the search box can tell them apart", () => {
    const labels = marks.GROUPS.flatMap((g) => g.icons.map(([, label]) => label.toLowerCase()));
    expect(new Set(labels).size).toBe(labels.length);
  });
});
