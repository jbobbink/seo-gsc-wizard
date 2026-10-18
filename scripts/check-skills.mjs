#!/usr/bin/env node
/**
 * Grounding check for the skills in this repo.
 *
 * Each skills/<name>/SKILL.md tells an agent which GSC Wizard MCP tools to call, so
 * a skill that names a tool the server does not have sends the agent down a dead
 * end. This script holds every skill to the server's real tool list (vendored in
 * scripts/mcp-tool-names.txt) and to the rules build-openai-bundle.mjs enforces,
 * so a broken skill fails here, with file and line, before it breaks the bundle.
 *
 * Usage:  node scripts/check-skills.mjs
 *   Exit 1 with the list of violations; exit 0 with a one-line summary that also
 *   warns about allowlisted tools no skill references yet.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillsDir = path.join(root, "skills");
// The skill whose Grounding paragraph every other skill must carry verbatim.
const REFERENCE_SKILL = "site-audit";
const README_PREFIX = "/seo-gsc-wizard:";
// The only form of each Claude Code idiom that build-openai-bundle.mjs rewrites.
const ARGUMENTS_CODE = "`$ARGUMENTS`";
const MCP_PHRASE = "run `/mcp` to (re)authenticate";
const [MIN_WORDS, MAX_WORDS] = [40, 130];

/**
 * Mirrors FORBIDDEN in build-openai-bundle.mjs minus its two Claude Code idioms
 * (`$ARGUMENTS` and `/mcp`), which that build rewrites and this script checks by
 * placement instead. The two lists must stay in step.
 */
const FORBIDDEN = [
  /claude/i,
  /anthropic/i,
  /chatgpt/i,
  /openai/i,
  /\bgpt\b/i,
  /perplexity/i,
  /gemini/i,
  /copilot/i,
  /\bgrok\b/i,
];
const DASH = /[–—]/; // en dash, em dash
const TOOL_TOKEN = /`([a-z]+(?:_[a-z0-9]+)+)`/g;

const read = (file) => fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// '#' lines and blank lines in the allowlist are comments.
const allowlist = new Set(
  read(path.join(root, "scripts", "mcp-tool-names.txt"))
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#")),
);
// Only a token whose first segment is a verb the server uses counts as a tool
// reference; response values like `not_connected` share the shape, never the prefix.
const prefixes = new Set([...allowlist].map((name) => name.split("_")[0]));
// Response values that happen to start with one of those verbs. Each is a real
// value a tool returns (see MCP/src/tools/run-feed-audit.ts for the first two).
const RESPONSE_VALUES = new Set(["run_in_progress", "run_exists_today"]);

const violations = [];
const referenced = new Set();

function groundingParagraph() {
  const file = path.join(skillsDir, REFERENCE_SKILL, "SKILL.md");
  const match = fs.existsSync(file) && /^## Grounding\n+(.+)$/m.exec(read(file));
  if (!match) {
    violations.push(`skills/${REFERENCE_SKILL}/SKILL.md: reference Grounding paragraph not found`);
    return null;
  }
  return match[1].trim();
}

function checkSkill(name, grounding) {
  const rel = `skills/${name}/SKILL.md`;
  const file = path.join(skillsDir, name, "SKILL.md");
  const fail = (message, line) => violations.push(`${rel}${line ? `:${line}` : ""}: ${message}`);
  if (!fs.existsSync(file)) return fail("missing SKILL.md");
  const source = read(file);

  const fm = /^---\n([\s\S]*?)\n---\n/.exec(source);
  if (!fm) fail("no YAML frontmatter");
  else {
    const field = (key) => {
      const m = new RegExp(`^${key}:[ \\t]*(.*)$`, "m").exec(fm[1]);
      return m ? m[1].trim().replace(/^(["'])(.*)\1$/, "$2") : null;
    };
    const declared = field("name");
    if (declared === null) fail("frontmatter has no name:");
    else if (declared !== name) fail(`name: is "${declared}" but the directory is "${name}"`);
    const description = field("description");
    const continues = /^description:.*\n[ \t]+\S/m.test(fm[1]);
    if (!description || /^[>|]/.test(description) || continues) {
      fail("description: must be present and a single line");
    } else {
      const words = description.split(/\s+/).length;
      if (words < MIN_WORDS || words > MAX_WORDS) {
        fail(`description: is ${words} words (must be ${MIN_WORDS} to ${MAX_WORDS})`);
      }
    }
  }

  if (grounding && !source.includes(grounding)) {
    fail(`Grounding paragraph missing or not verbatim from skills/${REFERENCE_SKILL}/SKILL.md`);
  }

  source.split("\n").forEach((text, index) => {
    const line = index + 1;
    if (DASH.test(text)) fail("contains an en or em dash", line);
    for (const pattern of FORBIDDEN) {
      if (pattern.test(text)) fail(`matches forbidden ${pattern}`, line);
    }
    if (text.split(ARGUMENTS_CODE).join("").includes("$ARGUMENTS")) {
      fail(`$ARGUMENTS outside backticks (write ${ARGUMENTS_CODE})`, line);
    }
    if (text.split(MCP_PHRASE).join("").includes("/mcp")) {
      fail(`/mcp outside the phrase "${MCP_PHRASE}"`, line);
    }
    for (const [, token] of text.matchAll(TOOL_TOKEN)) {
      if (!prefixes.has(token.split("_")[0]) || RESPONSE_VALUES.has(token)) continue;
      if (allowlist.has(token)) referenced.add(token);
      else fail(`unknown tool \`${token}\` (not in scripts/mcp-tool-names.txt)`, line);
    }
  });
}

const skillNames = fs
  .readdirSync(skillsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
if (skillNames.length === 0) violations.push("skills/: no skill directories found");

const grounding = groundingParagraph();
for (const name of skillNames) checkSkill(name, grounding);

const readme = read(path.join(root, "README.md"));
for (const name of skillNames) {
  const listed = new RegExp(`${escapeRegExp(README_PREFIX + name)}(?![\\w-])`).test(readme);
  if (!listed) violations.push(`README.md: does not list ${README_PREFIX}${name}`);
}

if (violations.length > 0) {
  const noun = violations.length === 1 ? "violation" : "violations";
  console.error(
    `Skill check failed (${violations.length} ${noun}):\n` +
      violations.map((v) => `  ${v}`).join("\n"),
  );
  process.exit(1);
}

const uncovered = [...allowlist].filter((name) => !referenced.has(name));
const warning =
  uncovered.length > 0
    ? ` Warning: ${uncovered.length} tools no skill references: ${uncovered.join(", ")}.`
    : "";
console.log(
  `OK: ${skillNames.length} skills checked, ${referenced.size} of ${allowlist.size} tools referenced.${warning}`,
);
