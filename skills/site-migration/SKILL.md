---
name: site-migration
description: Check a site migration (a domain move, an HTTP to HTTPS switch, a URL restructure) before and after go-live with the migration tools of the GSC Wizard MCP server: the saved migrations, the health check around go-live (recovery, pace, momentum, projected milestones, URL success, a 0-100 risk score), the before-versus-after query and page winners and losers, the saved old-to-new redirect mappings, a quota-aware inspection of the worst new URLs, and a go-live annotation. Use when the user asks "how is the migration going", "did the site lose traffic after the domain move", "check my redirects", "which old URLs are not recovering", or wants a pre-launch baseline.
---

# Site Migration Check

Read out a site migration before or after go-live: how much of the old traffic the new setup has recovered, where the losses sit, which old URLs are unmapped or failing, and what to fix first. `$ARGUMENTS` may contain the old and new property, a go-live date, a saved migration name, a mapping label, a URL prefix or regex pair for a move inside one property, or a focus such as "redirects" or "losers".

## Steps

1. **Resolve the properties.** If `$ARGUMENTS` or the conversation names a property, use it. Site URLs use GSC formats: `sc-domain:example.com` or `https://www.example.com/`. Otherwise call `list_sites` and pick the obvious match. If several plausible properties exist, ask the user which one before continuing. A migration has two sides:
   - for a domain move, side A is the old property and side B the new one, and both must be in `list_sites`;
   - for a protocol switch or a URL restructure inside one property, both sides are the same property split by a URL prefix or a regex;
   - the go-live date is required: ask for it when neither `$ARGUMENTS` nor a saved migration supplies one, because `get_migration_health` refuses to run without a `goLiveDate` or a `migrationId` that carries one.

2. **Saved migrations.** Call `list_migrations` (no arguments).
   - Each entry carries `id`, `name`, `mode` (`cross-property`, `two-urls` or `regex`), `siteUrlA`, `siteUrlB`, `urlPrefixA` / `urlPrefixB` or `regexA` / `regexB`, `goLiveDate`, `windowStrategy`, `windowDays`, `yoyBaseline`, `mappingLabel`, `alertsEnabled`, `lastCheckedAt` and `lastHealth` (the daily re-check's last status, recovery, risk score and problem counts).
   - Pick the one the user means, or ask when several match.
   - An empty list carries `emptyBecause` (saved migrations are not available on the account, or none are saved) and `nextStep`; continue with explicit arguments, since nothing needs to be saved to run the analysis.

3. **Health check.** Call `get_migration_health` with `siteUrl` set to the OLD property (side A) and either `migrationId` (its saved setup fills in everything the arguments leave out) or `siteUrlB` plus `goLiveDate`.
   - Without a `migrationId` the tool always runs in cross-property mode, and omitting `siteUrlB` reads one property joined by path. The prefix or regex split of a move inside one property comes only from a saved migration, so without one use `compare_migration` (step 4) for that case.
   - Options: `windowStrategy` `recent` (default: the last `windowDays` days against the `windowDays` days before go-live), `from-go-live` (the first `windowDays` days after launch, dip included) or `full` (the 90 days before against every day since); `windowDays` 1 to 365 (default 28); `yoyBaseline: true` to compare with the same weeks a year earlier when the migration straddles a seasonal turn; `mappingLabel` to narrow the redirect mappings (`__none__` means unlabelled only); `onlyMapped: true` to count only the pages the mappings claim.
   - `health`: `status`, `headline`, `recoveryPct` (new clicks per day as a share of the old), `baselineClicksPerDay`, `currentClicksPerDay`, `daysSinceGoLive`, `stage`, `pace` (`status`, `expectedPct`, `ratio` against the stage's expected recovery), `momentum` (`status`, `changePct`, `last7`, `prior7`), `projection` (the recovery milestones), `urlSuccess` (`units`, `failed`, `partial`, `insufficient`; null without mappings), `risk` (`score` 0 to 100, `level`, `factors`) and `recommendations`.
   - `health` is null until a post-launch day has final data; before go-live the response still holds the baseline window, the mapping counts and the launch `checklist`, which is the pre-launch readout.
   - `summary` (totals and per-day figures for A before and B after, residual old URLs, pre-launch new URLs, mapping coverage) and `redirects` (`total`, `checked`, `byStatus`, `byFlag` from the stored checks; statuses include `migrated`, `kept`, `chain`, `temporary`, `wrong_target`, `not_redirected`, `broken_source` and `broken_target`).
   - `topLostPages`, `topRedirectProblems`, `topLostQueries`, `topLosingSections`, `handover`, `waterfall`, and `segments` (`countries` and `devices` with `clicksBefore`, `clicksAfter`, `recoveryPct`, `shareBefore`, `shareAfter`).
   - `warnings` (`code`, `severity`, `message`; `go_live_in_future` means there is no post-launch data yet) and `truncated` / `truncatedReads`.
   - The call costs 5 rate-limit units plus 1 per 2,000 mappings, so run it once per window, not once per question.

4. **Winners and losers.** Call `compare_migration` with the `mode` and its sides: `cross-property` takes `siteUrl` and `siteUrlB`; `two-urls` takes `siteUrl` plus `urlPrefixA` and `urlPrefixB` (a full URL, a host, or a path on any host); `regex` takes `siteUrl` plus `regexA` and `regexB` (2,000 characters at most, no nested quantifiers such as `(a+)+`).
   - Pass the same `goLiveDate`, `windowStrategy`, `windowDays` and `yoyBaseline` as step 3, never `startDate` / `endDate` together with `goLiveDate`, and `limit` up to 500 (default 50).
   - Read `summary.A` and `summary.B` (`totalClicks`, `totalImpressions`, `avgCtr`, `avgPosition`), `recoveryPct` with `recoveryNote` (null under 10 baseline clicks or before any post-launch day), and `dailyTrend`.
   - `queries` and `pages` carry `topGainers` and `topLosers` (by `clicksDelta`), `trends` (with `goLiveDate` only: rows and clicks per lost, declined, stable, improved, new and inactive) and `pages.joinedBy` (`path` when two properties are joined by path, `url` otherwise). Lists cover the top 25,000 rows per side; `truncated` and `truncationNote` say when a cap was hit.
   - Without a `goLiveDate` the tool compares both sides over one shared window (default the last 28 settled days), which is the pre-launch way to size side A against a section of side B.
   - GSC data lags about 2 to 3 days: never treat the most recent 2 days as complete, and if a dip appears at the very edge of the range, say it is likely reporting lag, not a real drop.
   - `ctr` values are already percentages on a 0-100 scale; never multiply them by 100. `position`: lower is better; a change toward a lower number is an improvement.

5. **Redirect mappings.** Call `list_migration_redirects` with `summaryOnly: true` first (one row per pair and label: `siteUrlA`, `siteUrlB`, `label`, `count`, plus `totalMappings`), then without it, filtered by `siteUrlA`, `siteUrlB` and `label` with `limit` up to 5,000 (default 500), when the rows are needed (`fromUrl`, `toUrl`, `label`, `createdAt`).
   - Cross the mapping against `topLostPages` and `topRedirectProblems`: an old URL losing clicks with no mapping is unmapped; one mapped to a target that gets nothing is a redirect that does not work.
   - When the user supplies old-to-new pairs, ALWAYS show the exact rows and ask for confirmation, then call `add_migration_redirects` with `siteUrlA`, `siteUrlB`, `redirects` (`fromUrl`, `toUrl`; up to 10,000 per call) and a `label` naming the batch. Rows are appended and never deduplicated, so re-sending a list stores it twice; the result reports `inserted` and `skipped`.
   - To remove a batch, preview it with `list_migration_redirects` using the same filters, confirm, then call `delete_migration_redirects` with `label` and/or `siteUrlA` / `siteUrlB`; the result reports `deleted`. Deleting every mapping on the account needs `confirmDeleteAll: true` and a separate, explicit confirmation from the user.
   - If a write is refused because the connection is read-only, say that this step needs write access and continue with the read-only parts.

6. **Inspect the worst new URLs (optional, quota-aware).** Call `get_inspection_quota` for the NEW property first and read `remaining` of `limit` (2,000 a day per property; `unavailable: true` means the counter could not be read).
   - Take at most 10 to 15 new URLs (the `toUrl` values) from `topLostPages` and `topRedirectProblems`, never more than 25 and never more than a small share of what remains; list them and ask the user to confirm, then call `bulk_inspect_urls` on the new property with those `urls`. It spends inspection quota and is refused on a read-only connection, in which case say this step needs write access.
   - Read per result `verdict`, `coverageState`, `indexingState`, `lastCrawlTime`, `googleCanonical` against `userCanonical` (null means Google did not report one), and `skipped` with `skipReason`; `stopReason`, `quotaExhausted` and `retryAfterSeconds` explain a run that stopped early.
   - A new URL that Google canonicalizes back to the old URL, or that is still not indexed weeks after go-live, is a redirect or canonical problem, not a ranking one. For the broader index picture run the indexing-health skill.

7. **Log go-live (optional).** Ask whether the launch is already annotated; if not, offer `create_annotation` with `siteUrl` (the new property), `eventDate` set to the go-live date, a `label` such as "Migration go-live: old.com to new.com" and an optional `description`. Show the exact values and run it only after the user confirms; a read-only connection refuses it, so say then that this step needs write access.

## Output

1. **Recovery status**: `status` and `headline` from `health`, `recoveryPct`, the per-day baseline and current clicks, `daysSinceGoLive`, `stage`, pace and momentum, the next projected milestone, and the risk score with its top factors. Before go-live, the baseline totals and the checklist instead.
2. **Winners and losers**: two compact tables from `compare_migration` (pages, then queries) with the trend bucket counts, and the sections, countries or devices from `get_migration_health` that recover worse than the whole.
3. **Unmapped and failing URLs**, as one table with a column saying which bucket each row is in:
   - old URLs with lost clicks and no mapping (from `topLostPages` crossed with the mappings);
   - redirect problems by status (from `redirects.byStatus` and `topRedirectProblems`) and the URL success counts;
   - the inspection verdicts from step 6, when it ran.
4. End with a short prioritized list of 3 to 7 concrete recommendations ordered by clicks at stake (which mappings to add, which redirects to fix, which sections to re-check, when to re-run), merged with the tool's own `recommendations`. Say when it is too early to judge: `health` null, a `go_live_in_future` warning, or an after window under a week.

Present every multi-row result as a compact markdown table (top rows only, typically 5 to 10); keep prose for interpretation, not for restating numbers. Do not fabricate rows the tools did not return.

## Error handling

If any tool call fails with an authentication or subscription error, tell the user to run `/mcp` to (re)authenticate, and that a GSC Wizard account with an active plan or trial plus a connected Google Search Console account is required. If the property is not found, re-run `list_sites` and offer the closest matches instead of guessing a URL format. If a single tool fails for another reason, report the gap in the relevant section and complete the rest of the workflow with the remaining data.

## Grounding

Every number you report must name the tool it came from and the date range it covers, for example "clicks 12,340 (`get_site_summary`, 2026-09-21 to 2026-09-27)". For a table, state the tool and date range once on the line above it. If you derive a figure yourself (a delta, a sum, a share), say so and name the tool outputs it was computed from. Never report a number no tool returned.
