---
name: ctr-optimization
description: Find the query and page pairs whose click-through rate underperforms for the position they hold, and turn them into title and meta description rewrite briefs, using the GSC Wizard MCP CTR-curve benchmark comparison, top queries and pages, a query-by-page pull, the striking-distance click upside and an on-page audit of the current titles. Distinct from quick-wins, which merges every opportunity signal: this skill asks only where CTR is low at a stable position and what the title should say. Use when the user asks about CTR optimization, low CTR, "my CTR is bad", title tag rewrites, meta description improvements, snippet optimization, or which titles to rewrite first.
---

# CTR Optimization

Find where the property's click-through rate falls short of what its positions should earn, and produce a candidates table plus a rewrite brief per page. The user's request may contain a property, a date range, a site section or path, a country, and a focus hint such as "product pages only"; honor all of them. When the user wants one merged list of every kind of opportunity, run the quick-wins skill instead.

## Workflow

1. **Resolve the property and the window.** If the user's request or the conversation names a property, use it. Site URLs use GSC formats: `sc-domain:example.com` or `https://www.example.com/`. Otherwise call `list_sites` and pick the obvious match. If several plausible properties exist, ask the user which one before continuing.
   - Use the last 28 days unless the user specifies dates; a shorter window makes the per-position CTR too noisy to judge.
   - When the user's request names a section, a path or a country, carry it into the step 4 filters rather than judging the whole property.
   - GSC data lags about 2 to 3 days: never treat the most recent 2 days as complete, and if a dip appears at the very edge of the range, say it is likely reporting lag, not a real drop.

2. **CTR curve against benchmarks.** Call `analyze_ctr_curve` with `siteUrl`, the dates, `minImpressions: 10` and `benchmarkSource: "all"` (or one of `awr`, `awr2026`, `awrAio`, `firstPageSage`, `sistrix`, `backlinko`, which adds the flat `expectedCtr` and `ctrDelta` fields). `buckets` always holds positions 1 to 20 in order, each with clicks, impressions, `queryCount`, `ctr`, `benchmarks` (expected CTR per source) and `deltas` (actual minus expected).
   - `ctr` values are already percentages on a 0-100 scale, never multiply them by 100, and the deltas are percentage points: a negative delta means the bucket underperforms that benchmark.
   - Keep the buckets whose delta is negative against most sources and whose impressions are large; a bucket with `queryCount` 0 has no data, and `emptyBecause` means every bucket is empty, so its zeros are placeholders, not underperformance.
   - The gap between `awr2026` and `awrAio` is the AI Overview click tax: a property that trails `awr2026` but matches `awrAio` is probably losing clicks to AI Overviews rather than to weak titles, which a rewrite cannot fix.
   - `truncated: true` means the live API read was cut at `scanLimit` queries and zero-click queries were dropped first, so the bucket CTRs read high, not low.

3. **Volume context.** Call `query_top_queries` and `query_top_pages` with the same dates and `limit: 200`. Rows carry clicks, impressions, `ctr` (0-100) and position, sorted by clicks.
   - Use them to see which pages and queries hold the impressions in the underperforming buckets, and to quote property totals from `coverage.siteTotals`.
   - Note `coverage.hiddenClicksShare` (0-1), the share of clicks with no query row that no pair below can explain.

4. **Query and page pairs.** Call `query_search_analytics` with `dimensions: ["query", "page"]`, the dates and `rowLimit: 1000`; rows run by clicks, highest first, so page with `startRow` set to `pagination.nextOffset` when the first page has not yet reached the impression floor you chose. Add a page `contains` filter when the user's request names a section and a country `equals` filter (lowercase ISO 3166-1 alpha-3, for example `usa`; the match is case-sensitive) when it names a market. Each row carries `keys` (query, then page), clicks, impressions, `ctr` and position.
   - Keep rows whose rounded position falls in an underperforming bucket from step 2, whose impressions clear a floor that fits the property (100 over 28 days is a sensible start), and whose `ctr` sits below that bucket's benchmark or below the property's own bucket `ctr`.
   - For each kept pair compute the click gap as impressions times (benchmark CTR minus the pair's CTR) divided by 100, and label it as derived from `analyze_ctr_curve` and `query_search_analytics`. It is the ceiling of what a better snippet could recover, never a forecast.
   - Set aside brand and navigational queries, whose CTR follows the brand rather than the snippet, and say that you did.

5. **Click upside and the source of the target CTR.** Call `find_page_poaching_opportunities` with `siteUrl`, the dates, and the defaults `minPosition: 4`, `maxPosition: 20`, `targetPosition: 3`, `minImpressions: 10` and `fallbackBenchmark: "awr"`.
   - `opportunities` run by `potentialClicks`, each with `query`, clicks, impressions, `ctr` (0-100), position and `potentialClicks`; the response also reports `targetCtr`, `ctrSource` and `ctrSourceNote`.
   - Read `ctrSource` first: `own` means `targetCtr` is the property's measured CTR at the target position, while a benchmark key means the site had under 100 impressions there and the figure is an industry estimate, which you must say when quoting it.
   - Rows are per query with no page, so join them to step 4 on the query text; a pair that appears in both lists is worth a rewrite now and a ranking push later. `truncated` and `scanNote` disclose the 25,000-query scan cap.

6. **Stability check per shortlisted pair.** Shortlist 5 to 10 pairs by click gap, then call `get_query_performance` for each with `siteUrl`, `query`, `pageUrl` and the dates; `daily` runs oldest first with clicks, impressions, `ctr` and position.
   - A position that stayed within about one place all window confirms a stable CTR problem.
   - Report each pair at the position it held, since the benchmark comparison only means something at that position.
   - A position that stepped (two weeks at 2, two weeks at 9) means the average CTR mixes two regimes and the pair is a ranking story that belongs in quick-wins, not here. Drop or demote unstable pairs and say why.

7. **Current titles and descriptions.** Call `audit_onpage_seo` with `siteUrl` and `urls` set to the shortlisted pages (keep it to 5 to 10, never more than the tool's 25; it fetches each page live and costs more rate budget than a read).
   - For each entry in `pages` read `title`, `titleLength`, `metaDescriptionLength`, `h1Count` and the `issues` whose `id` is `missing-title`, `title-long`, `title-short`, `missing-meta`, `meta-long` or `meta-short` (each issue carries `severity` and `message`).
   - The tool returns the meta description's length, not its text, so ask the user for the text when the brief needs it.
   - If `truncated` is true, call again with `urls` set to `notAudited`; a `robotsNote` means robots.txt blocks the audit crawler, and the brief then rests on the title the user supplies.

## Output

Present the results in this order, with compact markdown tables for multi-row data and prose only for interpretation:

1. **Curve summary**: two or three sentences on which position buckets underperform and against which benchmarks, with the AI Overview reading from step 2.
2. **Candidates table** (`analyze_ctr_curve` and `query_search_analytics`, dates stated above it), 5 to 10 rows:

   | Query | Page | Impressions | Position | CTR | Benchmark CTR | Gap (pp) | Click gap (derived) | Stable |
   |---|---|---|---|---|---|---|---|---|

3. **Rewrite brief per page**, for each page in the table:
   - What the current title says: `title` and `titleLength` from step 7, the meta length, and any title or meta issue.
   - The queries it must match: every candidate query on that page from step 4, with impressions, and the intent those queries carry.
   - The suggested angle: lead with the primary query's wording, add the differentiator the competing results lack (a number, a year, a format such as "checklist" or "calculator", a price, a benefit), keep the brand at the end, and fit the length the audit's issue thresholds imply.
   - Two or three title options and one meta description direction, with the note that the new text must be tested, since no tool returns a CTR for a title that is not live yet.
4. **Recommendations**: end with a short prioritized list of 3 to 7 concrete recommendations ordered by click gap, each naming the page, the queries and the evidence, plus one line on how to verify: rerun `get_query_performance` on the same pairs after four weeks and compare CTR at the same position.

Present every multi-row result as a compact markdown table (top rows only, typically 5 to 10); keep prose for interpretation, not for restating numbers. Judge by the clicks and impressions at stake, not by percentage alone, and do not fabricate rows the tools did not return. Never promise a CTR figure for a rewrite. When a candidate query is served by several pages, point to the cannibalization skill; for everything about one page, to page-deep-dive.

## Error handling

If any tool call fails with an authentication or subscription error, tell the user to run `/mcp` to (re)authenticate, and that a GSC Wizard account with an active plan or trial plus a connected Google Search Console account is required. If the property is not found, re-run `list_sites` and offer the closest matches instead of guessing a URL format. If a single tool fails for another reason, report the gap in the relevant section and complete the rest of the workflow with the remaining data.

## Grounding

Every number you report must name the tool it came from and the date range it covers, for example "clicks 12,340 (`get_site_summary`, 2026-09-21 to 2026-09-27)". For a table, state the tool and date range once on the line above it. If you derive a figure yourself (a delta, a sum, a share), say so and name the tool outputs it was computed from. Never report a number no tool returned.
