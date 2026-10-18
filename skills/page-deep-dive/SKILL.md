---
name: page-deep-dive
description: Build a picture of one URL in a Search Console property with the GSC Wizard MCP tools: its daily click, impression, CTR and position series, the queries it wins and loses, its country and device split, stored and live URL inspection results (quota-aware), a single-page on-page audit, Core Web Vitals, and GA4 sessions, bounce rate and key events when GA4 is linked, ending in a page scorecard with recommendations. Use when the user asks "how is this page doing", "deep dive on this URL", "why did this page drop", "what does this page rank for", or names a single URL and wants everything about it.
---

# Page Deep Dive

Explain everything the connected tools know about one URL and condense it into a page scorecard (search, indexing, on-page, speed, engagement), the queries it wins and loses, and recommendations. `$ARGUMENTS` may contain a property, the page URL or path, a date range, and a focus hint such as a country or "mobile only"; honor all of them.

## Workflow

1. **Resolve the property, the URL and the window.** If `$ARGUMENTS` or the conversation names a property, use it. Site URLs use GSC formats: `sc-domain:example.com` or `https://www.example.com/`. Otherwise call `list_sites` and pick the obvious match. If several plausible properties exist, ask the user which one before continuing.
   - The page must be a full URL. When the user gives only a path, build the URL from the property's host, and for a `sc-domain:` property confirm host and protocol against the rows of `query_top_pages` rather than guessing between www and the bare host.
   - Use the last 28 days compared with the previous period unless the user specifies dates. The daily tools take no comparison parameter, so compare the first and second half of the window yourself and say the delta is derived.
   - GSC data lags about 2 to 3 days: never treat the most recent 2 days as complete, and if a dip appears at the very edge of the range, say it is likely reporting lag, not a real drop.

2. **Daily series.** Call `get_page_performance` with `siteUrl`, `pageUrl` and the optional `startDate`/`endDate`. `daily` holds one row per day, oldest first, with clicks, impressions, `ctr` and position.
   - `ctr` values are already percentages on a 0-100 scale. Never multiply them by 100. `position`: lower is better, and a change toward a lower number is an improvement; never color it as a decline.
   - Describe the shape of the trend: flat, a step change on a named date, a gradual slide, a spike, or a weekly rhythm. Impressions rising while clicks stay flat point at the snippet or the position; impressions falling with position steady point at demand or indexing.
   - The `pageUrl` filter is an exact match on the full URL. When `daily` is empty the response carries `emptyBecause` and a `nextStep` that calls `query_search_analytics` with a page `contains` filter to list the URL variants Search Console records (trailing slash, protocol, host); rerun with the variant that carries the traffic and tell the user which one it was.

3. **Queries the page wins and loses.** Call `query_search_analytics` with `dimensions: ["query"]`, `filters: [{ "dimension": "page", "operator": "equals", "expression": "<page URL>" }]` and `rowLimit: 100`; follow `pagination.nextOffset` as `startRow` only when the user wants the long tail. Rows carry `keys` (the query), clicks, impressions, `ctr` on the 0-100 scale and position.
   - Sort the rows into winners (page 1 with clicks), near misses (position 11 to 20 with real impressions) and snippet losers (page 1 with far fewer clicks than the impressions suggest).
   - Query rows cover only the queries Google lists: quote the page total from `coverage.filteredTotals`, mention `coverage.hiddenClicksShare` (0-1) when it is large, and never sum the rows into a total.

4. **Markets and devices.** Repeat the same filtered call with `dimensions: ["country"]` and then `dimensions: ["device"]`; country codes come back as lowercase ISO 3166-1 alpha-3 (`usa`) and device values as uppercase (`MOBILE`), and an `equals` filter on either must use that exact case, since the match is case-sensitive on both data paths.
   - Compare the page's split with the property's by calling `query_countries` and `query_devices` over the same dates; both return rows with clicks, impressions, `ctr` and position.
   - A page that is far more mobile, or far more concentrated in one country, than the property as a whole points at a device- or market-specific cause, which step 8 can test with a `PHONE` reading.

5. **Stored inspection history, no quota spent.** Call `list_url_inspections` with `siteUrl`, `urlContains` set to the page path and `latestPerUrl: true`.
   - The `inspections` rows run newest first and carry `verdict`, `coverage_state`, `indexing_state`, `last_crawl_time`, `google_canonical`, `user_canonical` and `inspection_result_link`.
   - All three canonical fields are null on rows stored before canonicals were kept, so an old row is not evidence of a missing canonical, and a verdict that flipped between two stored rows is a finding on its own.

6. **Live inspection, quota first.** Call `get_inspection_quota` with `siteUrl` and read `count`, `limit` and `remaining` (Google allows 2,000 inspections per property per day; when the response carries `unavailable: true` the counter could not be read and those numbers are placeholders, so treat the quota as unknown and inspect once at most). Skip the live call when `remaining` is under a tenth of `limit`, or when a stored result from the last 7 days exists and the series shows no indexing symptom, and say which rule applied. Otherwise call `inspect_url` once with `siteUrl` and `inspectionUrl`.
   - Read `verdict`, `coverageState`, `indexingState`, `robotsTxtState`, `pageFetchState`, `crawledAs`, `lastCrawlTime`, `googleCanonical`, `userCanonical` and `inspectionResultLink`.
   - When `googleCanonical` differs from `userCanonical` and both are set, Google credits this page's search data to another URL, which often explains a thin series in step 2. A null canonical means Google did not report one (common for pages it has not indexed) and must never be filled in from the page.
   - A response with `quotaExhausted: true` means the day's quota is gone: rely on step 5, follow the `nextStep` it names, and say the quota resets tomorrow.

7. **On-page audit of this one URL.** Call `audit_onpage_seo` with `siteUrl` and `urls: ["<page URL>"]`; the URL must belong to the property, and although the tool accepts up to 25 URLs this workflow audits one.
   - Read the single entry in `pages`: `statusCode`, `redirected`, `indexable`, `indexabilityStatus`, `noindex`, `title`, `titleLength`, `metaDescriptionLength`, `h1Count`, `wordCount`, `canonicalUrl`, `canonicalIsSelf`, `internalLinks`, `externalLinks`, `imagesMissingAlt`, `structuredDataTypes`, `schemaIssues` and `issues` (each with `id`, `severity` and `message`).
   - Cross-check `canonicalUrl` against `userCanonical` from step 6. The tool returns the meta description's length, not its text.
   - If `truncated` is true and the URL sits in `notAudited`, call again with that list; a `robotsNote` means robots.txt disallows the audit crawler, so report that instead of on-page findings.

8. **Core Web Vitals.** Call `get_core_web_vitals` with `siteUrl` and `url` set to the page. The schema takes an optional `url`; without it the tool measures the whole origin, so always say which level the numbers describe. Start with `formFactor: "ALL"` and add a `PHONE` call when step 4 showed the page is mobile-heavy.
   - Read `metrics` (LCP, INP and CLS with FCP and TTFB, each rated), `regressions` (a Core Web Vital whose rating band worsened between its two latest weeks) and `latestPeriod`.
   - A `notConfigured` response with a `hint` means the Chrome UX Report connection is not set up in the app: say so and skip speed.
   - A `noData` response means the Chrome UX Report holds no record for this page: follow its `nextStep` (the origin without `url`) and label that result as origin-level.

9. **GA4 engagement, when linked.** Call `get_blended_landing_pages` with `siteUrl`, the same dates, `comparisonStartDate`/`comparisonEndDate` for the previous period, `organicOnly: true` and `limit: 500`, then find the row whose `key` equals the page's path (rows are keyed by normalized path, not full URL).
   - Read `sessions`, `activeUsers`, `bounceRate` (a 0-1 fraction straight from GA4, so 0.62 is 62%), `keyEvents`, `revenue` when present, `ga4Matched` and the `prev*` fields for the comparison. The tool's `settledThrough` marks the Search Console side's settled boundary; keep both sides inside it.
   - Clicks far above sessions suggest a tracking gap or a redirect; sessions far above clicks mean the page draws traffic that is not Google organic.
   - A `notConfigured` answer carries a `reason`: `no_scope` means Google Analytics is not connected on the GSC Wizard account named in `account` (with `reauthRequired: true` the Google account must be reconnected instead), and `no_property` means GA4 is connected but no GA4 property is linked to this site. Relay the `hint` and mark the engagement row "not linked".
   - If the page is not among the rows, say the tool lists the property's top landing pages by clicks and this page was not among them.

## Output

Present the results in this order, with compact markdown tables for multi-row data and prose only for interpretation:

1. **Page scorecard**, one table with the tool and date range stated on the line above it:

   | Area | Verdict | Evidence |
   |---|---|---|
   | Search | ... | clicks, impressions, CTR, position, trend shape (step 2) |
   | Indexing | ... | verdict, coverage, canonical pair (steps 5 and 6) |
   | On-page | ... | status, indexability, title and meta lengths, top issues (step 7) |
   | Speed | ... | LCP, INP, CLS ratings and regressions (step 8), or "not configured" |
   | Engagement | ... | sessions, bounce rate, key events (step 9), or "not linked" |

2. **Queries won and lost**: a table (Query, Clicks, Impressions, CTR, Position, Verdict) with 5 to 10 rows, split into wins and losses.
3. **Markets and devices**: a short table of the page's split next to the property's.
4. **Recommendations**: end with a short prioritized list of 3 to 7 concrete recommendations, each naming its evidence (rewrite the title because CTR at position 4 is low on the two top queries; fix the canonical because Google selected another URL; address LCP on phones).

Present every multi-row result as a compact markdown table (top rows only, typically 5 to 10); keep prose for interpretation, not for restating numbers. Judge by the clicks and impressions at stake, not by percentage alone, and do not fabricate rows the tools did not return. When the page's queries are also won by other pages, point the user to the cannibalization skill; when the page is one of many decaying pages, to content-decay; for a property-wide view, to site-audit.

## Error handling

If any tool call fails with an authentication or subscription error, tell the user to run `/mcp` to (re)authenticate, and that a GSC Wizard account with an active plan or trial plus a connected Google Search Console account is required. If the property is not found, re-run `list_sites` and offer the closest matches instead of guessing a URL format. If a single tool fails for another reason, report the gap in the relevant section and complete the rest of the workflow with the remaining data.

## Grounding

Every number you report must name the tool it came from and the date range it covers, for example "clicks 12,340 (`get_site_summary`, 2026-09-21 to 2026-09-27)". For a table, state the tool and date range once on the line above it. If you derive a figure yourself (a delta, a sum, a share), say so and name the tool outputs it was computed from. Never report a number no tool returned.
