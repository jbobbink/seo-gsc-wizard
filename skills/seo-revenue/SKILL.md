---
name: seo-revenue
description: Find which Search Console queries and landing pages make money by joining GSC clicks, CTR and position with GA4 sessions, key events and revenue through the GSC Wizard MCP server: blended landing pages, per-query value attribution (an estimate by click share), GA4 ecommerce breakdowns, a non-purchase key event where there is no shop, and the search-side page anchor. Use when the user asks "which pages make money from SEO", "revenue per keyword", "what is organic search worth", "which queries convert", "SEO ROI", "pages with traffic but no sales", "value of my organic traffic", or wants revenue tied to search queries and pages.
---

# SEO Revenue

Work out which landing pages and queries produce GA4 value for one property, and which carry search traffic that produces nothing. `$ARGUMENTS` may contain a property, a date range, a key event name to use as the conversion when the site has no ecommerce, a branded or non-branded scope, or a focus hint such as a section path; honor it and resolve the rest below.

## Workflow

1. **Resolve the property.** If `$ARGUMENTS` or the conversation names a property, use it. Site URLs use GSC formats: `sc-domain:example.com` or `https://www.example.com/`. Otherwise call `list_sites` and pick the obvious match. If several plausible properties exist, ask the user which one before continuing. Use the last 28 days compared with the previous period unless the user specifies dates. GSC data lags about 2 to 3 days: never treat the most recent 2 days as complete, and if a dip appears at the very edge of the range, say it is likely reporting lag, not a real drop. The GA4 side of these tools reads the same settled window when the dates are omitted, so leave them out unless the user set them; when explicit dates reach the last day or two, say GA4 may still be processing them.

2. **Search-side anchor.** Call `query_top_pages` with `siteUrl` and `limit: 50` (default 100, max 1000; `offset` with `pagination.nextOffset` pages further). Rows carry `page`, clicks, impressions, `ctr` (0-100) and position: the pages that earn organic clicks before any GA4 join, and the reference list for "traffic but no value" later.
   - Add `brand: "non_branded"` when the user wants brand demand excluded (it needs branded keywords set on the site; `get_filter_options` says whether they are), or `contentGroupId` / `topicClusterId` to narrow to a section.
   - The tool has no comparison parameter, so run it a second time with the previous period's `startDate` and `endDate` only when the user asks for movement.

3. **Blended landing pages.** Call `get_blended_landing_pages` with `siteUrl`, `limit: 50` (max 500) and the default `organicOnly: true`, which limits the GA4 side to google / organic sessions so both halves describe the same visitors; pass `comparisonStartDate` and `comparisonEndDate` for the previous period to fill the `prev*` fields. Read the response in three parts:
   - Each row is one canonical path (`key`) with the GSC side (clicks, impressions, `ctr` as 0-100, position) and the GA4 side (sessions, activeUsers, `bounceRate` as 0-1, keyEvents and `revenue`, which is only present when the GA4 property records revenue; `currencyCode` names the currency).
   - `matchedCount`, `gscOnlyCount` and `ga4OnlyCount` say how many pages were joined. A row with `ga4Matched: false` has search clicks but no GA4 landing-page row, which usually means a redirect, a tracking gap, or a URL-prefix property whose path does not cover it, while GA4-only rows have sessions without search clicks. `ga4Truncated: true` means GA4 returned more landing pages than the join could take, so the GA4-only count is a floor.
   - For a trend, call it again with `dateGranularity: "month"` (or `"week"`; `"day"` only for short windows, since a call takes at most 60 periods): every row then carries the period start as `date`, `limit` applies per period, and `prev*` compares each period with the one before, which is why an explicit comparison range cannot be combined with it.

4. **Value per query.** Call `get_query_value_attribution` with `siteUrl`, `limit: 200` (default 1000, max 5000) and the default `organicOnly: true`; it has no comparison arguments. Rows carry `query`, clicks, impressions, `estSessions`, `estKeyEvents`, `estRevenue` (only when `hasRevenue` is true), `pageCount` and `topPage`; `dateGranularity: "month"` turns it into a monthly series, the way to chart estimated revenue from non-branded queries over time. Say three things about these figures whenever they appear:
   - How they are made: GA4 never sees the query, so the tool credits each query with a share of its landing page's GA4 outcomes proportional to that query's share of the page's GSC clicks (a query with 80% of a page's clicks gets 80% of its sessions, key events and revenue).
   - Why they are estimates: device, country and date mismatches are invisible, every click is treated as equally likely to convert, and GSC hides a share of clicks behind no query row.
   - How much they cover: `matchedClickShare` (0-1) is how much of the named-query click volume the estimates cover, and `coverage.hiddenClicksShare` (0-1) the share of the property's clicks with no query row, which gets no estimate; when either leaves most of the clicks uncovered, say the query table is a sample of the value, not the total.

5. **GA4-reported revenue.** Call `get_ga4_ecommerce` with `siteUrl`, `limit: 25` (max 1000) and both comparison dates for a period-over-period view. `hasEcommerce: false` means the property shows no ecommerce activity in the period: say so and go to step 6. Otherwise:
   - Read `ecommerceSummary` (`totalRevenue`, `transactions` and `totalPurchasers` in `currencyCode`, with `prevEcommerceSummary` for the comparison) and the `channels`, `sources`, `pages`, `landingPages` and `items` tables, each sorted by revenue (`items` by `itemRevenue` per `itemName`); `totalRows` gives each table's full size before `limit`.
   - Use the "Organic Search" row of `channels` as the GA4-reported organic revenue and set it beside the summed `revenue` of the blended rows from step 3 (say the sum is derived); the two differ because the blended join is per landing page and drops unmatched paths.
   - `filters: { channel: ["Organic Search"] }` limits every table to organic sessions; when that makes `itemsFilterSkipped` true, the `items` table is unfiltered while the others are not.

6. **Conversion without a shop.** When `hasEcommerce` is false, or the user's goal is a lead rather than a sale, call `get_ga4_key_events` with `siteUrl`, `keyEvent` set to the event the user named (omit it to take the most active key event; `keyEventNames` lists the alternatives) and `filters: { channel: ["Organic Search"] }` so the `landingPages` and `pages` tables show where organic conversions happen. `summary.keyEventCount` with `sessionKeyEventRate` (0-1) is the organic conversion figure; `isKeyEvent: false` means the event is not marked as a key event in GA4 and the counts are plain events, which is worth telling the user to fix in GA4 Admin. Treat `keyEvents` and `estKeyEvents` from steps 3 and 4 as the per-page and per-query view of the same event mix.

7. **Find the mismatches.** Sort the blended rows and the attribution rows into these groups, and cross-check the first group against step 2 so a tracking gap is never reported as a conversion problem:

| Pattern | Evidence | Reading |
|---|---|---|
| traffic without value | high clicks, zero or near-zero `keyEvents` / `revenue`, `ga4Matched: true` | the page ranks for demand it cannot close; check intent, offer and internal links |
| tracking gap | high clicks, `ga4Matched: false` | GA4 has no landing-page row for the path: redirect, missing tag or path outside a URL-prefix property |
| value without traffic | high `revenue` or `keyEvents` on few clicks | the most profitable ranking gains; a position or CTR lift here pays most |
| valuable query | high `estRevenue` or `estKeyEvents` | protect and extend the page in `topPage`; check its position trend |
| empty query | high clicks, zero `estKeyEvents` | demand that lands on a non-converting page; pair it with the first group |

For CTR and position work on the valuable pages, point the agent to the quick-wins skill; for pages whose value is sliding, to the content-decay skill; for the channel and engagement picture without revenue, to the ga4-overview skill.

## Interpretation rules

- Label every revenue figure as GA4-reported (`get_ga4_ecommerce`, the `revenue` column of `get_blended_landing_pages`) or estimated (`estRevenue`, `estSessions`, `estKeyEvents` from `get_query_value_attribution`) every time it appears, with the currency from `currencyCode`; never add an estimate to a reported figure.
- `ctr` values are already percentages on a 0-100 scale. Never multiply them by 100. `bounceRate` and the key event rates are 0-1 fractions. `position`: lower is better; a change toward a lower number is an improvement, never a decline.
- Present every multi-row result as a compact markdown table (top rows only, typically 5 to 10); keep prose for interpretation, not for restating numbers. Judge by the revenue, key events and clicks at stake, not by percentage alone.
- Do not fabricate rows the tools did not return; an empty `items` table or `hasRevenue: false` is a finding, not a gap to fill.

## Output

1. **Top revenue pages**: the blended table sorted by revenue (or key events when there is no shop) with clicks, CTR, position, sessions, bounce rate and the matched-page counts (`get_blended_landing_pages`), and the GA4-reported organic total beside it (`get_ga4_ecommerce` or `get_ga4_key_events`).
2. **Top revenue queries**: the attribution table with estimated sessions, key events and revenue, `topPage`, and the two coverage figures (`get_query_value_attribution`), labelled as estimates.
3. **Traffic without value** and **value without traffic**: the two mismatch tables from step 7, with the tracking-gap rows separated out and the search anchor from `query_top_pages` named.
4. End with a short prioritized list of 3 to 7 concrete recommendations ordered by the revenue (or key events) at stake, each naming the page or query and the action: lift the ranking or CTR of a converting page, close the tracking gap, rework the offer or internal links on a high-traffic page that converts nothing, mark the right event as a key event.

## Follow-up

After delivering the analysis, offer `generate_seo_report` for the property, which runs the whole analysis suite in one call and includes the GA4 section when a property is linked, as a styled HTML report to hand over; run it only if the user asks, since the default `format: "html"` is a large result.

## Error handling

If any tool call fails with an authentication or subscription error, tell the user to run `/mcp` to (re)authenticate, and that a GSC Wizard account with an active plan or trial plus a connected Google Search Console account is required. If the property is not found, re-run `list_sites` and offer the closest matches instead of guessing a URL format. If a single tool fails for another reason, report the gap in the relevant section and complete the rest of the workflow with the remaining data.

Any GA4 tool may answer `notConfigured: true` instead of data: `reason: "no_scope"` means Google Analytics is not connected in the GSC Wizard app for the account named in `account` (with `reauthRequired: true` it is connected but has to be reconnected there), and `reason: "no_property"` means no GA4 property is linked to this site under that account; relay `hint`, keep the search-side anchor from step 2, and offer the site-audit skill for a search-only view. A refusal with `reason: "google_token_unavailable"` is temporary and worth one retry; `ga4_not_shared` means the owner has not enabled GA4 access on the share, which only the owner can change.

## Grounding

Every number you report must name the tool it came from and the date range it covers, for example "clicks 12,340 (`get_site_summary`, 2026-09-21 to 2026-09-27)". For a table, state the tool and date range once on the line above it. If you derive a figure yourself (a delta, a sum, a share), say so and name the tool outputs it was computed from. Never report a number no tool returned.
