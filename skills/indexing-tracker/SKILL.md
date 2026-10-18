---
name: indexing-tracker
description: Set up and run the GSC Wizard Indexing Tracker for a defined set of URLs (new content, a migration batch, one section) using the GSC Wizard MCP tools: adds the URLs, inspects a first sample against the daily quota, reads back which are indexed and which are not with their verdicts and canonicals, and turns the tracker report into a status with re-check timing. Use when the user says "track indexing of these pages", "watch whether my new posts get indexed", "monitor the migration URLs", "add these URLs to the indexing tracker", "are the tracked pages indexed yet", or wants ongoing indexing monitoring rather than a one-off diagnosis.
---

# Indexing Tracker

Put a chosen set of URLs under continuous indexing monitoring and report where they stand. The output is the tracker status, the URLs still not indexed with their verdicts, and recommendations with a re-check plan. `$ARGUMENTS` may contain a property, a list of URLs or a path prefix (for example `/blog/`), a sitemap URL, and an action hint ("add", "check", "status", "remove"). This skill sets up and monitors; when the user wants to know why pages are not indexed, run the indexing-health skill, which diagnoses by cause.

## Workflow

1. **Resolve the property.** If `$ARGUMENTS` or the conversation names a property, use it. Site URLs use GSC formats: `sc-domain:example.com` or `https://www.example.com/`. Otherwise call `list_sites` and pick the obvious match. If several plausible properties exist, ask the user which one before continuing.

2. **Read the current tracker.** Call `get_indexing_tracker` with `siteUrl`. `tracker: null` means no tracker exists yet; `add_tracked_urls` creates one, so carry on. Otherwise read `tracker.isActive` and `stats` (`total`, `indexed`, `notIndexed`, `pending`, `errors`, `warnings`, `lastCheckAt`), and compute the free capacity yourself as 1,800 minus `stats.total`, since a tracker holds at most 1,800 URLs per property. `emptyBecause` on an existing tracker means it holds no URLs.

3. **Build the URL set.** Take it from whichever source the user has:
   - The user's own list (a batch of new posts, the pages of a launch).
   - A section or a sitemap: call `list_sitemaps` to find the sitemap path, then `get_sitemap_performance` with `sitemapUrl` and `maxUrls` (default 500, max 2000) and keep the URLs whose path matches the user's prefix; its rows also show which of them already receive impressions.
   - A migration batch: call `list_migration_redirects` with `siteUrlB` set to the property (and `label` when the user names one; `limit` default 500, max 5000) and take each mapping's `toUrl`, the new URL that has to get indexed.
   Every URL must be absolute and on the property's host, or `add_tracked_urls` rejects the whole batch. Deduplicate, drop URLs the tracker already holds (step 7 lists them), and trim to the free capacity, telling the user what was left out. Prefer the pages whose indexing matters (new content, migrated URLs, revenue pages) over bulk lists.

4. **Add the URLs (write).** Before calling anything, show the user:
   - the exact URLs and their count;
   - the capacity they take out of the 1,800-URL cap;
   - that the tracker's hourly run will inspect each of them on the property's inspection quota.
   Then ask for confirmation and call `add_tracked_urls` with `siteUrl` and `urls` (1 to 1,800). Read and report `added`, `alreadyTracked`, `skippedOverCap` and `capacityRemaining`. New URLs start as `pending`. If the call is refused because the connection is read-only, say this step needs write access and continue with the read-only steps (2, 7 and 8).

5. **Check the inspection quota before any immediate check.** Call `get_inspection_quota` with `siteUrl` and read `count`, `limit` and `remaining`; the limit is 2,000 inspections per property per day, shared with the web app, and `unavailable: true` means the counter could not be read and the figures are placeholders, so treat the quota as unknown. Then plan:
   - at most 10 URLs per `check_tracked_url_now` call, and only the URLs the user cares about most;
   - the whole workflow well under half of `remaining`, since the hourly tracker run inspects the rest on its own;
   - when `remaining` is near zero, skip step 6, say the quota resets daily, and rely on steps 7 and 8.

6. **Inspect a first sample now (write, spends quota).** For the URLs the user cares about most, up to 10, list them with the quota they will spend and ask the user to confirm (a read-only connection refuses this call), then call `check_tracked_url_now` with `siteUrl` and `urls`. It inspects five at a time at about 7 seconds each. In `results` read `currentStatus`, `previousStatus`, `verdict`, `coverageState`, `lastCrawlTime`, `googleCanonical` and `userCanonical`. A brand-new URL that Google does not know yet is normal in its first days, not a failure. Rows that were not inspected say why:
   - `skipped: true` with `skipReason: "recently_checked"`: inspected within the last five minutes, so the stored row came back and no quota was spent.
   - `skipped: true` with `rate_limited` or `access_denied`: Google refused the property, the remaining URLs were left untouched, and a `stopped` block (`reason`, `message`, and `retryAfterSeconds` when Google sent one) says why; do not retry in this session.
   - `quotaExhausted: true`: the daily limit was reached mid-call, and `notChecked` names the URLs not reached.
   - `error: "not tracked"`: the URL was never added, so add it first.

7. **Read the status of the whole set.** Call `list_tracked_urls` with `siteUrl`, `filter` (`all`, `indexed`, `not_indexed`, `pending`, `errors` or `warnings`; default `all`), optionally `search` with the user's path prefix, and `pageSize` up to 1000 (default 50; `page` is one-based and `total` is the real count). Run it with `not_indexed`, then `pending`, and with `warnings` when `stats.warnings` was above zero. `configured: false` means there is no tracker. Per URL read `currentStatus`, `verdict`, `coverageState`, `lastCrawlTime`, `warningType`, `googleCanonical`, `userCanonical` and `inspectionResultLink`. Read each `currentStatus` as follows:
   - `pending`: added but not inspected yet, so nothing can be concluded.
   - `indexed` (verdict `PASS`): fine; watch `lastCrawlTime` for pages Google has not revisited in months.
   - `not_indexed`: the check ran and Google does not index the page; `coverageState` says whether Google crawled it or only discovered it, and a `googleCanonical` that differs from `userCanonical` means Google indexes another URL in its place. A `null` canonical means Google did not report one, which is common for pages it has not indexed. For the cause and the fix, run the indexing-health skill.
   - `error`: the check itself failed (counted in `stats.errors`); re-check later rather than reading it as not indexed.

8. **Tracker report.** Call `get_indexing_tracker_report` with `siteUrl` and `days` (default 30, max 90; use a short window for a batch added recently). If every URL is still `pending`, `emptyBecause` says so; report that instead of a score of 0. Otherwise read:
   - `healthScore` (0-100): half the indexed share, 30% fresh crawls, 20% warning-free share, with the parts in `breakdown.indexedPercent`, `freshCrawlPercent`, `warningFreePercent`, `totalTracked`, `warningCount` and `pendingCount`.
   - `coverageBreakdown` (URL counts per coverage state) and `crawlFreshness` (buckets by last crawl age).
   - `lostPages` and `newlyIndexed` (newest first, capped at 200), with `lostPagesTotal` and `newlyIndexedTotal` as the full counts. A failed check counts as neither lost nor newly indexed.

9. **Prune when asked (write).** When the user wants URLs dropped (retired pages, a finished batch, room for a new one), list the exact URLs, confirm, then call `remove_tracked_urls` with `siteUrl` and `urls`; read `requested` and `removed`. A removed URL stops being inspected; re-adding it starts it as `pending` again.

## Output

Present, in this order:

1. **Tracker status**: one line with whether the tracker existed or was created, the `stats` counts, `lastCheckAt`, and the add result with `capacityRemaining`.
2. **Not indexed yet** (`list_tracked_urls` plus the fresh `check_tracked_url_now` results), as a compact markdown table of the top rows, typically 5 to 10, with the full count stated; group the rest by `coverageState` with counts and list `warningType` entries separately:

| URL | Status | Verdict | Coverage state | Google canonical | Last crawl |
|---|---|---|---|---|---|

3. **Movement**: `healthScore` with its three components, and the newly indexed and lost pages from the report.
4. End with a short prioritized list of 3 to 5 concrete recommendations, then a re-check plan:
   - which URLs to hand to `check_tracked_url_now` next and how much quota that needs;
   - when to come back: new pages usually take days to a few weeks, and the tracker re-inspects each URL on its own schedule, so a status read with `list_tracked_urls` tomorrow costs no quota;
   - which URLs to retire with `remove_tracked_urls` once they are indexed and stable, to free capacity for the next batch.
   Keep prose for interpretation, not for restating numbers. Do not fabricate rows the tools did not return.

## Error handling

If any tool call fails with an authentication or subscription error, tell the user to run `/mcp` to (re)authenticate, and that a GSC Wizard account with an active plan or trial plus a connected Google Search Console account is required. If the property is not found, re-run `list_sites` and offer the closest matches instead of guessing a URL format. If a single tool fails for another reason, report the gap in the relevant section and complete the rest of the workflow with the remaining data.

## Grounding

Every number you report must name the tool it came from and the date range it covers, for example "clicks 12,340 (`get_site_summary`, 2026-09-21 to 2026-09-27)". For a table, state the tool and date range once on the line above it. If you derive a figure yourself (a delta, a sum, a share), say so and name the tool outputs it was computed from. Never report a number no tool returned.
