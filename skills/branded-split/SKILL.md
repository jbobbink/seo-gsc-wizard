---
name: branded-split
description: Split a Search Console property's performance into branded and non-branded search with the GSC Wizard MCP tools: totals, branded click share, the daily trend and the top queries per side from get_branded_performance, the brand filter status from get_filter_options, brand variants missing from the saved list spotted with query_top_queries, and the saved branded keywords created or extended with update_site after confirmation, anchored on get_site_summary. Use when the user asks "how much of my traffic is branded", "brand vs non-brand", "is my growth just brand demand or real SEO", "set up or fix my branded keywords", or wants the non-branded trend for a client report.
---

# Branded versus Non-branded Split

Measure how much of one property's search traffic is brand demand and how much is non-branded SEO, how each side is trending, and what share of the period's growth each side explains. The user's request may contain a property (a GSC site URL or a recognizable name), a date range, the brand name or a list of brand terms to save, or a focus such as "non-branded only for the client report".

## Workflow

1. **Resolve the property.** If the user's request or the conversation names a property, use it. Site URLs use GSC formats: `sc-domain:example.com` or `https://www.example.com/`. Otherwise call `list_sites` and pick the obvious match. If several plausible properties exist, ask the user which one before continuing.

2. **Anchor and windows.** Call `get_site_summary` with `days: 28`, or with `startDate`/`endDate` when the user gave dates. Use the last 28 days compared with the previous period unless the user specifies dates.
   - Read `current`, `previous` and `deltas`, and keep `range.startDate`/`range.endDate` and `comparison.startDate`/`comparison.endDate`: the split tool only compares periods when both comparison dates are passed, so these four dates are what keep its comparison aligned with the anchor.
   - GSC data lags about 2 to 3 days: never treat the most recent 2 days as complete, and if a dip appears at the very edge of the range, say it is likely reporting lag, not a real drop.

3. **Is a brand filter defined?** Call `get_filter_options` with `siteUrl`. This call reads configuration only and fetches no Search Console data.
   - Read `brand.configured`, `brand.keywordCount` and `brand.skippedKeywords` (saved keywords the filter could not compile).
   - When `brand.configured` is false, or the response carries `emptyBecause`, no branded keywords are saved: go to step 5 to propose a list before running the split, and say the split cannot run until it is saved.

4. **The split.** Call `get_branded_performance` with `siteUrl`, `startDate`/`endDate` set to the current window, `comparisonStartDate`/`comparisonEndDate` set to the comparison window (both are required for a comparison; omitting them gives no baseline), and `limit: 25`.
   - If it answers `notConfigured: true`, read `reason`: `no_branded_keywords` means none are saved (step 5), and `no_usable_keywords` means none of the saved ones compile; `savedKeywords` lists the stored keywords verbatim and `hint` says what to fix.
   - Otherwise read `branded`, `nonBranded` and `total` (each `clicks`, `impressions`, `ctr` on 0-100, `position`), `brandedClickShare` (0-100), `anonymized` (the part of `nonBranded` with no query row), `daily[]` (`date`, `brandedClicks`, `nonBrandedClicks`, `brandedShare`, oldest first), `topBrandedQueries` and `topNonBrandedQueries` (`query`, `clicks`, `impressions`, `ctr`, `position`), `previous` (`branded`, `nonBranded`, `total`, `brandedClickShare` for the comparison window), `brandedKeywords` (`total`, `used`, `skipped`) and `savedKeywords`.
   - Two caveats the tool states: `nonBranded` is the property total minus `branded`, so the two sides always add up to `total`; and Search Console leaves anonymised queries out of any query-filtered read, so those rare queries land in `nonBranded`, `brandedClickShare` is a floor, and `coverage.hiddenClicksShare` (0-1) is the share of clicks no query row carries. `emptyBecause` means the window holds no traffic at all, not that nothing is branded.

5. **Brand variants missing from the saved list.** Scan `topNonBrandedQueries` for the brand name misspelled, split or concatenated, the domain name, product or model names only this brand uses, and "brand + login/pricing/reviews" phrasings; each is a variant the saved list misses.
   - Then call `query_top_queries` with `brand: "non_branded"` and `limit: 500` (the `brand` scope needs saved keywords and a paid plan; without either, call it unscoped with `limit: 500`) and scan again. Page with `offset` set to `pagination.nextOffset` only if the first page is dominated by brand terms.
   - When no keywords are saved yet, propose a starter list from this scan: the brand name, its common misspellings, the domain without its extension, and product names unique to the brand.
   - Keep generic words out of the list. A keyword is a case-insensitive substring, so "pro" or "shop" would swallow non-branded queries; a term wrapped in slashes like `/acme ?corp/` is a regex (RE2 syntax, no lookahead or backreferences, `\b` supported), so `/\bpro\b/` matches the word on its own.

6. **Save or extend the keywords (write step).** `update_site` with `brandedKeywords` replaces the stored list wholesale, so the list to send is `savedKeywords` from step 4 plus the additions, never the additions alone.
   - ALWAYS list the exact keywords and ask the user to confirm before calling. Explain that the call changes the property's saved branded keywords in GSC Wizard (the web app's reports and this split read the same list) and changes nothing in Search Console.
   - Then call `update_site` with `siteUrl` and `brandedKeywords` (strings of at least 1 character, at most 500 entries); the response echoes `site.brandedKeywords`. A keyword the filter could never use makes the call fail with nothing saved and the message names it; fix it and resend.
   - This step needs write access, and on a property shared with the user it needs full access. If it is refused because the connection is read-only, say that this step needs write access and continue with the read-only parts. After a successful save, re-run step 4 so the split reflects the new list.

7. **Trend and growth attribution.** From `daily[]`, compare `brandedShare` over the first 7 days with the last 7 days, and name any day where either side moved sharply (deploys, campaigns and PR spikes show up as branded jumps).
   - Derive, and say you derived, from `get_branded_performance`: the branded delta (`branded.clicks` minus `previous.branded.clicks`), the non-branded delta (`nonBranded.clicks` minus `previous.nonBranded.clicks`), the total delta, and each side's share of the total delta when the total moved in one direction. When the two sides moved in opposite directions, report both deltas and say the split cannot be expressed as a share.
   - Growth carried mostly by brand is demand (campaigns, PR, seasonality), not SEO; growth carried by non-brand is SEO; a non-branded delta near zero while branded grows means the organic programme is not yet contributing.
   - Cross-check the sum of the two sides against `deltas.clicks` from `get_site_summary` and say so if the two disagree by more than rounding (the summary's window or scope then differs).

## Interpretation rules

- `ctr` values are already percentages on a 0-100 scale, and so are `brandedClickShare` and the daily `brandedShare`. Never multiply them by 100. `coverage.hiddenClicksShare` is a 0-1 fraction, so multiply that one by 100 to present it.
- `position`: lower is better. A change toward a lower number is an improvement; never color it as a decline.
- Judge by clicks and impressions at stake, not by percentage alone: a brand variant with 3 clicks is not worth a keyword entry unless it is a misspelling the list should cover anyway.
- Present every multi-row result as a compact markdown table (top rows only, typically 5 to 10); keep prose for interpretation, not for restating numbers.
- Do not fabricate rows the tools did not return. If a side has no top queries in the window, say so.

## Output

Present, in this order:

1. **Anchor**: one sentence with the window, the comparison window and the property's clicks, impressions, CTR and position with deltas (`get_site_summary`).
2. **Split table** (`get_branded_performance`), followed by the branded click share now versus the prior window and the keyword count (`used` of `total`, with `skipped` named):

   | Side | Clicks | Prior clicks | Delta | Impressions | CTR | Position |
   |---|---|---|---|---|---|---|
   | Branded / Non-branded / of which anonymised / Total | | | | | | |

3. **Trend**: branded share in the first and last week of the window, and any sharp day, from `daily[]`.
4. **Top queries per side**: two tables (query, clicks, impressions, CTR, position) from `topBrandedQueries` and `topNonBrandedQueries`, with the suspected brand variants in the non-branded table flagged.
5. **Growth attribution**: the derived deltas and shares from step 7, with the sentence that says whether the period's growth is brand demand or SEO.
6. End with a short prioritized list of 3 to 7 concrete recommendations: the keywords to add (or the starter list to save), the non-branded queries and pages to grow when SEO is not yet contributing, branded queries with a weak CTR or position to protect (a competitor or a marketplace listing above the brand's own page), and whether the client report should carry the non-branded series alone.

## Error handling

If any tool call fails with an authentication or subscription error, tell the user to run `/mcp` to (re)authenticate, and that a GSC Wizard account with an active plan or trial plus a connected Google Search Console account is required. If the property is not found, re-run `list_sites` and offer the closest matches instead of guessing a URL format. If a single tool fails for another reason, report the gap in the relevant section and complete the rest of the workflow with the remaining data.

## Grounding

Every number you report must name the tool it came from and the date range it covers, for example "clicks 12,340 (`get_site_summary`, 2026-09-21 to 2026-09-27)". For a table, state the tool and date range once on the line above it. If you derive a figure yourself (a delta, a sum, a share), say so and name the tool outputs it was computed from. Never report a number no tool returned.
