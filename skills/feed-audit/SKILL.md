---
name: feed-audit
description: Audit the Merchant Center product feed and product titles behind one Search Console property using the GSC Wizard MCP feed tools: the latest Feed Score (0-100, split into a feed plane and a page plane) with its failing checks, a fresh audit queued on request after confirmation, title and description hygiene over a catalog sample (lengths, duplicates, repeated words, missing descriptions), and the failing checks connected to the products ineligible in free listings. Use when the user asks "audit my product feed", "what is my feed score", "why is my feed failing", "check my product titles", "are my titles too long or duplicated", or wants feed quality recommendations.
---

# Feed Audit

Audit the Merchant Center feed behind one property: the Feed Score with its failing checks, the title and description hygiene of the catalog, and the products those failures keep out of free listings, ending with rewrite patterns and a fix list. `$ARGUMENTS` may contain a property, a run date (`YYYY-MM-DD`), a check key such as `title_length`, a sample size for the title scan, or "fresh" or "re-run" to ask for a new audit; honor it.

## Workflow

1. **Resolve the property.** If `$ARGUMENTS` or the conversation names a property, use it. Site URLs use GSC formats: `sc-domain:example.com` or `https://www.example.com/`. Otherwise call `list_sites` and pick the obvious match. If several plausible properties exist, ask the user which one before continuing.

2. **Read the latest audit before queueing anything.** Call `get_feed_audit_results` with `siteUrl`, optionally `runDate` for one dated run (`limit` defaults to 100, max 500, but the checks list never exceeds 21 rows). Read `run` first: `run: null` means no audit has run yet, so go to step 3. Otherwise read, from `run`:
   - `status` (`pending`, `crawling`, `scoring`, `completed` or `failed`, with `error` on a failure), `runDate` and `completedAt`.
   - `score` (0-100) split into `scoreFeed` and `scorePage`, `pageScored`, and `coverage`, a 0-1 fraction of the product pages the crawl reached (`pagesTotal`, `pagesFetched`, `pagesFailed`), with `offersTotal` and `offersAudited` for the catalog side.
   - `bySeverity` (`critical`, `warning`, `info`): counts of failed offer-and-check pairs, the only severity data in the response, since the `checks[]` rows carry none.
   - `crawlBlocked: true` means the page crawl stopped because the site refused GSCWizard-Bot (401/403 or robots.txt), so `scorePage` covers few or no pages; say so instead of reading the page plane as healthy.
   Then read the `checks[]` rows (`checkKey`, `applicable`, `failed`, `passed`, `failRate`, `passRate`; all rates are 0-1 fractions, not the 0-100 `ctr` scale) and `history[]` (`createdAt`, `score` per earlier run) for the trend. The per-offer issue rows behind a `checkKey` or `severity` filter live in a warehouse this server cannot read: such a call answers `issuesAvailable: false` with an `issuesHint` that points at the Feed Audit report in the app, so name that report for the offer-level list instead of calling again. Two freshness flags can ride along: `syncPaused` (`reason: "merchant_access_lost"`, with a one-line `staleNote`) means the daily sync is paused because Merchant Center no longer lets the property's Google account read the merchant, the stored run is still returned but may be stale, and the `message` says how to fix it; `syncNotice` (`reason: "gmc_on_other_account"`) means Merchant Center is connected on another Google login than the property's Search Console one, the only account the sync reads through, so the stored data cannot refresh.

3. **Queue a fresh audit only when it is warranted, and confirm first.** The app runs the audit on a 28-day cadence, so a `completed` run inside the last 28 days is current: present it and do not queue. Queue when `run` is null, the newest run is older than 28 days, the user explicitly asks for a fresh run, or they say fixes have shipped. `run_feed_audit` is a write tool, so follow this order:
   - Before calling it, say what it does (it queues 21 deterministic checks over the synced catalog plus a crawl of the product pages on the owner-approved hosts, scored 0-100; the crawl spends the site's crawl budget, a large catalog can take hours, and each user may start at most 3 runs per UTC day) and ask the user to confirm.
   - Call `run_feed_audit` with `siteUrl`, adding `force: true` only when the user wants to override the 28-day cadence; it never bypasses the one-run-per-property-per-day rule or a run in progress.
   - Read `enqueued` and `runDate`, the job handle. `enqueued: false` carries a `skipReason`: `run_in_progress` (its summary is in `run`), `run_exists_today`, `recent_run` (inside the cadence; offer `force: true` and ask again) or `already_queued`. A call that queues nothing does not count against the daily three.
   - If the call is refused because the connection uses a read-only API key, say this step needs a read & write key and continue with the read-only parts.
   - The tool returns the handle, never results, so do not poll in a loop: tell the user the run is queued, that it can take hours for a large catalog, and that `get_feed_audit_results` with that `runDate` shows `run.status` moving through `pending`, `crawling` and `scoring` to `completed`; if the user chooses to wait, check once after a pause rather than repeatedly.
   A sync paused for lost Merchant Center access is refused as `bad_request` with the pause wording, and Merchant Center connected on another Google login answers `notConfigured` with reason `gmc_on_other_account`, because the audit runs through the sync.

4. **Title and description hygiene.** Call `get_gmc_title_hygiene` with `siteUrl` (`limit` default 2000, max 5000 offers sampled in feed order; `topWords` default 50, max 100). It is a catalog snapshot with no date range (`snapshotDate`), computed over the first `limit` offers of the live products list, one row per offer id, so an offer listed in several feeds is never a duplicate of itself. `sampled` and `offerCount` size the sample; `truncated: true` means the catalog had more and the summary describes a sample (the `note` says which), and the Title Hygiene report in the app reads every offer when full-catalog counts are needed. Read:
   - `titleLengthHistogram` and `descriptionLengthHistogram` (`label`, `min`, `max`, `count` per bucket; lengths in characters, CJK titles included per `cjkNote`), `avgTitleLength`, `medianTitleLength` and `descriptionMissing`.
   - `duplicateTitleGroups[]` (`key`, `count`, `exampleOfferIds`, capped when `duplicateTitleGroupsCapped` is true) and `repeatedWordOffers` (`count` plus `examples` with `offerId`, `title`, `word`).
   - `topWords[]` (`word`, `titles`, `share`, `isBrand`, `brandTitles`); `share` is a 0-1 fraction of the sampled offers, not a percentage, so convert and say so.
   The feed-versus-page title diff lives only in the app report.

5. **Connect failing checks with ineligible products.** Call `get_product_listing_status` with `siteUrl`, `onlyProblems: true` (the default) and `limit` (default 25, max 200; pass `nextOffset` back as `offset` only when the user wants the whole list). Read `problemCount` and `merchantActionCount` (whole-catalog counts, not page counts), `issueCounts[]` (`code`, `resolution`, `count`) and the rows sorted by `clickPotentialRank` (1 is the product Google expects the most clicks from) with `offerId`, `title`, `aggregatedStatus`, `freeListingsStatus`, `topIssueCode`, `topIssueSeverity` and `topIssueResolution`, where `MERCHANT_ACTION` needs a feed or site fix and `PENDING_PROCESSING` clears on its own. Then:
   - Match the failing `checkKey` rows from step 2 with the issue codes by meaning (a title or description check beside a title-related issue code, a price check beside a price mismatch, a schema check beside a page-data issue), and say plainly when a failing check has no matching disapproval, because audit checks are stricter than eligibility.
   - Read `dataSource` (`"clickhouse"`, the daily snapshot, with `syncedAt` and `stale`, or `"merchant-api"`, a live scan of up to 5,000 products, with `truncated` and `truncationReason`), and treat `itemIssuesUnavailable: true` as "issue codes unknown", not clean. The same `syncPaused` and `syncNotice` flags as in step 2 apply here.

6. **Interpretation rules.** Rank failures by the `bySeverity` weight first and the affected count second, then by the click potential of the products behind them. Present every multi-row result as a compact markdown table (top rows only, typically 5 to 10); keep prose for interpretation, not for restating numbers. Do not fabricate rows the tools did not return: when `issuesAvailable` is false, say the offer-level rows are in the app and never invent examples. The only offer examples you may show are `exampleOfferIds` and `examples` from step 4 and the rows from step 5.

## Output

Present the findings in this order:

1. **Feed Score.** `run.score` with `run.scoreFeed` and `run.scorePage`, the run date and status, the crawl coverage as a percentage (converted from the fraction, say so) with the `crawlBlocked` caveat when set, the `bySeverity` totals, and the score trend from `history`. If a fresh run was queued, say so with its `runDate` and that the results follow later.

2. **Failing checks.** From `get_feed_audit_results`, worst fail rate first, with the severity totals on the line above the table:

| Check (`checkKey`) | Applicable | Failed | Fail rate | Matching listing issue / examples |
|---|---|---|---|---|

   Examples come only from step 4 or step 5 rows that match the check; otherwise write "see the Feed Audit report in the app".

3. **Title problems with rewrite patterns.** The length distribution and median, the duplicate groups and the repeated-word offers from `get_gmc_title_hygiene`, each with a pattern: lead with the attributes that disambiguate duplicates (brand, model, size, color) in the order shoppers search; trim titles that run past the bucket most of the catalog sits in; drop a word repeated inside one title; write the missing descriptions; and keep the brand token where `isBrand` words dominate only if the brand is what shoppers type.

4. **Ineligible products behind the failures.** From `get_product_listing_status`: the whole-catalog counts and the top rows by `clickPotentialRank` with status, top issue and resolution, next to the check each one matches.

5. **Recommendations.** End with a short prioritized list of 3 to 7 concrete recommendations ordered by severity and clicks at stake, each naming the check or issue code, the number of offers it affects and the fix; say whether a re-run (`run_feed_audit`, confirmed first, with `force: true` if inside the cadence) is worth it once the fixes ship. When the question drifts to account suspensions or feed uploads, run the merchant-center-health skill; for how the offers perform in free listings, run the shopping-performance skill.

## Error handling

If any tool call fails with an authentication or subscription error, tell the user to run `/mcp` to (re)authenticate, and that a GSC Wizard account with an active plan or trial plus a connected Google Search Console account is required. If the property is not found, re-run `list_sites` and offer the closest matches instead of guessing a URL format. If a single tool fails for another reason, report the gap in the relevant section and complete the rest of the workflow with the remaining data.

Merchant Center is an optional connection, so these tools answer `notConfigured: true` with a `reason` rather than erroring:
- `no_scope`: Merchant Center is not connected in the GSC Wizard app yet.
- `credentials_revoked`: the consent exists but Google rejects the stored credentials; reconnect the Google account on the Account page.
- `no_account`: no Merchant Center account is linked to this site; link one in the app.
- `gmc_on_other_account`: the scope sits on another Google login than the property's Search Console one, so the sync and the audit cannot run through it.

A merchant that refuses every connected Google account fails with `forbidden` and fixed wording that says access to it was lost and how to restore it; relay it and stop the Merchant Center steps.

## Grounding

Every number you report must name the tool it came from and the date range it covers, for example "clicks 12,340 (`get_site_summary`, 2026-09-21 to 2026-09-27)". For a table, state the tool and date range once on the line above it. If you derive a figure yourself (a delta, a sum, a share), say so and name the tool outputs it was computed from. Never report a number no tool returned.
