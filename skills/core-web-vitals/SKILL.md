---
name: core-web-vitals
description: Review page experience for a Search Console property from Chrome UX Report field data with the GSC Wizard MCP tools: Core Web Vitals (LCP, INP, CLS) plus FCP and TTFB with ratings, good-share trends and week-over-week regressions via get_core_web_vitals, split by device and by page, tied to the pages that carry the clicks with query_top_pages and to GA4 engagement with get_blended_landing_pages when linked, ending with a vitals table, the pages or templates to fix first, and metric-specific recommendations. Use when the user asks "how are my Core Web Vitals", "is my site slow", "page speed", "LCP", "INP", "CLS", "page experience", or whether a speed fix worked.
---

# Core Web Vitals Review

Report the real-user page experience of one property from Chrome UX Report (CrUX) field data, find the regressions, and rank the pages or templates to fix by the clicks at stake. `$ARGUMENTS` may contain a property, a single page URL, a device hint ("mobile", "desktop"), or a metric to focus on (LCP, INP, CLS); honor it by narrowing the calls, but still report all three Core Web Vitals.

## Steps

1. **Resolve the property.** If `$ARGUMENTS` or the conversation names a property, use it. Site URLs use GSC formats: `sc-domain:example.com` or `https://www.example.com/`. Otherwise call `list_sites` and pick the obvious match. If several plausible properties exist, ask the user which one before continuing.

2. **Origin-level vitals.** Call `get_core_web_vitals` with `siteUrl` and `formFactor: "ALL"` (the default; the other values are `PHONE`, `DESKTOP`, `TABLET`). Omit `url` so the whole origin is measured. Three answers are possible:
   - `notConfigured: true` with a `hint`: the Chrome UX Report connection is not set up in the GSC Wizard app. Tell the user so, relay the hint (the Core Web Vitals report in the app is where that connection is set up), and stop the vitals part of this workflow; still run steps 4 and 5 so the user gets the traffic picture.
   - `noData: true` with `message`, `emptyBecause` and `nextStep`: CrUX holds no record for that target and device class because it had too little real-world Chrome traffic. Do what `nextStep` says (the whole origin instead of a page, `formFactor: "ALL"` instead of one device); if the origin itself has no data, say the site is below the CrUX traffic threshold and that lab data is the only option.
   - A result: `periods` (oldest first, each a 28-day collection window ending in that week; never read a series newest-first), `periodLabels` and `latestPeriod`.
   - `metrics[]` with `key`, `label`, `coreWebVital` (true for LCP, INP, CLS; false for FCP and TTFB, which are diagnostics), `unit`, `latestP75`, `latestP75Formatted`, `latestRating` (good, needs-improvement or poor), `latestGoodDensity` (a 0-1 fraction of page loads rated good; multiply by 100 only when you present it as a percent and say so), `p75Series` and `goodDensitySeries` aligned with `periods`.
   - Use `latestRating` as the verdict; do not re-rate the numbers yourself. CLS is unitless, the other metrics are milliseconds.
   - `regressions[]`: each with `metricKey`, `fromRating`, `toRating`, `fromValueFormatted`, `toValueFormatted`, `fromPeriod`, `toPeriod`. It lists only a Core Web Vital whose rating band got worse between its two latest weeks with data; when it is empty the response carries `methodLimits`, so read `p75Series` for drift inside a band or over a longer span and report that as a trend, not as a regression.
   - `adMetrics[]` (only when Chrome detected ads): experimental ad count, density, CPU and network weight as p75 trends with no rating and no thresholds; mention them when a site carries ads and INP or LCP is poor.
   - `softNavMetrics[]` (experimental): LCP, INP and CLS counting single-page-app route changes, rated on the stable thresholds, with `pageLoadsOnlyLatestP75` beside each for the same week; entries are null before October 2026 and never appear in `regressions`.

3. **Device split.** Call `get_core_web_vitals` twice more with `formFactor: "PHONE"` and `formFactor: "DESKTOP"`.
   - A metric that is poor on PHONE and good on DESKTOP points at mobile-only causes (image weight, main-thread work on slow devices).
   - A `noData` answer for one device means too little traffic there, not a clean bill. Skip TABLET unless the user asks, as it rarely has data.
   - Report a device only where its rating differs from ALL; a device with the same ratings adds nothing to the table.

4. **Tie vitals to traffic.** Call `query_top_pages` with `siteUrl` and `limit: 25`, omitting `startDate` and `endDate` for the last 28 settled days.
   - GSC data lags about 2 to 3 days: never treat the most recent 2 days as complete, and name the `range` the tool reports.
   - Rows are sorted by clicks, highest first; `ctr` is a 0-100 percentage, never multiply it by 100; `position` is lower-is-better.
   - Quote the property total from `coverage.siteTotals`, not from a sum of rows, and compute (and say you computed) each page's share of clicks.
   - Call `get_core_web_vitals` with `url` set to each of the top 3 to 5 pages by clicks, one call per page, keeping `formFactor: "ALL"`. Group pages by template when the URL pattern makes it obvious (one product page stands for the product template).
   - Page-level `noData` is common: fall back to the origin reading for that page and say so. Keep page-level calls to a handful, since CrUX has its own daily API quota and a rate-limited error ends the step.

5. **Tie vitals to engagement (optional, needs GA4).** Call `get_blended_landing_pages` with `siteUrl` and `limit: 25`, omitting the dates for the last 28 settled days and leaving `organicOnly` at its default of true so the GA4 side describes the same google / organic traffic.
   - `notConfigured: true` with `reason: "no_scope"` means Google Analytics is not connected to this GSC Wizard account; with `reauthRequired: true` it is connected but Google rejects the connection, so the fix is a reconnect. `reason: "no_property"` means no GA4 property is linked to this site. Relay the `hint` and continue without engagement data.
   - Otherwise read per landing page the GSC clicks and `ctr` (0-100) beside the GA4 sessions, `bounceRate` (a 0-1 fraction, unlike `ctr`), key events and revenue.
   - A page with a poor vital and a high bounce rate or low key-event rate is the strongest candidate; a page with poor vitals but healthy engagement still carries ranking risk, with less urgency.

6. **Interpret.** Apply two rules, then name the fix class per metric with the table below.
   - Judge by clicks at stake, not by the size of a regression alone: a poor INP on the page that carries a third of the clicks outranks a needs-improvement CLS on a page with ten.
   - CrUX aggregates a rolling 28-day window per weekly period, so a fix deployed today shows up gradually over about four periods; say so when the user asks whether a fix worked, and compare `p75Series` across the periods before and after the deploy date.

| Metric | Usual cause | Fix class |
|---|---|---|
| LCP | Slow server response (read TTFB), render-blocking CSS and scripts, a heavy or late hero image | Server and cache tuning, defer non-critical assets, compress and preload the hero image |
| INP | Long JavaScript tasks, heavy event handlers, third-party scripts | Split long tasks, trim handlers, load third parties late |
| CLS | Images and embeds without reserved dimensions, late-injected banners or ads, web-font swaps | Reserve space, keep injected content below the fold, tune font loading |
| FCP, TTFB | Diagnostics, not Core Web Vitals (`coreWebVital: false`) | Use them to explain LCP; never list them as targets of their own |

## Output

Present the review in this order, with compact markdown tables (top rows only, typically 5 to 10) and prose only for interpretation:

1. **Vitals table** (`get_core_web_vitals`, origin, `formFactor: "ALL"`, `latestPeriod` named): Metric, p75 (formatted), Rating, Good share, Trend (p75 four periods ago versus latest, derived from `p75Series`; say it is derived). Add a line per device from step 3 where the rating differs from ALL.
2. **Regressions**: one row per entry in `regressions`, with the metric, the rating change, the two values and the two periods; if none, say so and give the within-band drift from `p75Series` instead.
3. **Pages to fix first** (`query_top_pages` and the page-level `get_core_web_vitals` calls, with the GSC range): Page or template, clicks, share of property clicks (derived), the page-level or origin-level rating per Core Web Vital, and, when step 5 ran, the GA4 bounce rate. Order by clicks at stake among pages with a poor or needs-improvement rating.
4. **Ad and soft-navigation metrics**: only when present, one short table each, marked experimental.

End with a short prioritized list of 3 to 7 concrete recommendations, each naming the metric (LCP, INP or CLS), the page or template, the fix class from step 6, and what to re-check in about four weeks.

If the CrUX key is not configured, make configuring it the first recommendation and keep the rest to the traffic picture. Do not fabricate rows the tools did not return; if every rating is good and `regressions` is empty, say so and keep the recommendations to monitoring.

## Error handling

If any tool call fails with an authentication or subscription error, tell the user to run `/mcp` to (re)authenticate, and that a GSC Wizard account with an active plan or trial plus a connected Google Search Console account is required. If the property is not found, re-run `list_sites` and offer the closest matches instead of guessing a URL format. If a single tool fails for another reason, report the gap in the relevant section and complete the rest of the workflow with the remaining data.

## Grounding

Every number you report must name the tool it came from and the date range it covers, for example "clicks 12,340 (`get_site_summary`, 2026-09-21 to 2026-09-27)". For a table, state the tool and date range once on the line above it. If you derive a figure yourself (a delta, a sum, a share), say so and name the tool outputs it was computed from. Never report a number no tool returned.
