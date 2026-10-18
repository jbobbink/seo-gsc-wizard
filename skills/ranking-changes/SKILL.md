---
name: ranking-changes
description: Compare search rankings between any two periods for one Search Console property with the GSC Wizard MCP tools: new, lost, improved and declined queries and pages, movement between position bands, daily drill-downs on the top movers in each direction, and the Google updates or logged site changes that explain them. The user picks both windows, from last week against the week before to this quarter against the same quarter last year. Use when the user asks "what moved up or down", "winners and losers", "which keywords dropped", "ranking changes since", "compare this month with last month", or "year over year rankings".
---

# Ranking Changes

Report the winners and losers between two periods on one property and explain the biggest moves. Unlike the weekly-report skill, which is a fixed digest over the last settled week, this skill lets the user choose both windows, including year over year. The user's request may contain a property, the two periods in any phrasing ("September vs August", "last 14 days vs the 14 before", "Q3 2026 vs Q3 2025"), a dimension to lead with (queries or pages), a search type, and a focus hint such as a country or a section; honor each.

## Workflow

1. **Resolve the property.** If the user's request or the conversation names a property, use it. Site URLs use GSC formats: `sc-domain:example.com` or `https://www.example.com/`. Otherwise call `list_sites` and pick the obvious match. If several plausible properties exist, ask the user which one before continuing.

2. **Fix the two windows.** The default is the last 28 settled days compared with the previous 28, which is what the tools use when all four date fields are omitted. Otherwise:
   - Translate the user's phrasing into `startDate`/`endDate` (the current window) and `comparisonStartDate`/`comparisonEndDate` (the baseline) as YYYY-MM-DD, and keep both windows the same length.
   - Keep the newest 2 days out of the current window: GSC data lags about 2 to 3 days, so never treat the most recent 2 days as complete, and if a dip appears at the very edge of the range, say it is likely reporting lag, not a real drop.
   - For year over year, use the same calendar dates one year earlier; on a site with a weekly rhythm shift by 364 days rather than 365 so the weekdays line up.
   - State both windows on the first line of the output. If `get_position_distribution` answers the baseline window with `emptyBecause`, or `get_ranking_changes` files nearly every key as `new` with an empty `lost` bucket (its own `emptyBecause` appears only when both periods are empty), the stored history does not reach that far; say so instead of guessing.

3. **Query movers.** Call `get_ranking_changes` with `dimension: "query"`, the four dates from step 2, and `limit: 50` (per bucket, 1 to 10000; raise it to 200 on a large property). Pass `searchType` only when the user asked for image, video or news; the default is web.
   - Read `counts` for the full size of each bucket, then the buckets `new`, `lost`, `improved` and `declined`.
   - Each row carries `key`, `clicks`, `impressions`, `ctr`, `position`, `prevClicks`, `prevImpressions`, `prevPosition` and `positionDelta` (prevPosition minus position: positive is an improvement, negative a decline; a new or lost key's missing side reads 0).
   - `improved` and `declined` arrive sorted by the size of the position move, `new` by `clicks` and `lost` by `prevClicks`; re-rank improved and declined by click impact (`clicks` for improved, `prevClicks` for declined) before choosing the rows to show.
   - Note `dataSource`: on the live API a key just below the scan cut can show as new or lost, so treat small new and lost rows there with care.

4. **Page movers.** Repeat the call with `dimension: "page"`.
   - Match page losers against query losers: a page that lost its top queries is the unit to fix.
   - A query that moved although its page held means another page on the site took it over, which is the cannibalization skill's job; a page that is new while its queries are not points to a URL change, so check for a migration before calling it a win.

5. **Band movement.** Call `get_position_distribution` twice with `granularity: "period"` and `dimension: "query"`: once with the current window as `startDate`/`endDate`, once with the baseline.
   - Compare `buckets` by `label` (1-3, 4-10, 11-20, 21+) on `rows`, `impressions`, `clicks` and `impressionShare`; derive the share deltas yourself and say so.
   - When the move built up over the window rather than landing on one day, call it once more with `granularity: "daily"` over the current window and read `days`, one row per date with the count of distinct queries per band, to see the day the counts shifted.
   - If `truncated` is true on the live API path, raise `scanLimit` (1000 to 200000) and say the deep bands were understated.

6. **Drill into the top three movers each way.** For the three largest gainers and the three largest losers by click impact, pull the daily series across both windows:
   - `get_query_performance` with `query`, `startDate` set to the baseline start and `endDate` to the current end (add `pageUrl` when the user wants the query on one URL) returns `daily` rows.
   - `get_page_performance` with `pageUrl` and the same dates does the same for a page.
   - Read each series for its shape: a step on one date (look for a cause on that date), a slow slide (content decay; point to the content-decay skill), or a swing that reversed inside the window (volatility, not a trend). Say whether the move still holds in the last 7 settled days.

7. **Explain.** Pull the events that span both windows:
   - `list_annotations` with `siteUrl`, `startDate` set to the baseline start and `endDate` to the current end, for logged site changes.
   - `list_algo_updates` with the same dates, for Google ranking updates (`updates` rows carry `name`, `beginISO`, `endISO`, `severity`); an empty list is not proof that nothing changed, since only confirmed updates are listed.
   - Tie each top mover to an event on or just before its step date where the dates line up, and say plainly when nothing does. A year-over-year span covers many updates, so name only those overlapping the step dates found in step 6.

## Interpretation rules

- `ctr` values are already percentages on a 0-100 scale. Never multiply them by 100.
- `position`: lower is better. A change toward a lower number is an improvement; never color it as a decline. `positionDelta` already has the sign the right way round: positive means improved.
- Judge by clicks and impressions at stake, not by percentage or position change alone: a query falling from 2 to 5 on 3,000 clicks outranks one falling from 40 to 80 on 10.
- Present every multi-row result as a compact markdown table (top rows only, typically 5 to 10); keep prose for interpretation, not for restating numbers.
- Do not fabricate rows the tools did not return. If a bucket is empty, say so, and quote the tool's `emptyBecause` when it gives one.

## Output

State both windows and the lead dimension on the first line, then present, in this order:

1. **Four compact tables**, one per bucket in the order improved, declined, new, lost. Each holds the top 5 queries followed by the top 5 pages for that bucket, and the bucket's `counts` value sits above it so the reader sees how many rows it really holds:

   | Key | Clicks (current) | Clicks (baseline) | Position (current) | Position (baseline) | positionDelta |
   |---|---|---|---|---|---|

2. **Band movement**: a four-row table (1-3, 4-10, 11-20, 21+) with rows, impressions and impression share for both windows and the derived delta, plus one sentence on what the shift means (share leaving 1-3 is lost visibility on winning terms; rows entering 11-20 from 21+ are terms within reach):

   | Band | Rows (current) | Rows (baseline) | Impressions (current) | Impressions (baseline) | Share (current) | Share (baseline) | Share delta |
   |---|---|---|---|---|---|---|---|

3. **Drill-downs**: for each of the six movers, two or three flowing sentences on the shape of the daily series, when it moved, whether it still holds, and the matched update or annotation if any.
4. **Recommendations**: a short prioritized list of 3 to 7 concrete items, each naming the query or page and the action, for example refresh the page that slid, consolidate the two pages trading one query, strengthen a page that reached 4-10 and can take 1-3, or rewrite titles where position held but clicks fell.

## Error handling

If any tool call fails with an authentication or subscription error, tell the user to run `/mcp` to (re)authenticate, and that a GSC Wizard account with an active plan or trial plus a connected Google Search Console account is required. If the property is not found, re-run `list_sites` and offer the closest matches instead of guessing a URL format. If a single tool fails for another reason, report the gap in the relevant section and complete the rest of the workflow with the remaining data.

## Grounding

Every number you report must name the tool it came from and the date range it covers, for example "clicks 12,340 (`get_site_summary`, 2026-09-21 to 2026-09-27)". For a table, state the tool and date range once on the line above it. If you derive a figure yourself (a delta, a sum, a share), say so and name the tool outputs it was computed from. Never report a number no tool returned.
