---
name: bing-performance
description: Report Bing search performance for a Search Console property with the GSC Wizard MCP server's Bing Webmaster tools: daily Bing clicks and impressions with a trend and a prior-period comparison, top Bing queries and landing pages, query-to-page pairs, one page's queries, a single query and page pair over time, Bing keyword demand, and the Bing-only versus Google-only winners against the Google top list, and Bing's share next to Google. Use when the user asks "how is my site doing on Bing", "Bing traffic", "Bing vs Google", "top Bing queries", "which pages get Bing traffic", "did this page slip on Bing", "Bing keyword volume", or about Bing Webmaster Tools performance.
---

# Bing Performance

Report how a property performs on Bing (Bing, Yahoo and DuckDuckGo organic, as served by Bing Webmaster Tools) next to its Google numbers, and end with recommendations. `$ARGUMENTS` may contain a property name or URL, a date range, a focus hint (a page URL, a query, or "compare with Google"), or a keyword for the demand check; honor it by going deeper on that part while still producing the full report.

## Workflow

1. **Resolve the property.** If `$ARGUMENTS` or the conversation names a property, use it. Site URLs use GSC formats: `sc-domain:example.com` or `https://www.example.com/`. Otherwise call `list_sites` and pick the obvious match. If several plausible properties exist, ask the user which one before continuing. Every property-scoped Bing tool takes that same GSC `siteUrl` and maps it to Bing's form itself (`sc-domain:example.com` becomes `https://example.com/`), echoing the result as `bingSiteUrl`.

2. **Confirm the Bing side.** Call `list_bing_sites` (no arguments). A `notConfigured: true` answer means Bing Webmaster Tools is not connected for the property's Google account in the GSC Wizard app; tell the user to add it there, report the Google side from step 4 only, and stop. Otherwise find the property in `siteDetails` and read `isVerified`: Bing serves data only for a verified site, an unverified one makes the property-scoped tools answer with a not-verified error that names the fix (a subfolder property has to be verified as its own site in Bing Webmaster Tools), and a property missing from `sites` has to be added there first.

3. **Set the windows.** Use the last 28 days compared with the previous 28 unless the user specifies dates, and pass the same `startDate` and `endDate` to the query, page and pair calls so the sections line up. Omitting both dates on a Bing tool returns everything Bing has (about 16 months of search data), not a settled 28-day default. Bing dates its query, page and pair rows by week, so a window selects whole weeks, and a short window that falls between two week dates comes back empty with an `emptyBecause` explanation; widen the window rather than retrying. Bing reports on its own calendar and carries no `settledThrough` or `partialDays`; if the newest days of a daily series read low, say they may not be fully reported yet instead of calling them a drop.

4. **Anchor on Google.** Call `get_site_summary` with `siteUrl` and `days: 28`, or with `startDate` and `endDate` when the user set a window, for Google clicks, impressions, CTR and position with the prior-period comparison. Later, derive Bing's share of combined clicks as Bing clicks divided by Bing plus Google clicks, say it is derived from `get_bing_traffic_stats` and `get_site_summary`, and call it approximate because the two engines count on their own calendars.

5. **Bing totals and trend.** Call `get_bing_traffic_stats` once with `startDate` set to the start of the prior window and `endDate` to the end of the current one. `totals` covers that whole span, so sum the `daily` rows (oldest first, each with `clicks` and `impressions`) per window yourself for the current and prior totals and the change, and say so. Note the peaks, dips and any week-shaped pattern in the series.

6. **Top queries and pages.** Call `get_bing_query_stats` with `limit: 50`; `queries[]` rows carry `query`, `clicks`, `impressions`, `ctr` and `position`, sorted by clicks then impressions, and `totalRows` counts the distinct queries Bing reported before the cut. Call `get_bing_page_stats` the same way for `pages[]` rows keyed by `page`. Bing reports only its top queries, so these rows never sum to the `get_bing_traffic_stats` totals; never present them as a complete picture.

7. **Pairs and drill-downs.** When the focus is a page, call `get_bing_page_queries` with `page` copied verbatim from a `pages[].page` value (Bing matches the full URL, including scheme, www and trailing slash) for the queries behind that page; they sum to at most the page's own row. When the focus is a query, or the user asks which pages compete for a term, call `get_bing_query_page_stats` with `query` set to that term. For the general picture call `get_bing_query_page_stats` with the default `seedLimit` of 25 (max 100): each seed page is a separate Bing request, so raise it only when the user wants wider coverage, and read `pairedBy`, `seedCount` and `truncated` (`true` means Bing had more pairs than the seeds reached). A pair `ctr` above 100 is Bing logging more clicks than impressions, so report it as such rather than correcting it.

8. **Trend for one pair.** When the user asks whether a page slipped for a term, or when the largest pair from step 7 lost clicks, call `get_bing_query_page_trend` with `query` and `page` copied verbatim from the pair row. `daily` holds one row per week and position Bing recorded, so a date can repeat, and two rows on one date are two positions held that week, not a swing; `totals.position` is impression-weighted. Read the position direction across weeks and whether impressions moved with it.

9. **Demand check (optional).** When a top query or the user's keyword lost impressions, call `get_bing_keyword_stats` with `keyword`, and with `country` (default "us") and `language` (default "en-US") set to the property's market; it takes no `siteUrl` because it is marketplace demand, not site data. `stats[]` holds weekly `impressions` and `broadImpressions`, oldest first. Falling market impressions with a stable position means the decline is demand-driven; flat demand with falling site impressions means the ranking slipped.

10. **Bing-only and Google-only winners.** Call `query_top_queries` with the same `startDate`, `endDate` and `limit: 50` for the Google list. Match query text exactly (trimmed, lowercased) against the Bing list from step 6: a query in Bing's list but not Google's is a Bing-only winner, and the reverse a Google-only winner; for shared queries compare the two positions by direction only, since the engines measure position differently. Say plainly that both lists are top-50 samples, so "absent" means "not in that engine's top 50", not "no traffic".

## Interpretation rules

- `ctr` values are already percentages on a 0-100 scale. Never multiply them by 100.
- `position`: lower is better. A change toward a lower number is an improvement; never color it as a decline.
- Judge every finding by the clicks and impressions at stake, not by percentage alone; a Bing-only winner with 3 clicks is a footnote.
- Present every multi-row result as a compact markdown table (top rows only, typically 5 to 10); keep prose for interpretation, not for restating numbers.
- Query, page and pair rows are weekly samples of Bing's top values: treat them as the shape of Bing traffic, and treat only `get_bing_traffic_stats` as the total.
- Do not fabricate rows the tools did not return. If a tool returns nothing, say so and relay its `emptyBecause` and `nextStep` where present.

## Output

Present the report in this order, with tables for multi-row data and prose only for interpretation:

1. **Headline**: Bing clicks and impressions for the window with the change against the prior window, and Bing's derived share of combined clicks next to the Google figures.
2. **Trend**: two or three sentences on the daily series.
3. **Top Bing queries** and **top Bing pages**: one table each with clicks, impressions, `ctr` and `position`.
4. **Pairs or drill-downs** and the **pair trend**, when run: the pairs table or the page's query table, and the weekly position direction.
5. **Bing-only and Google-only winners**, one table per direction:

| Query | Bing clicks | Bing position | Google clicks | Google position |
|---|---|---|---|---|

   Fill the missing engine's cells with "not in top 50".
6. **Demand check**, when run: the keyword, the recent weekly impressions, and whether the move is demand or ranking.
7. End with a short prioritized list of 3 to 7 concrete recommendations, each naming the query or page and the action, for example:
   - carry a Bing-only winner's content or internal links over to the page that should rank for it on Google;
   - rewrite titles and descriptions for high-impression, low-`ctr` Bing queries;
   - investigate a pair whose weekly position slipped while demand held;
   - verify the site, or the subfolder, in Bing Webmaster Tools when step 2 found it unverified.

For Bing crawl, index and link health run the bing-crawl-health skill; for a full Google triage run the site-audit skill.

## Error handling

If any tool call fails with an authentication or subscription error, tell the user to run `/mcp` to (re)authenticate, and that a GSC Wizard account with an active plan or trial plus a connected Google Search Console account is required. If the property is not found, re-run `list_sites` and offer the closest matches instead of guessing a URL format. If a single tool fails for another reason, report the gap in the relevant section and complete the rest of the workflow with the remaining data. A Bing rate-limit error says to wait a moment and try again: do that once, and never loop.

## Grounding

Every number you report must name the tool it came from and the date range it covers, for example "clicks 12,340 (`get_site_summary`, 2026-09-21 to 2026-09-27)". For a table, state the tool and date range once on the line above it. If you derive a figure yourself (a delta, a sum, a share), say so and name the tool outputs it was computed from. Never report a number no tool returned.
