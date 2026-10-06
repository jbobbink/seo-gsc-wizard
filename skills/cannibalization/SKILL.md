---
name: cannibalization
description: Detect and resolve keyword cannibalization in Google Search Console data via the GSC Wizard MCP server. Finds queries where multiple pages of one property compete for the same search, compares the contenders on clicks, impressions, CTR, and position, picks a canonical winner per cluster, and recommends fixes (consolidate, canonicalize, differentiate intent, adjust internal anchors). Use when the user mentions cannibalization, keyword cannibalization, pages competing for the same keyword, multiple URLs ranking for one query, or asks which page should rank for a keyword.
---

# Keyword Cannibalization Analysis

Find queries where several pages of one property compete against each other, decide which page should win each cluster, and recommend concrete fixes. All data comes from the GSC Wizard MCP tools.

Optional user input: `$ARGUMENTS` may contain a property (site URL or domain), a date range, or a focus hint such as a specific query or URL path. Honor it when present.

## Workflow

1. **Resolve the property.**
   - If `$ARGUMENTS` or the conversation names a property, use it. Site URLs use GSC formats: `sc-domain:example.com` or `https://www.example.com/`.
   - Otherwise call `list_sites` and pick the obvious match. If several plausible properties exist, ask the user which one before continuing.

2. **Set the date range.**
   - Default: last 28 days (the tools default to this when you omit dates). Use the user's range if they gave one.
   - GSC data lags about 2 to 3 days; never treat the most recent 2 days as complete. If a dip is visible at the edge of the range, say it is likely reporting lag, not a real drop.

3. **Find cannibalized clusters.** Call `analyze_cannibalization` with the `siteUrl` (plus `startDate`/`endDate` if the user specified a range). Defaults are fine to start: `minImpressions: 10`, `limit: 100`. Raise `minImpressions` (for example to 100) on large properties to cut noise; if the user gave a focus query or path, filter the returned clusters to it.
   - Each result is a query with 2 or more competing pages, scored by impression entropy: higher entropy means impressions are split more evenly across pages, which is worse cannibalization. Each contender already carries clicks, impressions, ctr, and position.
   - Present the top clusters (typically 5 to 10) as a compact markdown table: query, number of pages, total clicks, total impressions, entropy. If nothing clears the threshold, say the property shows no meaningful cannibalization in this range and stop.

4. **Inspect the top clusters in depth.** For each of the top 3 to 5 clusters (or the ones the user cares about), call `query_search_analytics` with:
   - `dimensions: ["query", "page"]` and `filters: [{ dimension: "query", operator: "equals", expression: "<the query>" }]`
   - Optionally a second call with `dimensions: ["date", "page"]` and the same query filter when you need to see whether Google is flip-flopping between URLs over time (alternating pages day to day is a strong cannibalization signal; one page consistently ahead is a weaker one).
   - Show each cluster as a markdown table of contenders: page URL, clicks, impressions, ctr, position. The `ctr` values are already percentages on a 0-100 scale; never multiply them by 100. For position, lower is better.

5. **Decide a canonical winner per cluster.** Weigh, in order: most clicks; better (lower) average position; higher ctr; and best intent match between the query and the page content (judge from the URL and what you know of the pages). Name the winner explicitly and say why. If two pages genuinely serve different intents (for example a product page and a guide), say so; that cluster may not need consolidation at all.

6. **Recommend a fix per cluster.** Choose the most fitting action:
   - **Consolidate or merge**: the losing pages substantially duplicate the winner. Merge their unique content into the winner and 301-redirect the losers.
   - **Canonicalize**: near-duplicate variants (parameters, print views, thin siblings) should point `rel=canonical` at the winner.
   - **Differentiate intent targeting**: the pages serve genuinely different intents but their titles, headings, or copy overlap on the same phrasing. Rewrite the loser to target its own distinct query and de-optimize it for the contested one.
   - **Adjust internal anchors**: internal links use the contested keyword as anchor text pointing at the losing page. Repoint those anchors (and the exact-match anchor text) at the winner so internal signals agree on one URL.

## Output format

- Compact markdown tables for the cluster overview and each per-cluster contender breakdown; keep prose for interpretation.
- For each analyzed cluster, one short verdict line: winner, why, and the recommended action.
- End with a short prioritized list of concrete recommendations across all clusters, ordered by total impressions at stake (biggest clusters first), each naming the query, the winning URL, and the action.

## Rules and error handling

- Never invent data; report only what the tools return.
- `ctr` is already 0-100; display as a percentage without multiplying.
- Position: lower is better; a move toward a lower number is an improvement.
- Note the `dataSource` only if relevant: results may come from the GSC Wizard warehouse (longer history, unsampled) or the live GSC API.
- If a tool call fails with an authentication or subscription error, tell the user to run `/mcp` to (re)authenticate, and that a GSC Wizard account with an active plan or trial plus a connected Google Search Console account is required.
- If `analyze_cannibalization` returns clusters that are just protocol/host/hash variants of the same URL, call that out as a canonicalization or migration hygiene issue rather than true content cannibalization.
- A branded or navigational query where the homepage plus one deep page both rank is usually sitelinks behavior, not cannibalization; skip it or mention it only in passing.
- If the contenders look like language or country variants (for example `/en/` and `/de/` paths), verify with `query_search_analytics` using `dimensions: ["country", "page"]` and the same query filter; pages each winning their own market is an hreflang or geo-targeting matter, not cannibalization.

## Grounding

Every number you report must name the tool it came from and the date range it covers, for example "clicks 12,340 (`get_site_summary`, 2026-09-21 to 2026-09-27)". For a table, state the tool and date range once on the line above it. If you derive a figure yourself (a delta, a sum, a share), say so and name the tool outputs it was computed from. Never report a number no tool returned.
