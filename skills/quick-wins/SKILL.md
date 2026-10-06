---
name: quick-wins
description: Find and rank quick-win SEO opportunities for a Search Console property by combining opportunity scoring, position distribution, CTR-curve underperformance, and striking-distance click-upside estimates from the GSC Wizard MCP server, then merge everything into one prioritized action list with expected impact and effort. Use when the user asks for quick wins, low hanging fruit, easy SEO improvements, striking distance keywords, or which pages or queries to optimize first for the fastest gains.
---

# Quick Wins

Build a single prioritized list of quick-win SEO opportunities for one property. The user may pass a property or a focus hint in `$ARGUMENTS` (for example a site URL, a country, or "focus on product pages").

## Step 1: Resolve the property

1. If `$ARGUMENTS` or the conversation names a property, use it. Site URLs use GSC formats: `sc-domain:example.com` or `https://www.example.com/`.
2. Otherwise call `list_sites`. If exactly one plausible match exists, use it and say which one you picked. If several are plausible, ask the user which property to analyze before running anything else.
3. If any call fails with an authentication or subscription error, stop and tell the user to run `/mcp` to (re)authenticate, and that a GSC Wizard account with an active plan or trial plus a connected Google Search Console account is required.

## Step 2: Set the date range

Default to the last 28 days compared with the previous period, unless the user specifies otherwise. GSC data lags about 2 to 3 days: never treat the most recent 2 days as complete, and if a dip is visible at the very edge of the range, say explicitly that it is probably the reporting lag, not a real drop.

## Step 3: Gather the four signals

Run these for the resolved property and date range. They are independent, so call them together where possible.

1. `score_opportunities`: the core scored list. It ranks queries at positions 3-30 by an impression-weighted opportunity score favoring near-threshold positions with low CTR, and estimates the extra clicks available. Keep the top 15-25 rows.
2. `get_position_distribution` (granularity `period`): size the striking-distance set. Report how many queries and impressions sit in the 4-10 and 11-20 bands versus 1-3 and 21+. The 4-10 band plus the lower half of 11-20 approximates the classic striking-distance zone (roughly positions 4-15); say so rather than pretending the bands match exactly. This frames how big the total opportunity is.
3. `analyze_ctr_curve`: the property's actual CTR by position bucket (1-20) versus industry benchmarks. Negative deltas mean the bucket underperforms its expected CTR; deltas are in percentage points. Note which position buckets underperform most, then use them to flag scored queries sitting in those buckets as likely title/meta problems rather than pure ranking problems.
4. `find_page_poaching_opportunities`: queries ranking just outside the top spots (defaults: positions 4-20, target position 3) with the estimated click upside of pushing each to the target. Check `ctrSource` in the response: "own" means the upside was computed from the property's own CTR curve; a benchmark key means the property had no data at the target position and an industry benchmark was used instead, so label those estimates accordingly.

None of these four tools accept dimension filters. If the user gave a focus hint, apply it after merging in Step 4: for a page or section focus, filter using the page mapping; for a country or device focus, say that these signals aggregate all countries and devices, and cross-check the top items with a `query_search_analytics` call using a matching country or device filter before recommending them.

## Step 4: Merge, deduplicate, rank

1. Build one combined list keyed by query; all four tools return query-level rows, none returns a page. A query that appears in both `score_opportunities` and `find_page_poaching_opportunities`, or that sits in a bucket flagged by `analyze_ctr_curve`, appears ONCE, with all its signals listed.
2. Attach pages: run one `query_search_analytics` call with dimensions `["query", "page"]` over the same range (rowLimit around 5000), join on query, and keep the highest-clicks page per query. Leave the page blank when the join misses, and say the mapping is approximate for queries served by several pages.
3. When signals reinforce each other, say so explicitly: "high opportunity score AND sits in an underperforming CTR bucket" is stronger evidence than either alone, and should rank higher than a single-signal item with similar volume.
4. For each item, state:
   - Expected impact: use the estimated extra clicks from the tools where available; otherwise impressions times the CTR gap. Label estimates as estimates.
   - Effort: low = rewrite title/meta description or adjust the snippet (CTR-gap items already ranking well); medium = on-page content improvements or internal links to push position 4-15 items up; higher = anything needing new content. Position: lower is better; movement toward a lower number is the improvement you are estimating.
5. Rank by expected impact adjusted for effort: prefer high-impact low-effort items at the top.

## Step 5: Present the results

1. Lead with two short context lines: the striking-distance set size from the position distribution, and the worst-underperforming CTR buckets.
2. Show the merged list as a compact markdown table: query, page (from the Step 4 mapping; blank if unmatched), current position, impressions, CTR, signals present, estimated extra clicks, effort. CTR values from the tools are already percentages on a 0-100 scale; never multiply them by 100.
3. Keep prose for interpretation only: which items reinforce, what the CTR curve implies, any caveats about the recent-days lag.
4. End with a short prioritized list of concrete recommendations, numbered, each naming the specific query or page, the action (for example "rewrite the title tag to include X", "add internal links from Y"), and the expected payoff. Cap it at 5-8 actions so it stays actionable.

## Grounding

Every number you report must name the tool it came from and the date range it covers, for example "clicks 12,340 (`get_site_summary`, 2026-09-21 to 2026-09-27)". For a table, state the tool and date range once on the line above it. If you derive a figure yourself (a delta, a sum, a share), say so and name the tool outputs it was computed from. Never report a number no tool returned.
