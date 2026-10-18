---
name: yandex-performance
description: Report Yandex Webmaster performance for a Search Console property with the GSC Wizard MCP server's Yandex tools: verification status and canonical mirror, site quality index (SQI), pages in search and excluded pages, open site problems by severity, the top Yandex queries with derived CTR and both position metrics, and the crawl and indexing trend with the pages that appeared in or were removed from Yandex search, with the Google totals alongside for scale, ending with recommendations. Use when the user asks "how is my site doing on Yandex", "Yandex traffic", "SQI", "top Yandex queries", "Yandex indexing", "pages in Yandex search", "Yandex problems", or about Yandex Webmaster.
---

# Yandex Performance

Report how a property stands in Yandex search (which matters mainly for Russian, Turkish, Kazakh, Belarusian and Uzbek traffic) and end with recommendations. The user's request may contain a property name or URL, a date range, a device (desktop, mobile or tablet) or a focus hint ("indexing", "queries", "problems"); honor it by going deeper on that part while still producing the full report.

## Workflow

1. **Resolve the property.** If the user's request or the conversation names a property, use it. Site URLs use GSC formats: `sc-domain:example.com` or `https://www.example.com/`. Otherwise call `list_sites` and pick the obvious match. If several plausible properties exist, ask the user which one before continuing. The Yandex tools take that same GSC `siteUrl`. Yandex Webmaster tracks whole hosts, so a URL-prefix property with a path (such as `https://example.com/blog/`) is matched to its host and every figure covers the whole host; the response then says so in `limitations`.

2. **Confirm the Yandex side.** Call `list_yandex_sites` (no arguments; the host list is cached for ten minutes, so a site verified a moment ago can take that long to show). `sites[]` rows carry `hostId`, `url`, `unicodeUrl`, `verified` and `mainMirrorUrl`, and an `emptyBecause` answer means the connected account holds no sites yet. Only a site added and verified in Yandex Webmaster itself reports data, so a host with `verified: false` needs the owner to verify it there, which can take a few days. When `mainMirrorUrl` differs from `url`, Yandex keeps the data on the main mirror; name it.

3. **Read every `notConfigured` answer.** Each Yandex tool answers `notConfigured: true` with a `reason` and a `hint` instead of an error. Tell the user what each reason means and what to do:
   - `not_connected`: no Yandex account is connected to the property owner's GSC Wizard account; connect Yandex in the app.
   - `reauth`: the owner must reconnect Yandex in the app, because Yandex rejected the connection or the grant predates the `webmaster:verify` scope.
   - `host_not_found`: the host is not in the connected Yandex Webmaster account; add and verify it there.
   - `host_not_verified`: the site is in the account but Yandex has not verified it; verify it in Yandex Webmaster and expect no data until then.
   - `owner_only`: the property is shared, and Yandex reads use the owner's connection, which is not shared; only the owner can run this report.
   A Yandex 429 comes back as a `rate_limited` error whose message gives the retry delay in seconds, taken from Yandex's own reset time: wait that long before one retry and never loop. When Yandex refuses only a secondary section (the problem list, pages in search, the appeared/removed series), the tool keeps what it read and returns that section as `null` with an entry in `warnings` when the host is not verified, or empty with a warning after a rate limit or timeout; report the rest and call that section unknown, never clean or zero. Whatever the reason, still run the Google anchor in step 7.

4. **Site status.** Call `get_yandex_site_summary` with `siteUrl`. Read `sqi`, `pagesInSearch`, `excludedPages`, `problemCountsBySeverity` and `problems[]` (each with `code`, `severity` and `lastChangedAt`, listed most severe first: FATAL, CRITICAL, POSSIBLE_PROBLEM, RECOMMENDATION). SQI is Yandex's own composite with no Google equivalent, the severities are Yandex's taxonomy, and Yandex serves no previous period, so report a single window and never compare SQI with a Google metric. An empty `problems` beside a `warnings` entry is an unread list, not a clean one; `emptyBecause` and `nextStep` say which case applies. Derive the excluded share as `excludedPages` over `excludedPages` plus `pagesInSearch`, and say it is derived.

5. **Top queries.** Call `get_yandex_query_stats` with `siteUrl` and these arguments:
   - `startDate` and `endDate`: the last 28 days unless the user set a range. Omitting both gives only the last week, and a longer window returns more rows. Yandex finishes a day about four days late, so `range` echoes the window it actually served; state those dates.
   - `orderBy`: `"TOTAL_CLICKS"` for the traffic view; a second call with `"TOTAL_SHOWS"` (the default) surfaces high-impression, low-click queries, the snippet opportunities.
   - `deviceType`: `"ALL"` by default, or `"DESKTOP"`, `"MOBILE"`, `"TABLET"` or `"MOBILE_AND_TABLET"` when the user asks for a device; the last overlaps the other two, so never sum device calls.
   - `limit`: keep the default of 500 (max 3,000) unless the long tail matters; each extra 500 rows is another round trip to Yandex.
   `queries[]` rows carry `query`, `impressions`, `clicks`, `ctr` (0-100, calculated from clicks and impressions because Yandex publishes no CTR, and null without impressions), `avgImpressionPosition` and `avgClickPosition`; `totalAvailable` and `truncated` say how much of the pool was left. Yandex exposes at most its top 3,000 queries, so every total you derive is a floor and every share is of the listed queries, not of the site. There is no query-by-page report, so never attribute a Yandex query to a URL.

6. **Indexing trend.** Call `get_yandex_indexing_history` with `siteUrl` and optional `startDate` and `endDate` (omit them for the window Yandex serves by default). `crawlResponses[]` holds one series per HTTP `status` with dated `points`; `pagesInSearch` is a dated series; `searchAppearanceChanges[]` holds one series per `event` for the pages that appeared in or were removed from search, which has no Google equivalent. Read the direction of pages in search, any rise in non-2xx crawl responses, and days with a removal spike, and set them against `excludedPages` from step 4. A `null` series with a warning is unknown, not zero.

7. **Google anchor.** Call `get_site_summary` with `siteUrl` and the same `startDate` and `endDate` for Google clicks and impressions over the window, so the user sees the scale of the Yandex numbers. Derive Yandex's share of combined clicks from the two totals, say it is derived and a floor (the step 5 rows are capped), and never average a Yandex position with a Google one: Yandex measures position differently and splits it into the position when shown and the position when clicked.

## Interpretation rules

- `ctr` values are already percentages on a 0-100 scale. Never multiply them by 100.
- `position`: lower is better. A change toward a lower number is an improvement; never color it as a decline. Yandex reports two positions, `avgImpressionPosition` and `avgClickPosition`, measured differently from Google's, so never average either with a Google position.
- Every total from `get_yandex_query_stats` rows is a floor and every share is of the listed queries; the site-level counts from `get_yandex_site_summary` are not capped that way.
- Yandex serves no previous period, so report one window and never invent a comparison; the Google anchor is for scale, not for a delta.
- Judge every finding by the clicks and impressions at stake, not by percentage alone.
- Present every multi-row result as a compact markdown table (top rows only, typically 5 to 10); keep prose for interpretation, not for restating numbers.
- Pass on the `limitations` entries each response carries wherever a number could be misread as complete or comparable, and do not fabricate rows the tools did not return; if a tool returns nothing, say so and relay its `emptyBecause` and `nextStep`.

## Output

Present the report in this order, with compact markdown tables (top rows only, typically 5 to 10) for multi-row data and prose only for interpretation:

1. **Status line**: verification and mirror from step 2, then `sqi`, `pagesInSearch`, `excludedPages` and the derived excluded share, with the Google totals alongside.
2. **Problems**, or the reason the list is unknown:

| Severity | Code | Last changed | What to do |
|---|---|---|---|

3. **Top Yandex queries**:

| Query | Impressions | Clicks | CTR | Position shown | Position clicked |
|---|---|---|---|---|---|

   Add a second short table for the high-impression, low-`ctr` queries when step 5 ran twice. A query whose `avgClickPosition` is far better than its `avgImpressionPosition` only earns clicks when it ranks high, which makes it a ranking target rather than a snippet target.
4. **Indexing trend**: a few sentences, the first and last `pagesInSearch` points, the crawl statuses that grew, and the largest appeared and removed days.
5. End with a short prioritized list of 3 to 7 concrete recommendations, for example:
   - fix the FATAL and CRITICAL problems first, naming each `code`;
   - investigate the largest removal day or the crawl status that grew, against `excludedPages`;
   - rewrite snippets for the high-impression, low-`ctr` queries and strengthen the pages behind the ranking targets;
   - verify the host or reconnect Yandex when step 2 or 3 found a gap.

For the Google side of the same property run the site-audit skill; for Bing run the bing-performance skill.

## Error handling

If any tool call fails with an authentication or subscription error, tell the user to run `/mcp` to (re)authenticate, and that a GSC Wizard account with an active plan or trial plus a connected Google Search Console account is required. If the property is not found, re-run `list_sites` and offer the closest matches instead of guessing a URL format. If a single tool fails for another reason, report the gap in the relevant section and complete the rest of the workflow with the remaining data.

## Grounding

Every number you report must name the tool it came from and the date range it covers, for example "clicks 12,340 (`get_site_summary`, 2026-09-21 to 2026-09-27)". For a table, state the tool and date range once on the line above it. If you derive a figure yourself (a delta, a sum, a share), say so and name the tool outputs it was computed from. Never report a number no tool returned.
