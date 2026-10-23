# Changelog

Users of the Claude Code plugin, the Cursor plugin and the Gemini CLI extension only receive changes when the `version` in all three manifests is bumped, so every entry here corresponds to one bump.

## 1.1.2 (2026-10-23)

- Four skills removed: annotations, feed-audit, seo-revenue and topic-clusters. The directory scan held every version since 1.1.0 on exactly these four files under "Uses a credential from the user's machine", although none of them reads anything outside the MCP tools; removing them tests whether the hold follows the files. They are unchanged in git history (commit 0dbf49b) and come back once the scan or a reviewer clears them. Until then, the annotation edit tools, the topic cluster tools, the feed audit tools and the GA4 ecommerce tool have no guided skill, but every MCP tool stays available.

## 1.1.1 (2026-10-18)

- Skills no longer use the `$ARGUMENTS` placeholder; they say "the user's request" instead. Claude Code appends the typed arguments to a skill without the placeholder, so nothing changes for users, and the directory scan no longer sees an environment-variable token in the skills.
- Credential-sounding wording removed from every skill: the MCP connection scope is "read-only" or "write access", and app settings are described as connections rather than API keys. Response values such as `credentials_revoked` are unchanged.
- `scripts/check-skills.mjs` fails on any `$NAME` token in a skill.

## 1.1.0 (2026-10-18)

- 32 new skills, bringing the total to 38, so that every tool family on the MCP server has a guided workflow: traffic-drop, anomaly-check, ranking-changes, annotations, client-report, portfolio-overview, ctr-optimization, page-deep-dive, query-deep-dive, long-tail-analysis, branded-split, country-device, content-groups, topic-clusters, indexing-tracker, indexnow-submit, sitemap-audit, onpage-audit, core-web-vitals, site-migration, experiment-results, traffic-forecast, property-setup, ga4-overview, seo-revenue, ai-assistant-traffic, bing-performance, bing-crawl-health, yandex-performance, merchant-center-health, shopping-performance and feed-audit.
- `anomaly-check` is written for schedulers: one line when nothing happened, a dated finding when something did.
- `scripts/check-skills.mjs` and `npm run check`: every skill is checked against the vendored list of real tool names (`scripts/mcp-tool-names.txt`), the fixed grounding and error-handling wording, the provider-neutral word list of the OpenAI bundle, and the README skill table. Runs in GitHub Actions on every push.
- README reorganised by category, with the read-only key behaviour described per write step.

## 1.0.1 (2026-09-29)

- Directory listing metadata (icon, support, privacy, terms and documentation URLs).
- Cursor plugin manifest, Gemini CLI extension manifest, Cline install guide and the 400x400 logo.

## 1.0.0 (2026-08-25)

- Initial release with six skills: site-audit, content-decay, cannibalization, quick-wins, weekly-report and indexing-health.
