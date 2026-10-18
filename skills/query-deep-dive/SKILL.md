---
name: query-deep-dive
description: Build a picture of one query for a Search Console property with the GSC Wizard MCP tools: its click, impression, CTR and position series, the pages Google serves for it, its country and device split, whether several pages cannibalize it, its estimated GA4 value when GA4 is linked, and Bing keyword demand plus the pages Bing ranks for it, condensed into a query scorecard with recommendations. Use when the user names one keyword and asks "how am I doing for X", "why did I lose rankings for X", "which page ranks for X", "deep dive on this keyword", or "what is the demand for X on Bing".
---

# Query Deep Dive

Explain everything the connected tools know about one keyword and condense it into a query scorecard, the pages serving it, where it ranks by market and device, and recommendations. The user's request may contain a property, the query text, a date range, a market or device, and a focus hint such as "compare with Bing"; honor all of them.

## Workflow

1. **Resolve the property, the query and the window.** If the user's request or the conversation names a property, use it. Site URLs use GSC formats: `sc-domain:example.com` or `https://www.example.com/`. Otherwise call `list_sites` and pick the obvious match. If several plausible properties exist, ask the user which one before continuing.
   - Take the query text exactly as given; the tools below match it exactly, and step 2 says what to do when no row matches.
   - Use the last 28 days compared with the previous period unless the user specifies dates. The daily tool takes no comparison parameter, so compare the first and second half of the window yourself and say the delta is derived.
   - GSC data lags about 2 to 3 days: never treat the most recent 2 days as complete, and if a dip appears at the very edge of the range, say it is likely reporting lag, not a real drop.

2. **Daily series.** Call `get_query_performance` with `siteUrl`, `query` and the optional `startDate`/`endDate`, leaving `pageUrl` out so the query is measured site-wide. `daily` holds one row per day, oldest first, with clicks, impressions, `ctr` and position.
   - `ctr` values are already percentages on a 0-100 scale. Never multiply them by 100. `position`: lower is better, and a change toward a lower number is an improvement; never color it as a decline.
   - Describe the shape: flat, a step change on a named date, a slide, a spike, or seasonality. Position worsening with impressions steady is a ranking loss; impressions falling with position steady is demand; clicks falling with both steady is the snippet or a SERP feature.
   - The `query` filter is an exact match. When `daily` is empty the response carries `emptyBecause`: call `query_search_analytics` with `dimensions: ["query"]` and `filters: [{ "dimension": "query", "operator": "contains", "expression": "<core term>" }]` to list the variants Google records (plural, word order, accents), pick the one with the most impressions or roll the close variants up, and say which you did.
   - Once step 3 names the top page, call `get_query_performance` again with `pageUrl` set to it; the gap between the page series and the site-wide series is the share other pages take.

3. **Pages serving the query.** Call `query_search_analytics` with `dimensions: ["page"]`, `filters: [{ "dimension": "query", "operator": "equals", "expression": "<query>" }]` and `rowLimit: 50`. Rows carry `keys` (the URL), clicks, impressions, `ctr` (0-100) and position.
   - One page holding most impressions is a clear owner; two or more with comparable impressions and different positions is a split, which step 5 scores.
   - Quote the query total from `coverage.filteredTotals` rather than summing rows.

4. **Markets and devices.** Repeat the same filtered call with `dimensions: ["country"]` and then `dimensions: ["device"]`; country codes come back as lowercase ISO 3166-1 alpha-3 (`usa`) and device values as uppercase (`MOBILE`), and an `equals` filter on either must use that exact case.
   - The overall position is impression-weighted, so a strong rank in a small market can hide a weak rank in the market that matters. Report the position in the top 3 markets and on each device.
   - Name the market the user cares about when the user's request gives one, and carry it into step 7's `country`.

5. **Cannibalization check.** Call `analyze_cannibalization` with `siteUrl`, the same dates, `minImpressions: 10` and `limit: 1000` (the schema's maximum), and look for the query in `cannibalized`.
   - A row carries `pageCount`, `totalClicks`, `totalImpressions`, `entropy` (Shannon entropy over the pages' impressions: higher means a more even split, which is worse) and `pages` (each with `url`, clicks, impressions, `ctr` and position, most impressions first).
   - When the query is absent, it either has one page or fell under the impression floor; say which the step 3 rows suggest.
   - Report the split here and point to the cannibalization skill for the full winner-and-fix workflow rather than redoing it.

6. **GA4 value, when linked.** Call `get_query_value_attribution` with `siteUrl`, the same dates, `organicOnly: true` and `limit: 5000` (the schema's maximum), then find the query's row in `rows`.
   - The figures are estimates by proportional click share over the query to page to landing-page join, never measured revenue: read `estSessions`, `estKeyEvents`, and `estRevenue` only when `hasRevenue` is true, plus `matchedClickShare` (0-1) for how much of the named-query click volume the estimates cover.
   - A `notConfigured` answer carries a `reason`: `no_scope` means Google Analytics is not connected on the GSC Wizard account named in `account` (with `reauthRequired: true` the Google account must be reconnected), and `no_property` means GA4 is connected but no GA4 property is linked to this site. Relay the `hint` and mark value "not linked".

7. **Bing demand.** Call `get_bing_keyword_stats` with `keyword` set to the query; it takes no `siteUrl` because this is marketplace demand, not property data.
   - `country` defaults to "us" and `language` to "en-US": set them to the user's main market, converting the alpha-3 code from step 4 to the two-letter code Bing expects (usa to us, gbr to gb, deu to de) with a matching BCP-47 tag.
   - `stats` holds weekly rows, oldest first, with `date`, `impressions` and `broadImpressions`; `count` is the number of weeks. Read the seasonality and the broad-match headroom, and compare the demand curve with the GSC impression series from step 2.
   - `emptyBecause` means Bing has no history for that keyword in that market. A `notConfigured` answer with a `hint` means Bing Webmaster Tools is not connected in the app: say so and skip both Bing steps.

8. **Bing pages.** Call `list_bing_sites` (no arguments) and check in `siteDetails` that the site is `isVerified`, since Bing serves data only for a verified site. Then call `get_bing_query_page_stats` with `siteUrl` (the GSC property URL), `query` set to the query text, and no dates for everything Bing has (about 16 months; Bing dates rows by week, so any window selects whole weeks).
   - `pairs` run by clicks then impressions, each with `query`, `url`, `clicks`, `impressions`, `ctr` (0-100, and above 100 when Bing logs more clicks than impressions) and `position`.
   - Compare Bing's page choice with Google's from step 3; a different page winning on Bing is a hint about which page the content best supports.
   - `truncated: true` means Bing had more; `emptyBecause` says why no pair came back.

## Output

Present the results in this order, with compact markdown tables for multi-row data and prose only for interpretation:

1. **Query scorecard**, one table with the tool and date range on the line above it:

   | Area | Verdict | Evidence |
   |---|---|---|
   | Visibility | ... | impressions, position and trend shape (step 2) |
   | Clicks and CTR | ... | clicks, CTR against the position (step 2) |
   | Pages | ... | owner page, split, entropy (steps 3 and 5) |
   | Markets and devices | ... | position in top markets and per device (step 4) |
   | Value | ... | estimated sessions, key events, revenue (step 6), or "not linked" |
   | Bing | ... | weekly demand, Bing's page, Bing position (steps 7 and 8), or "not configured" |

2. **Pages serving it**: a table (Page, Clicks, Impressions, CTR, Position) of up to 10 rows, with the Bing page beside the Google page when both exist.
3. **Where it ranks**: a table of the top markets and the three devices with impressions, clicks and position.
4. **Recommendations**: end with a short prioritized list of 3 to 7 concrete recommendations, each naming its evidence (consolidate two pages because the split has high entropy; rewrite the title because CTR at position 3 is low on mobile; build a market page because the biggest market ranks on page 2; cover the broad-match variants Bing shows demand for).

Present every multi-row result as a compact markdown table (top rows only, typically 5 to 10); keep prose for interpretation, not for restating numbers. Judge by the clicks and impressions at stake, not by percentage alone, and do not fabricate rows the tools did not return. When the user wants the fix for a split query, point to the cannibalization skill; for everything about the owner page, to page-deep-dive; for a ranked list across many queries, to quick-wins.

## Error handling

If any tool call fails with an authentication or subscription error, tell the user to run `/mcp` to (re)authenticate, and that a GSC Wizard account with an active plan or trial plus a connected Google Search Console account is required. If the property is not found, re-run `list_sites` and offer the closest matches instead of guessing a URL format. If a single tool fails for another reason, report the gap in the relevant section and complete the rest of the workflow with the remaining data.

## Grounding

Every number you report must name the tool it came from and the date range it covers, for example "clicks 12,340 (`get_site_summary`, 2026-09-21 to 2026-09-27)". For a table, state the tool and date range once on the line above it. If you derive a figure yourself (a delta, a sum, a share), say so and name the tool outputs it was computed from. Never report a number no tool returned.
