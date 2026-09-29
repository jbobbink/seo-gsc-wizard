#!/usr/bin/env node
/**
 * Builds the OpenAI plugin skill bundle from this repo's Claude Code plugin.
 *
 * The OpenAI plugin portal (platform.openai.com/plugins -> Skills step) accepts a ZIP
 * whose root holds `.claude-plugin/plugin.json` plus `skills/<name>/SKILL.md`; the portal
 * rewrites the manifest to `.codex-plugin/plugin.json` on upload. Skills must be
 * provider-neutral, so this script strips the Claude Code idioms (`$ARGUMENTS`, `/mcp`)
 * and asserts none survive.
 *
 * Output: dist/openai-bundle/ and dist/seo-gsc-wizard-openai-skills.zip
 * Usage:  node scripts/build-openai-bundle.mjs [--check]
 *   --check verifies the transforms still apply cleanly without writing the ZIP.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "dist", "openai-bundle");
// The in-draft Skills tab rejects anything but a single top-level entry:
// "Skill zip must contain one skill root or one directory of skill roots."
const skillsZipPath = path.join(root, "dist", "seo-gsc-wizard-skills.zip");
// The whole-plugin layout, for the "Create plugin -> Skills only" upload path instead.
const pluginZipPath = path.join(root, "dist", "seo-gsc-wizard-plugin.zip");
const checkOnly = process.argv.includes("--check");

// The Claude-facing manifest description names Claude; the OpenAI listing must not.
const OPENAI_DESCRIPTION =
  "Google Search Console, Bing Webmaster and GA4 analytics: 100+ SEO tools plus guided " +
  "workflows for site audits, content decay, keyword cannibalization, quick wins, " +
  "indexing health and weekly reporting.";

const MCP_SERVER = {
  name: "gsc-wizard",
  url: "https://mcp.gscwizard.com/mcp",
  description:
    "GSC Wizard: Google Search Console, Bing Webmaster and GA4 analytics tools, OAuth 2.1.",
};

/** Ordered rewrites that turn Claude Code phrasing into provider-neutral prose. */
const REWRITES = [
  // These two would read redundantly under the generic rewrite below.
  [/\(or `\$ARGUMENTS`\)/g, "(or the request)"],
  [/ in `\$ARGUMENTS`/g, " in their request"],
  // Sentence-initial occurrences need a capital.
  [/([.!?]\s+)`\$ARGUMENTS`/g, "$1The user's request"],
  [/`\$ARGUMENTS`/g, "the user's request"],
  // `/mcp` is a Claude Code slash command; ChatGPT users reconnect the app instead.
  [
    /run `\/mcp` to \(re\)authenticate/g,
    "reconnect the GSC Wizard app from their ChatGPT connector settings",
  ],
];

/** Tokens that must not appear anywhere in the built bundle. */
const FORBIDDEN = [/claude/i, /anthropic/i, /\$ARGUMENTS/, /`\/mcp`/];

function rmrf(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function transformSkill(name, source) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(source);
  if (!match) throw new Error(`${name}: SKILL.md has no YAML frontmatter`);

  let [frontmatter, body] = [match[1], source.slice(match[0].length)];

  // Claude Code infers the skill name from its directory; OpenAI wants it declared.
  if (!/^name:/m.test(frontmatter)) frontmatter = `name: ${name}\n${frontmatter}`;

  for (const [pattern, replacement] of REWRITES) {
    frontmatter = frontmatter.replace(pattern, replacement);
    body = body.replace(pattern, replacement);
  }

  return `---\n${frontmatter}\n---\n${body}`;
}

function buildManifest() {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, ".claude-plugin", "plugin.json"), "utf8"),
  );
  manifest.description = OPENAI_DESCRIPTION;
  manifest.skills = "./skills/"; // required by the OpenAI manifest schema
  return manifest;
}

function buildAgentsYaml() {
  return `# Declares the MCP server the bundled skills call into.
dependencies:
  tools:
    - type: "mcp"
      value: "${MCP_SERVER.name}"
      description: "${MCP_SERVER.description}"
      transport: "streamable_http"
      url: "${MCP_SERVER.url}"
`;
}

const skillsDir = path.join(root, "skills");
const skillNames = fs
  .readdirSync(skillsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

if (skillNames.length === 0) throw new Error("no skills found under skills/");

const files = new Map();
files.set(".claude-plugin/plugin.json", `${JSON.stringify(buildManifest(), null, 2)}\n`);
files.set("agents/openai.yaml", buildAgentsYaml());

for (const name of skillNames) {
  const skillRoot = path.join(skillsDir, name);
  const skillFile = path.join(skillRoot, "SKILL.md");
  if (!fs.existsSync(skillFile)) throw new Error(`${name}: missing SKILL.md`);
  files.set(
    `skills/${name}/SKILL.md`,
    transformSkill(name, fs.readFileSync(skillFile, "utf8")),
  );

  // Carry any references/, assets/ and scripts/ the skill ships with.
  for (const sub of ["references", "assets", "scripts"]) {
    const subDir = path.join(skillRoot, sub);
    if (!fs.existsSync(subDir)) continue;
    const walk = (dir, prefix) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, `${prefix}/${entry.name}`);
        else files.set(`${prefix}/${entry.name}`, fs.readFileSync(full, "utf8"));
      }
    };
    walk(subDir, `skills/${name}/${sub}`);
  }
}

const violations = [];
for (const [name, content] of files) {
  for (const pattern of FORBIDDEN) {
    if (pattern.test(content)) violations.push(`${name}: matches ${pattern}`);
  }
}
if (violations.length > 0) {
  console.error("Provider-neutral check failed:\n" + violations.map((v) => `  ${v}`).join("\n"));
  process.exit(1);
}

if (checkOnly) {
  console.log(`OK: ${skillNames.length} skills transform cleanly (${files.size} files).`);
  process.exit(0);
}

rmrf(outDir);
for (const [name, content] of files) {
  const dest = path.join(outDir, name);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content);
}

function zip(dest, source) {
  fs.rmSync(dest, { force: true });
  execFileSync("7z", ["a", "-tzip", "-bso0", "-bsp0", dest, source], { stdio: "inherit" });
  const kb = (fs.statSync(dest).size / 1024).toFixed(1);
  console.log(`  ${path.relative(root, dest)} (${kb} KB)`);
}

console.log(`Built ${skillNames.length} skills:`);
console.log(skillNames.map((n) => `  - ${n}`).join("\n"));
// Zipping the skills/ directory itself (not its contents) keeps it the sole root entry.
zip(skillsZipPath, path.join(outDir, "skills"));
zip(pluginZipPath, path.join(outDir, "*"));
