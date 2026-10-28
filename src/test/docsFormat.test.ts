// Keeps the repo's one writing standard (docs/operations/change-records.md) in force.
// Lovable and Claude both write records; this test is what makes the format stick:
// it fails CI when a change record, decision note or runbook added from 2026-10-28 on
// is missing a required heading or field, when a new record is not listed in the docs
// index, or when the rule files stop pointing at the standard. Older notes are left in
// their original shape on purpose, so only files dated on or after CUTOFF are checked.

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const CUTOFF = "2026-10-28";
const STANDARD = "docs/operations/change-records.md";

const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const mdFiles = (dir: string) =>
  readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith(".md") && f !== "_TEMPLATE.md" && f !== "README.md");
const datedOnOrAfterCutoff = (f: string) => {
  const m = /^(\d{4}-\d{2}-\d{2})-/.exec(f);
  return !!m && m[1] >= CUTOFF;
};

const RECORD_FIELDS = ["Date", "Author", "Request", "Branch / PR", "Status", "Decision notes"];
const RECORD_HEADINGS = ["Why", "What changed", "How it works", "How to check it", "Deploy steps", "Rollback", "Open items"];
const DECISION_FIELDS = ["Decision", "Why", "Not doing", "Where"];
const RUNBOOK_FIELDS = ["Use this when", "Before you start", "Owner"];
const RUNBOOK_HEADINGS = ["Steps", "Check", "If it goes wrong"];

/** Problems with a doc: missing `- **Field:**` bullets and missing, empty or out-of-order `## Heading`s. */
function problems(src: string, fields: string[], headings: string[], ordered: boolean): string[] {
  const out: string[] = [];
  for (const f of fields) {
    if (!new RegExp(`^- \\*\\*${f.replace(/[/]/g, "\\/")}:\\*\\*\\s*\\S`, "m").test(src)) out.push(`missing field "${f}"`);
  }
  let last = -1;
  for (const h of headings) {
    const at = src.search(new RegExp(`^## ${h}\\s*$`, "m"));
    if (at < 0) { out.push(`missing heading "## ${h}"`); continue; }
    if (ordered && at < last) out.push(`heading "## ${h}" is out of order`);
    last = Math.max(last, at);
    const body = src.slice(at).split("\n").slice(1).join("\n").split(/^## /m)[0];
    if (!body.replace(/<!--[\s\S]*?-->/g, "").trim()) out.push(`heading "## ${h}" is empty (write "None." if it does not apply)`);
  }
  return out;
}

describe("templates carry the format they ask for", () => {
  it("change record template", () => {
    expect(problems(read("docs/changes/_TEMPLATE.md"), RECORD_FIELDS, RECORD_HEADINGS, true)).toEqual([]);
  });
  it("decision template", () => {
    expect(problems(read("docs/decisions/_TEMPLATE.md"), DECISION_FIELDS, [], false)).toEqual([]);
  });
  it("runbook template", () => {
    expect(problems(read("docs/operations/_TEMPLATE.md"), RUNBOOK_FIELDS, RUNBOOK_HEADINGS, true)).toEqual([]);
  });
});

describe("change records (docs/changes, dated from 2026-10-28)", () => {
  const index = read("docs/README.md");
  const files = mdFiles("docs/changes").filter(datedOnOrAfterCutoff);
  it("there is at least one to check", () => expect(files.length).toBeGreaterThan(0));
  for (const f of files) {
    it(f, () => {
      expect(problems(read(`docs/changes/${f}`), RECORD_FIELDS, RECORD_HEADINGS, true), f).toEqual([]);
      expect(index.includes(`changes/${f}`), `${f} is not listed in docs/README.md`).toBe(true);
    });
  }
});

describe("decision notes (docs/decisions, dated from 2026-10-28)", () => {
  const log = read("docs/decisions/README.md");
  // Keeps the suite non-empty before the first dated decision exists.
  it("the decisions log exists", () => expect(log).toContain("## Log"));
  for (const f of mdFiles("docs/decisions").filter(datedOnOrAfterCutoff)) {
    it(f, () => {
      expect(problems(read(`docs/decisions/${f}`), DECISION_FIELDS, [], false), f).toEqual([]);
      expect(log.includes(`(${f})`), `${f} is not listed in docs/decisions/README.md`).toBe(true);
    });
  }
});

describe("runbooks (docs/operations, all)", () => {
  for (const f of mdFiles("docs/operations")) {
    it(f, () => {
      expect(problems(read(`docs/operations/${f}`), RUNBOOK_FIELDS, RUNBOOK_HEADINGS, true), f).toEqual([]);
    });
  }
});

describe("the rule files point every writer at the standard", () => {
  it("AGENTS.md (read by Lovable on every request) opens with the change-record section", () => {
    // A Lovable-managed block, when present, stays first; the standard opens right after it.
    const agents = read("AGENTS.md").replace(/^<!-- LOVABLE:BEGIN -->[\s\S]*?<!-- LOVABLE:END -->\s*/, "");
    expect(agents.startsWith("# Every change leaves a record")).toBe(true);
    expect(agents).toContain(STANDARD);
    expect(agents).toContain("docs/changes/_TEMPLATE.md");
  });
  it("CLAUDE.md has the rule", () => {
    const claude = read("CLAUDE.md");
    expect(claude).toContain("## Every Change Leaves a Record");
    expect(claude).toContain(STANDARD);
  });
  it("the change-records skill is loadable by Claude Code", () => {
    expect(existsSync(path.join(ROOT, ".claude/skills/change-records/SKILL.md"))).toBe(true);
    expect(read(".agents/skills/change-records/SKILL.md")).toContain(STANDARD);
  });
  it("the PR template uses the change-record headings", () => {
    const pr = read(".github/pull_request_template.md");
    expect(pr).toContain("docs/changes/");
    for (const h of ["Why", "What changed", "How to check it", "Deploy steps", "Rollback", "Open items"]) {
      expect(pr, h).toMatch(new RegExp(`^## ${h}$`, "m"));
    }
  });
  it("the docs index points at the standard", () => {
    expect(read("docs/README.md")).toContain("operations/change-records.md");
  });
});
