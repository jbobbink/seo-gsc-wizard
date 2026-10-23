---
name: merchant-center-health
description: Check whether the Merchant Center account linked to a Search Console property is healthy and whether its products are eligible for free listings, using the GSC Wizard MCP Merchant Center tools: readable accounts and links, account issues by severity, feed data sources with their latest uploads, and the products invisible in free listings with the reason, ending in a verdict and recommendations. Use when the user asks "is my Merchant Center account ok", "why are my products disapproved", "are my products showing in free listings", "is my feed uploading", "Merchant Center health check", or mentions a suspension, a policy issue or a feed that stopped.
---

# Merchant Center Health

Check the health of the Merchant Center account linked to one Search Console property and find the products that are not serving in free listings, ending with a verdict and a fix list. The user's request may contain a property, a Merchant Center account name or id, a language code for the issue text, or a focus hint (for example "only the feed" or "disapproved products"); honor the hint by going deeper there, but still run every step.

## Workflow

1. **Resolve the property.** If the user's request or the conversation names a property, use it. Site URLs use GSC formats: `sc-domain:example.com` or `https://www.example.com/`. Otherwise call `list_sites` and pick the obvious match. If several plausible properties exist, ask the user which one before continuing.

2. **Find the linked account.** Call `list_gmc_accounts` with the property's `siteUrl` (the argument is optional, but passing it adds `linkedAccountId`, the account this property is linked to). The `accounts[]` rows carry `accountId`, `accountName`, `accountEmail`, `isAdvanced` and `linkedSiteUrls`. Interpret the response before anything else:
   - `connected: false` with `reason: "no_scope"` means the Merchant Center consent has not been granted in the GSC Wizard app; `reason: "credentials_revoked"` means it was granted but Google now rejects the saved connection, so the Google account has to be reconnected on the Account page. Relay the `hint` and stop the Merchant Center steps, since nothing below can answer.
   - Accounts listed but no `linkedAccountId` means the property is not linked yet. Linking happens in the GSC Wizard app, not through a tool: show the account table and tell the user which account to link. For a grantee without the Merchant Center opt-in the id is withheld with a note; say so.
   - `isAdvanced: true` marks a multi-client parent that cannot be reported on; one of its sub-accounts has to be linked instead.
   - `incomplete: true` means the list is a floor: read `gaps`, `unprobedAccountIds` and `errors`, say what could not be read, and suggest a retry.

3. **Account health.** Call `get_gmc_account_health` with `siteUrl`, optionally `languageCode` (BCP-47, for example `"nl"`, default en-US) for the issue text and `limit` (default 200, max 500, most severe first). Read `overallStatus` first: it is the worst of the checks and the issues. Then read:
   - `issues[]` (`title`, `detail`, `severity`, `affectsFreeListings`, `impactedDestinations` with the `reportingContext` and the regions each one hits, `documentationUri`) and the `issueCounts` totals.
   - `checks[]` (`key`, `status`, `message`), where status is one of `ok`, `suggestion`, `warning`, `critical` or `unknown`. A setting this Google login may not read answers `unknown` and `sections` says why: report it as unverified, never as passed.
   - `programs[]` for the free-listings program `state`, its `activeRegionCodes` and any `unmetRequirements`; `homepage.claimed` for whether the website is claimed; `countriesWithoutShippingService` against `targetCountries` for the markets without an account-level shipping service.
   Business info is reported as presence flags only (`businessInfo`), and shipping and returns set per product in the feed are not read, so those two checks can flag what the feed already covers.

4. **Feed data sources.** Call `get_gmc_data_sources` with `siteUrl` (`includeUploads` defaults to true and probes the latest upload of up to 25 file sources, primary first; set it to false to list the sources only). Read:
   - `findings[]` (`displayName`, `severity`, `message`) first: failed uploads, files processed with errors, fetches that stopped running and primary sources with free listings switched off, with `failedUploadCount` and `staleFetchCount` as the totals.
   - `rows[]`: `type`, `input`, `feedLabel`, `contentLanguage`, `countries`, `destinations` with their `state`, `uploadStatus` (`not_file_input` for API, UI and autofeed sources, which have no uploads), `latestUpload` with `processingState`, `uploadTime`, `itemsTotal`, `itemsCreated`, `itemsUpdated` and `issues`, `latestUploadAgeDays`, and `staleFetch`, which compares the newest processed file with the fetch schedule (2, 9 or 35 days for daily, weekly or monthly).
   Fetch URLs are reduced to scheme and host on purpose. A stale or failed primary source explains a catalog-wide drop before any product-level issue does.

5. **Invisible products.** Call `get_product_listing_status` with `siteUrl`, `onlyProblems: true` (the default) and `limit` (default 25, max 200). Rows come sorted by click potential, `clickPotentialRank` 1 being the product Google expects the most clicks from, so a disapproved product with a low rank number is the most expensive problem. Read `problemCount` and `merchantActionCount` for the whole-catalog counts (they are not page counts), `statusCounts` and `issueCounts[]` (`code`, `resolution`, `count`) for the mix, and per row `offerId`, `title`, `aggregatedStatus`, `freeListingsStatus`, `topIssueCode`, `topIssueSeverity` and `topIssueResolution`, where `MERCHANT_ACTION` needs a feed or site fix and `PENDING_PROCESSING` clears on its own. When `hasMore` is true, pass `nextOffset` back as `offset` only if the user wants the whole list; the counts already cover it. Read the freshness and provenance flags every time:
   - `dataSource: "clickhouse"` is the daily catalog snapshot, `syncedAt` says when and `stale: true` means it is more than two days old. `dataSource: "merchant-api"` is a live scan of up to 5,000 products, and `truncated` with `truncationReason` says when the catalog had more or the read ran out of time.
   - `itemIssuesUnavailable: true` means Google refused the issue data, so a missing issue code is unknown, not clean.
   - `syncPaused` (`reason: "merchant_access_lost"`, with a one-line `staleNote`) means the daily sync is paused because Merchant Center no longer lets the property's Google account read the merchant; the stored data is still returned but may be stale, and the `message` says how to fix it.
   - `syncNotice` (`reason: "gmc_on_other_account"`) means Merchant Center is connected on another Google login than the property's Search Console one, the only account the sync reads through, so the stored snapshot cannot refresh; with nothing stored and no live read possible the tool answers `notConfigured` with that reason instead.

6. **Interpretation rules.** Judge severity by the clicks at stake: a `critical` account issue that affects free listings or a failed primary feed outranks any number of `suggestion` rows, and a disapproved product near the top of the click-potential ranking outranks a dozen low-potential ones. Present every multi-row result as a compact markdown table (top rows only, typically 5 to 10); keep prose for interpretation, not for restating numbers. Do not fabricate rows the tools did not return; if a tool returns nothing, say so and quote its `emptyNote` when there is one.

## Output

Present the findings in this order:

1. **Account verdict.** One short paragraph plus `overallStatus` from `get_gmc_account_health`, naming the linked account (`linkedAccountId` and its `accountName` from `list_gmc_accounts`) and the data freshness of the catalog snapshot (`syncedAt`, `stale`, `syncPaused`, `syncNotice`).

2. **Issues by severity.** From `get_gmc_account_health`, most severe first, followed by the eligibility checks that are not `ok`, with every `unknown` one marked as unverified:

| Severity | Issue | Affects free listings | Destinations / regions | Fix (documentationUri) |
|---|---|---|---|---|

3. **Feed status.** From `get_gmc_data_sources`: one row per source with type, input, latest upload or fetch time, processing state, items and age, then the `findings` in prose.

4. **Invisible products.** From `get_product_listing_status`: the whole-catalog `problemCount` and `merchantActionCount`, the `issueCounts` mix, and the top rows by click potential:

| Rank | Offer | Title | Status | Top issue | Resolution |
|---|---|---|---|---|---|

5. **Recommendations.** End with a short prioritized list of 3 to 7 concrete recommendations, ordered by clicks at stake: resolve the account issue or claim the website, fix or re-upload the failing primary feed, correct the top `MERCHANT_ACTION` issue codes on the highest-potential products, and wait out the `PENDING_PROCESSING` ones. When the question drifts to feed attribute quality or product titles, point the user to the Feed Audit and Title Hygiene reports in the app; for how the visible products perform, run the shopping-performance skill.

## Error handling

If any tool call fails with an authentication or subscription error, tell the user to run `/mcp` to (re)authenticate, and that a GSC Wizard account with an active plan or trial plus a connected Google Search Console account is required. If the property is not found, re-run `list_sites` and offer the closest matches instead of guessing a URL format. If a single tool fails for another reason, report the gap in the relevant section and complete the rest of the workflow with the remaining data.

Merchant Center is an optional connection, so every tool in this workflow answers `notConfigured: true` with a `reason` rather than erroring, and the reason decides what to tell the user:
- `no_scope`: Merchant Center is not connected in the GSC Wizard app yet.
- `credentials_revoked`: the consent exists but Google rejects the saved connection; reconnect the Google account on the Account page.
- `no_account`: no Merchant Center account is linked to this site; show the `list_gmc_accounts` table and say which one to link in the app.
- `gmc_on_other_account`: the scope sits on another Google login than the property's Search Console one, so the warehouse cannot fill and nothing is stored yet.

A merchant that refuses every connected Google account fails with `forbidden` and fixed wording that says access to it was lost and how to restore it; relay that wording as the verdict and stop the Merchant Center steps.

## Grounding

Every number you report must name the tool it came from and the date range it covers, for example "clicks 12,340 (`get_site_summary`, 2026-09-21 to 2026-09-27)". For a table, state the tool and date range once on the line above it. If you derive a figure yourself (a delta, a sum, a share), say so and name the tool outputs it was computed from. Never report a number no tool returned.
