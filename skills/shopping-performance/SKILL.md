---
name: shopping-performance
description: Analyze how a store's products perform in Google's free listings and against the market, using the GSC Wizard MCP Search Console and Merchant Center tools: merchant-listing performance, organic shopping clicks, impressions and conversions per offer or brand, price position against the market benchmark, best-seller rankings and the demand the catalog does not cover, competitive visibility by country and category, and raw Merchant Center queries when the fixed tools fall short. Use when the user asks "how are my products doing in Shopping", "which offers get the most free-listing clicks", "am I priced above the market", "who are my Shopping competitors", or "which best sellers am I missing".
---

# Shopping Performance

Report how one store's products perform in Google's free listings and how they stand against the market, ending with the offers and prices to act on. `$ARGUMENTS` may contain a property, a date range, a country (ISO 3166-1 alpha-2), a Google product taxonomy category id, a brand or offer id, or a focus hint such as "pricing" or "competitors"; honor it by going deeper there, but still run the core steps.

## Workflow

1. **Resolve the property and the window.** If `$ARGUMENTS` or the conversation names a property, use it. Site URLs use GSC formats: `sc-domain:example.com` or `https://www.example.com/`. Otherwise call `list_sites` and pick the obvious match. If several plausible properties exist, ask the user which one before continuing. Then fix the window:
   - Use the last 28 days compared with the previous period unless the user specifies dates; omitting both `startDate` and `endDate` gives the default window.
   - For the Search Console data in step 2, GSC data lags about 2 to 3 days: never treat the most recent 2 days as complete, and if a dip appears at the very edge of the range, say it is likely reporting lag, not a real drop.
   - Merchant Center (steps 3 to 7) reports on its own calendar and carries no `partialDays` flag, so say that the newest day may still fill in rather than reading it as a drop, and the best-seller reports lag up to two weeks.
   - Neither performance tool takes a comparison range: for a period-over-period view call it a second time with explicit prior-period dates and derive the deltas yourself, saying so.

2. **Merchant listings in web Search.** Call `get_merchant_listings_performance` with `siteUrl` and the default `appearance: "MERCHANT_LISTINGS"` unless the user asks for another code (`limit` default 25, max 1000, top pages by clicks; `includeAppearances` defaults to true). Read:
   - `hasAppearance` and `appearances` first: that breakdown is the only way to learn which search appearance codes the property has (`PRODUCT_SNIPPETS` and `ORGANIC_SHOPPING` are common) and how big each one is.
   - `totals`, the daily `timeline` and the top `pages`.
   This is always the live Search Console API: it counts enriched product results in web Search only, the appearance can only be filtered on and never grouped with another dimension, the window is capped at 16 months, and the call costs 3 rate-limit units. `ctr` values are already percentages on a 0-100 scale. Never multiply them by 100. `position`: lower is better. A change toward a lower number is an improvement; never color it as a decline.

3. **Organic shopping performance.** Call `get_organic_shopping_performance` with `siteUrl`, `groupBy: "offer"` (the default; the enum also allows `"brand"`, `"category"` for Google taxonomy level 1 and `"productType"` for the merchant's own taxonomy), `limit` (default 25, max 200, ordered by organic clicks) and `includeNonProduct` (default true). Read `totals` and the daily `timeline` (`clicks`, `impressions`, `ctr`, `conversions`, `conversionValue` in `currencyCode`), the `rows[]` (`key`, `title` and the same metrics) and `nonProductTimeline` for clicks to category and home pages. The `ctr` here is on the same 0-100 scale as step 2, so never multiply it by 100. Conversions need a Merchant Center conversion source; `conversionNote` says when they are absent. Call it again with `groupBy: "brand"` or `"category"` when the user asks about the mix. This covers every free surface (Shopping tab, Search, Images, Lens, YouTube, Maps), so it never reconciles with step 2; compare their trends, not their totals. Organic excludes YouTube affiliate traffic from 1 July 2026 onward, so a step down at that date is a definition change, not a loss. Underperformers are offers with many impressions and a `ctr` well below the table's typical value, or many clicks and zero conversions where conversions are reported.

4. **Price position.** Call `get_gmc_pricing_insights` with `siteUrl`, `sort: "gap"` (largest absolute `priceGapFraction` first; the default `"opportunity"` puts the largest `predictedClicksChangeFraction` first, so call it once per sort when both matter), `limit` (default 100, max 1000) and `countryCode` when the user names a market (otherwise every benchmark country, with `benchmarkCountryCode` per row). Both views are dateless snapshots of the current catalog and `snapshotDate` is the UTC day of the call. Read:
   - `summary`: `products`, `withBenchmark`, `withSuggestion`, `aboveBenchmark`, `belowBenchmark`, `atBenchmark`, `currencyMismatch`.
   - The rows: `offerId`, `title`, `price` against `benchmarkPrice`, `priceGapFraction`, Google's `suggestedPrice` with `suggestedChangeFraction`, `predictedImpressionsChangeFraction`, `predictedClicksChangeFraction`, `predictedConversionsChangeFraction` and `effectiveness` (`LOW`, `MEDIUM` or `HIGH`).
   Every one of those fractions is 0-1 (0.12 = 12%), not the 0-100 `ctr` scale: convert when you present them and say so. `priceGapFraction` is null when the two prices are in different currencies. Benchmarks need valid GTINs and suggestions need conversion reporting, so an empty result usually means not eligible (`eligibilityNote`). The products priced above market are the rows with a positive `priceGapFraction`; join them with step 3 to see which of them also carry traffic.

5. **Best-seller gaps.** Call `get_gmc_best_sellers` with `siteUrl`, `countryCode` (required: the user's main market), `view: "product_cluster"` (the default; `"brand"` ranks brands with no inventory data), `granularity: "WEEKLY"` (the default; `"MONTHLY"` is the other value), optionally `categoryId` (a Google product taxonomy id as a digits-only string, for example `"166"` for Apparel & Accessories; omit it for every top-level category) and `limit` (default 100, max 1000). Omit `reportDate` for the newest published report and read `reportDate` back; a WEEKLY date must be a Monday, a MONTHLY one the 1st. Read `demandGapCount` and the rows: `rank`, `previousRank`, `rankChange`, `relativeDemand`, `relativeDemandChange`, `title`, `brand`, `variantGtins`, `inventoryStatus` and `demandGap`, which flags a ranked cluster the account does not stock. `inventoryStatus` ignores the report country (`countryCaveat`), so a demand gap is an account-wide signal. The demand you do not carry is the set of `demandGap: true` clusters with the highest `relativeDemand`.

6. **Competitive visibility.** Call `get_gmc_competitors` with `siteUrl`, `countryCode` and `categoryId` (both required, because the Merchant API answers one country, category and traffic-source cell per request; a top-level taxonomy id works for every account, and the `reportCategoryId` of a best-seller row can be reused), `trafficSource: "ORGANIC"` (the default; `"ADS"` and `"ALL"` are the other values), `view: "competitor"` (the default: daily rows per domain in `rows[]` plus the per-domain roll-up in `domains[]`; `"top_merchant"` gives one aggregate row per domain over the window in `rows[]` and no `domains[]`, and `"benchmark"` gives your visibility trend against the category benchmark) and `limit` (default 50, max 200). The roll-up in `domains[]` (`domain`, `isYourDomain`, `days`, `bestRank`, `avgRank`, `avgRelativeVisibility`, `avgAdsOrganicRatio`, `avgPageOverlapRate`, `avgHigherPositionRate`) always covers every fetched row regardless of the cap, so read it rather than the capped daily rows. Units differ per field:
   - `relativeVisibility` and `adsOrganicRatio` are ratios, not fractions: 200 means that domain's offers were shown 200 times as often as yours, and 2 means twice as many Shopping ads impressions as free-listing ones.
   - `pageOverlapRate`, `higherPositionRate` and both trends are 0-1 fractions, and the trends are relative to the start of the window.
   Find your own row through `isYourDomain` (`yourDomain` names it) and read the domains above it.

7. **Raw queries, only when the fixed tools cannot answer.** Call `query_gmc_report` with `siteUrl`, `query` and `limit` (default 200, max 1000; `hasMore` says when the query matched more, and at most five pages are read). The query is Merchant Center Query Language, `SELECT <fields> FROM <view> [WHERE ...] [ORDER BY ...] [LIMIT n]`, with snake_case fields and single-quoted string and date literals, for example `SELECT offer_id, title, clicks, impressions FROM product_performance_view WHERE date BETWEEN '2026-09-01' AND '2026-09-30' AND marketing_method = 'ORGANIC' ORDER BY clicks DESC`. It is read-only and always runs against the linked account. Rules that apply to every query:
   - The performance and competitive visibility views need a date condition in WHERE; `product_view` and the price views are dateless.
   - Rows come back raw, exactly as Merchant Center sends them: camelCase fields, int64 as strings, money as `amountMicros` (divide by 1,000,000), rates as 0-1 fractions. Convert every one of them before presenting and say so.
   - Use it for a filter the fixed tools lack (one offer id, one product attribute), never as the first call.

8. **Interpretation rules.** Judge by clicks and impressions at stake, not by percentage alone: a 10% CTR drop on the top offer outranks a 50% drop on a one-click offer. Present every multi-row result as a compact markdown table (top rows only, typically 5 to 10); keep prose for interpretation, not for restating numbers. Do not fabricate rows the tools did not return; if a tool returns nothing, say so and quote its `emptyNote` when there is one. `reportUnavailable` (`reason: "report_forbidden"`, with a `message`) and no rows on steps 4 to 7 means Google refuses that report family for this account on eligibility grounds; the other Merchant Center reports are unaffected, so report the gap in that section and continue.

## Output

Present the findings in this order:

1. **Listing totals and trend.** Clicks, impressions and CTR for the window from `get_organic_shopping_performance`, beside clicks, impressions, CTR and position from `get_merchant_listings_performance`, with the derived period-over-period deltas when a prior window was pulled, and each timeline read as a trend (rising, flat, falling, or a step at a known date). Say once that the two layers never reconcile.

2. **Top and underperforming offers.** Two tables from `get_organic_shopping_performance`: the top offers by clicks, and the offers with the most impressions for the fewest clicks (plus zero-conversion offers where conversions exist); the brand or category mix when it was asked for.

| Offer | Title | Clicks | Impressions | CTR | Conversions |
|---|---|---|---|---|---|

3. **Price position.** The `summary` counts, then a table of the products priced above market from `get_gmc_pricing_insights`: offer, your price, benchmark price, gap as a percentage (converted from `priceGapFraction`, say so), suggested price and predicted clicks change.

4. **Best-seller gaps.** A table of `demandGap: true` clusters from `get_gmc_best_sellers` with rank, rank change, relative demand and brand, then the ranked clusters you do carry that moved most.

5. **Competitor visibility.** The `domains[]` roll-up from `get_gmc_competitors`: your domain first, then the domains above it with relative visibility (as a ratio), page overlap and higher-position rate (as percentages, converted from fractions).

6. **Recommendations.** End with a short prioritized list of 3 to 7 concrete recommendations: which above-market prices to test against the suggested price, which high-impression offers need title, image or price work, which missing clusters are worth stocking, which competitor overlap to watch. When the question drifts to disapprovals, feed uploads or account issues, run the merchant-center-health skill; for feed attribute quality and titles, run the feed-audit skill.

## Error handling

If any tool call fails with an authentication or subscription error, tell the user to run `/mcp` to (re)authenticate, and that a GSC Wizard account with an active plan or trial plus a connected Google Search Console account is required. If the property is not found, re-run `list_sites` and offer the closest matches instead of guessing a URL format. If a single tool fails for another reason, report the gap in the relevant section and complete the rest of the workflow with the remaining data.

Merchant Center is an optional connection, so steps 3 to 7 answer `notConfigured: true` with a `reason` rather than erroring:
- `no_scope`: Merchant Center is not connected in the GSC Wizard app yet.
- `credentials_revoked`: the consent exists but Google rejects the saved connection; reconnect the Google account on the Account page.
- `no_account`: no Merchant Center account is linked to this site; link one in the app.

A merchant that refuses every connected Google account fails with `forbidden` and fixed wording that says access to it was lost and how to restore it; relay it. In every one of these cases step 2 still works from Search Console, so deliver the listing totals and say the Merchant Center sections are unavailable.

## Grounding

Every number you report must name the tool it came from and the date range it covers, for example "clicks 12,340 (`get_site_summary`, 2026-09-21 to 2026-09-27)". For a table, state the tool and date range once on the line above it. If you derive a figure yourself (a delta, a sum, a share), say so and name the tool outputs it was computed from. Never report a number no tool returned.
