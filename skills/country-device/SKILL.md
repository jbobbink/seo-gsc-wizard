---
name: country-device
description: Analyse a Search Console property's international and device performance with the GSC Wizard MCP tools: per-country and per-device tables for the current and prior window from query_countries and query_devices, market-specific winning and losing pages and queries from filtered query_search_analytics pulls, the property anchor from get_site_summary, and real-user Core Web Vitals per form factor from get_core_web_vitals. Use when the user asks "which countries drive my traffic", "how do I perform in Germany", "mobile vs desktop", "is mobile dropping", "where is my CTR low for the position I hold", or about hreflang, local content or international SEO.
---

# Country and Device Performance

Build a markets table and a device table for one property, find the gaps (markets where the position is fine but the CTR is low, declines that only mobile shows), and recommend fixes. `$ARGUMENTS` may contain a property (a GSC site URL or a recognizable name), a date range, a country (a name or an ISO 3166-1 alpha-3 code), a device, or a URL path to narrow the winners and losers step.

## Workflow

1. **Resolve the property.** If `$ARGUMENTS` or the conversation names a property, use it. Site URLs use GSC formats: `sc-domain:example.com` or `https://www.example.com/`. Otherwise call `list_sites` and pick the obvious match. If several plausible properties exist, ask the user which one before continuing.

2. **Anchor and windows.** Call `get_site_summary` with `days: 28`, or with `startDate`/`endDate` when the user gave dates (a date you pass always wins and `days` only sizes an edge you leave out). Use the last 28 days compared with the previous period unless the user specifies dates.
   - Read `current` and `previous` (`clicks`, `impressions`, `ctr`, `avgPosition`) and `deltas` (`clicks`, `impressions`, `ctrPoints`, `positionDelta`).
   - Keep `range.startDate`/`range.endDate` and `comparison.startDate`/`comparison.endDate` from the response and pass those exact dates to every later call, so all sections line up.
   - GSC data lags about 2 to 3 days: never treat the most recent 2 days as complete, and if a dip appears at the very edge of the range, say it is likely reporting lag, not a real drop.

3. **Markets.** `query_countries` takes a single date range and no comparison argument, so call it twice: once with the current window and once with the comparison window, with `limit: 25` (raise it, or page with `offset` set to `pagination.nextOffset`, when the user wants more markets).
   - Rows are `countries[]` with `country`, `clicks`, `impressions`, `ctr` (0-100) and `position`, sorted by clicks. Country codes are lowercase ISO 3166-1 alpha-3 as the tools return them (for example `usa`, `gbr`, `deu`); print the country name next to the code and keep the code, in that case, for filters, since an `equals` match is case-sensitive on both data paths.
   - Join the two calls by `country` and derive the click, impression, CTR-point and position deltas; say they are derived. Quote property totals from `coverage.siteTotals`, not from summed rows, and give each top market's share of total clicks as a derived figure.

4. **Devices.** Call `query_devices` twice the same way (current window, then comparison window). Rows are `devices[]` with `device` (`DESKTOP`, `MOBILE`, `TABLET`), `clicks`, `impressions`, `ctr` and `position`.
   - Join by `device`, derive the deltas and the mobile share of clicks.
   - A mobile-only decline is mobile clicks down while desktop is flat or up. Check whether mobile `position` worsened (a ranking problem, often page experience or mobile content parity) or only mobile `ctr` fell (a SERP-layout or snippet problem).

5. **CTR gaps.** For each of the top 5 to 10 markets, compare its `ctr` and `position` with the property anchor from step 2 and with the best-performing market at a similar position. Apply the same comparison to `MOBILE` versus `DESKTOP`.
   - A market whose position is within about one place of a comparable market but whose CTR is clearly lower is a CTR gap. The usual causes are a page in the wrong language ranking there, titles and snippets written for another market, missing or conflicting hreflang, or local competitors with richer results.
   - Report no gap where the numbers do not show one; a low CTR at position 15 is a ranking problem, not a CTR gap.

6. **Market-specific winners and losers.** For each market the user cares about (or the top 3 by clicks plus the market with the largest negative delta), call `query_search_analytics` with `dimensions: ["page"]`, `rowLimit: 50` and `filters: [{ "dimension": "country", "operator": "equals", "expression": "<lowercase alpha-3 code>" }]`, once per window; join by `keys[0]` (the page) and rank the page deltas.
   - To see which page ranks where across markets in one pull, call it with `dimensions: ["country", "page"]` and `rowLimit: 500` (rows carry `keys: [country, page]`). A market served mainly by a page written for another market is the hreflang or local-content signal to report.
   - For devices, call it with `dimensions: ["device", "query"]` and `rowLimit: 500` for both windows, or filter with `{ "dimension": "device", "operator": "equals", "expression": "MOBILE" }` and `dimensions: ["query"]`; the device expression is uppercase, as `query_devices` returns it.
   - Keep to two dimensions: three or more distinct dimensions send the read to the live API, which is slower and capped. Rows carry `clicks`, `impressions`, `ctr` (0-100) and `position`; derive every delta you present.

7. **Core Web Vitals per form factor.** `get_core_web_vitals` measures one device class per call (`formFactor`: `ALL` by default, or `PHONE`, `DESKTOP`, `TABLET`), so call it with `formFactor: "PHONE"` and again with `formFactor: "DESKTOP"`, and optionally with `url` set to the biggest mobile losing page from step 6.
   - Read `metrics[]` (`label`, `coreWebVital`, `latestP75Formatted`, `latestRating`, `p75Series`, `goodDensitySeries`), `periods` (oldest first, so the last entry is the latest week) and `regressions`. When `regressions` is empty, `methodLimits` explains that only a rating-band change between the two latest weeks is listed, so read `p75Series` for a slower drift.
   - A `notConfigured: true` response means the Chrome UX Report connection is not set up in the app; say so and skip page experience rather than guessing. A `noData: true` response means CrUX holds too little real-world Chrome traffic for that target and form factor; quote its `message` and run the wider call its `nextStep` names if present.
   - A poor or regressing mobile vital next to a mobile-only decline from step 4 is a probable cause; without the decline it is a watch item.

## Interpretation rules

- `ctr` values are already percentages on a 0-100 scale. Never multiply them by 100. `coverage.hiddenClicksShare` and the CrUX `goodDensitySeries` are 0-1 fractions, so multiply those by 100 to present them.
- `position`: lower is better. A change toward a lower number is an improvement; never color it as a decline.
- Judge by clicks and impressions at stake, not by percentage alone: a 30% drop on a 40-click tablet row matters less than a 4% drop on the mobile row.
- Present every multi-row result as a compact markdown table (top rows only, typically 5 to 10); keep prose for interpretation, not for restating numbers.
- Do not fabricate rows the tools did not return. If a market or device is absent from a window, say so instead of filling in a zero.

## Output

Present, in this order:

1. **Anchor**: one sentence with the window, the comparison window and the four property metrics with their deltas (`get_site_summary`).
2. **Markets table** (`query_countries`, both windows):

   | Code | Country | Clicks | Prior clicks | Delta | Impressions | CTR | Position | Pos. delta | Share of clicks |
   |---|---|---|---|---|---|---|---|---|---|

3. **Device table** (`query_devices`, both windows):

   | Device | Clicks | Prior clicks | Delta | Impressions | CTR | Position | Pos. delta | Share of clicks |
   |---|---|---|---|---|---|---|---|---|

4. **Gaps**: a short list naming each market or device gap with the evidence (the two numbers compared and the tools they came from): CTR gaps at a fine position, mobile-only declines, wrong-market pages ranking, and the Core Web Vitals verdict per form factor with any regression.
5. **Winners and losers per market** (`query_search_analytics`): one small table per market covered, with page, clicks, prior clicks, delta and position.
6. End with a short prioritized list of 3 to 7 concrete recommendations, each naming the market or device and the pages or queries to act on: add or fix hreflang where another market's page ranks, write or localise content for a market with impressions but weak CTR, rewrite titles and snippets for a CTR gap, fix the regressing mobile vital or the mobile content gap, and what to re-check next period.

## Error handling

If any tool call fails with an authentication or subscription error, tell the user to run `/mcp` to (re)authenticate, and that a GSC Wizard account with an active plan or trial plus a connected Google Search Console account is required. If the property is not found, re-run `list_sites` and offer the closest matches instead of guessing a URL format. If a single tool fails for another reason, report the gap in the relevant section and complete the rest of the workflow with the remaining data.

## Grounding

Every number you report must name the tool it came from and the date range it covers, for example "clicks 12,340 (`get_site_summary`, 2026-09-21 to 2026-09-27)". For a table, state the tool and date range once on the line above it. If you derive a figure yourself (a delta, a sum, a share), say so and name the tool outputs it was computed from. Never report a number no tool returned.
