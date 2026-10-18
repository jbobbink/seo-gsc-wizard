---
name: long-tail-analysis
description: Measure how much of a Search Console property lives in the long tail and how much of its traffic is invisible in query and page rows, using the GSC Wizard MCP tools: Head / Chunky Middle / Long Tail page tiers from get_longtail_clusters, the anonymised versus truncated share from analyze_sampling_impact, the ranking-band mix from get_position_distribution, and a raw query pull to characterise tail queries by length and intent. Use when the user asks "how long-tail is my site", "how much of my traffic is hidden or anonymised", "what is in my long tail", "which tail topics deserve a page", or about the head versus tail split.
---

# Long-tail Analysis

Quantify the head-versus-tail shape of one property, measure the share of its traffic that no query or page row carries, and turn the named tail into themes worth a page. `$ARGUMENTS` may contain a property (a GSC site URL or a recognizable name), a date range, a `preset` hint (for example "ecommerce" or "small site"), or a focus such as a topic or a URL path to concentrate the theme step on.

## Workflow

1. **Resolve the property.** If `$ARGUMENTS` or the conversation names a property, use it. Site URLs use GSC formats: `sc-domain:example.com` or `https://www.example.com/`. Otherwise call `list_sites` and pick the obvious match. If several plausible properties exist, ask the user which one before continuing.

2. **Fix one window.** Use the last 28 days compared with the previous period unless the user specifies dates. Every tool below defaults to the last 28 settled days when `startDate` and `endDate` are omitted, so either omit both everywhere or pass the same explicit pair everywhere; mixing the two misaligns the shares. Each response echoes the window it covered (`range`, or `startDate`/`endDate` on `query_search_analytics`), which is the range to cite.
   - GSC data lags about 2 to 3 days: never treat the most recent 2 days as complete, and if a dip appears at the very edge of the range, say it is likely reporting lag, not a real drop.

3. **Page tiers.** Call `get_longtail_clusters` with `siteUrl`, `preset` (`default`, `content`, `ecommerce`, `small_site` or `enterprise`; pick from the user's hint, else `default`) and `pagesPerCluster: 10`. The tiers are pages, not queries: the tool runs elbow detection on the cumulative-clicks curve and returns `clusters` head to tail.
   - Read per tier: `label`, `urlCount`, `urlPercentage`, `totalClicks`, `clickPercentage`, `totalImpressions`, `impressionPercentage`, `avgCtr` (already 0-100), `avgPosition`, `avgQueryDiversity` (distinct named queries per page), `zeroClickCount` and `topPages`. `knees` are the two cut points by rank, and `totals` holds the page universe (`urls`, `clicks`, `impressions`).
   - A Head tier holding most clicks on a few percent of URLs is concentration risk: a handful of pages carry the property. A Long Tail tier with a large `urlPercentage`, a small `clickPercentage` and a high `zeroClickCount` is index bloat. A Chunky Middle with `urlRange: null` means the curve had no middle (a few dominant pages over a flat rest).
   - If `truncated` is true, quote `truncationNote` and say the Long Tail tier is understated. If the response carries `emptyBecause`, follow its `nextStep` (usually a second call with `includeZeroClicks: true`). `sensitivity` (`low`, `normal`, `high`) only moves the knees; re-run with another value only when the tiers look degenerate, and say so.

4. **The hidden share.** Call `analyze_sampling_impact` with `siteUrl` and the same dates. Read `totals` (the property's clicks and impressions for the window), then `querySampling` and `pageSampling`.
   - In each, `missingClicksPercent` (0-100) is the share of clicks the top rows do not carry, and the nested `gap` object says why. Inside it, `anonymisedShare` (0-1) is traffic that belongs to no row at all; on the query dimension that is Search Console withholding rare queries under its privacy threshold, so the user will never see those queries in any report, app or API. `truncatedShare` (0-1) is traffic in rows past the 25,000-row read cap (`rowCap`), recoverable by narrowing the window or paging, and 0 unless `capHit` is true. A `null` share means the live API returned a full page and could not split the two. `rowsTotal` is the number of distinct query (or page) rows when known.
   - Quote the tool's `note`, which is written from these fields, and tell the user plainly that the anonymised share is the invisible long tail: rare queries, long by definition, counted in the totals but in no query table, so the named tail in step 6 understates the real tail by exactly that share.
   - The page gap is normally much smaller. Page rows can add up to more impressions than the property total, so a `gap.hiddenImpressions` of 0 on the page side is normal and not a sign that nothing is hidden.

5. **Ranking bands.** Call `get_position_distribution` with `granularity: "period"` and `dimension: "query"`, then once more with `dimension: "page"`.
   - Each `buckets` row (best first: 1-3, 4-10, 11-20, 21+) carries `impressions`, `clicks`, `ctr` (0-100), `rows` (distinct queries or pages in the band), `impressionShare` and `clickShare` (0-100).
   - A tail-heavy property shows most of its distinct queries in 11-20 and 21+ with a small `clickShare` there; that is the pool the theme step mines. By query the counts cover only named queries, so pair this table with the hidden share from step 4.
   - On the live API path `truncated: true` means zero-click rows were dropped first and the deep bands are understated; raise `scanLimit` (default 50,000, max 200,000) once and say you did.

6. **Characterise the named tail.** Call `query_top_queries` with `limit: 1000` for the head. Then call `query_search_analytics` with `dimensions: ["query"]` and `rowLimit: 5000`; if `pagination` says there is more and the property is large, fetch one more page with `startRow` set to `pagination.nextOffset`, and stop there, since raw rows are expensive to carry. Rows come back as `keys[0]` (the query), `clicks`, `impressions`, `ctr` (0-100) and `position`.
   - Derive, and say you derived: the distribution of query word counts (1-2 words, 3 words, 4+ words) with the clicks and impressions each bucket carries; the share of rows carrying intent markers (how, what, why, best, vs, near me, price, cost, review, free, template, example, and their equivalents in the property's language); and the recurring theme tokens among the 4+ word queries.
   - Summed row figures are named-row figures only. `coverage.siteTotals` holds the property totals and `coverage.hiddenClicksShare` (0-1) the share they miss, so never present a theme sum as a share of the property without that caveat.

7. **Themes worth a page.** Group the tail rows into 5 to 10 themes (a shared head noun, product, problem or location). A theme is a page candidate when it has many distinct queries, a meaningful impression sum, an average position mostly in 11-30, and no single page already ranking for most of it.
   - Spot-check the top 2 or 3 queries of a theme with `query_search_analytics`, `dimensions: ["query", "page"]`, a `filters` entry `{ "dimension": "query", "operator": "contains", "expression": "<theme token>" }` and `rowLimit: 50`.
   - If one page already ranks for the theme, the play is a CTR or content refresh instead, which the quick-wins skill or the content-decay skill covers; do not redo them here. If several pages split a theme, point the user to the cannibalization skill.

## Interpretation rules

- `ctr` values are already percentages on a 0-100 scale. Never multiply them by 100. The `anonymisedShare` and `truncatedShare` fields and `coverage.hiddenClicksShare` are the exceptions: 0-1 fractions, so multiply those by 100 to present them.
- `position`: lower is better. A change toward a lower number is an improvement; never color it as a decline.
- Judge by clicks and impressions at stake, not by percentage alone: a theme with 40 impressions is not a page candidate however many queries it has.
- Present every multi-row result as a compact markdown table (top rows only, typically 5 to 10); keep prose for interpretation, not for restating numbers.
- Do not fabricate rows the tools did not return. If a tool returns nothing, say so and move on.

## Output

Present, in this order:

1. **Tier table** (`get_longtail_clusters`), then a one-word shape (Concentrated, Balanced or Bloated) and the top 3 pages of the Head and of the Long Tail:

   | Tier | Pages | % pages | Clicks | % clicks | Impressions | % impr. | Avg CTR | Avg pos. | Query diversity | Zero-click pages |
   |---|---|---|---|---|---|---|---|---|---|---|

2. **Hidden share** (`analyze_sampling_impact`): anonymised and truncated share of clicks and of impressions for queries and for pages, and what each means for the user in one or two sentences.
3. **Ranking bands** (`get_position_distribution`): one table by query and one by page with rows, impressions, clicks, CTR and shares.
4. **Tail profile** (derived from `query_search_analytics` and `query_top_queries`): the word-length table, the intent-marker share, and the theme table, all named-row figures:

   | Theme | Distinct queries | Clicks | Impressions | Avg pos. | Example queries | Page already ranking? |
   |---|---|---|---|---|---|---|

5. End with a short prioritized list of 3 to 7 concrete recommendations: which themes get a dedicated page (with the example queries to target), which zero-click tail pages to consolidate, prune or noindex, whether the hidden share is large enough that page-level reports should replace query-level ones for this property, and which deep-band themes to revisit after the first pages ship.

## Error handling

If any tool call fails with an authentication or subscription error, tell the user to run `/mcp` to (re)authenticate, and that a GSC Wizard account with an active plan or trial plus a connected Google Search Console account is required. If the property is not found, re-run `list_sites` and offer the closest matches instead of guessing a URL format. If a single tool fails for another reason, report the gap in the relevant section and complete the rest of the workflow with the remaining data.

## Grounding

Every number you report must name the tool it came from and the date range it covers, for example "clicks 12,340 (`get_site_summary`, 2026-09-21 to 2026-09-27)". For a table, state the tool and date range once on the line above it. If you derive a figure yourself (a delta, a sum, a share), say so and name the tool outputs it was computed from. Never report a number no tool returned.
