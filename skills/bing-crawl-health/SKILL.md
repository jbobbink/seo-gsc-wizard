---
name: bing-crawl-health
description: Check Bing crawl, index and link health for a Search Console property with the GSC Wizard MCP server's Bing Webmaster tools: daily pages crawled and indexed with the response-code breakdown, crawl issues grouped by type (4xx, 5xx, redirects, robots blocks, DNS and timeout errors, malware) with fixes, sitemap and feed status, the most-linked URLs and whether they are healthy, the URL submission quota, and an optional confirmed IndexNow resubmission of fixed pages. Use when the user asks "is Bing crawling my site", "Bing crawl errors", "Bing index count", "Bing sitemap status", "backlinks in Bing", "resubmit to Bing", or "IndexNow".
---

# Bing Crawl Health

Diagnose how Bing crawls, indexes and links a property, and produce an issue summary grouped by type with concrete fixes, the feed status, the most-linked URLs and recommendations. This is the Bing counterpart of the indexing-health skill; for Google's index run that one. `$ARGUMENTS` may contain a property name or URL, a date range for the crawl trend, a focus hint (a path or section), or a list of fixed URLs to resubmit; use it to skip resolution or narrow the suspect set.

## Workflow

1. **Resolve the property.** If `$ARGUMENTS` or the conversation names a property, use it. Site URLs use GSC formats: `sc-domain:example.com` or `https://www.example.com/`. Otherwise call `list_sites` and pick the obvious match. If several plausible properties exist, ask the user which one before continuing. Every property-scoped Bing tool takes that same GSC `siteUrl` and maps it to Bing's form itself (`sc-domain:example.com` becomes `https://example.com/`), echoing the result as `bingSiteUrl`.

2. **Confirm the Bing side.** Call `list_bing_sites` (no arguments). A `notConfigured: true` answer means Bing Webmaster Tools is not connected for the property's Google account in the GSC Wizard app; tell the user to add it there, point them at the indexing-health skill for the Google side, and stop. Otherwise find the property in `siteDetails` and read `isVerified`: Bing serves data only for a verified site, an unverified one makes the property-scoped tools answer with a not-verified error that names the fix (a subfolder property has to be verified as its own site in Bing Webmaster Tools), and a property missing from `sites` has to be added there first.

3. **Crawl trend.** Call `get_bing_crawl_stats` with `startDate` and `endDate` for the last 28 days unless the user set a range; omit both dates for everything Bing has, about 6 months of crawl data, when the user wants the long trend. `daily[]` rows (oldest first) carry `crawledPages`, `inIndex`, `inLinks`, `code2xx`, `code301`, `code302`, `code4xx`, `code5xx`, `blockedByRobotsTxt`, `allOtherCodes`, `crawlErrors` and `containsMalware`. A day Bing did not report is missing from the series, not a zero, so never read a gap as a crawl stop. Compare the first and last reported weeks: whether pages crawled and `inIndex` rise or fall, and the share of the crawl that hit a 4xx, a 5xx or a robots block (derived from the row sums; say so). An `inIndex` drop with a 5xx or robots rise on the same days is the pattern to flag first. Bing reports on its own calendar and carries no `settledThrough` or `partialDays`, so do not apply the Google reporting-lag rule here.

4. **Crawl issues.** Call `get_bing_crawl_issues`; the `limit` default of 200 is fine, and raise it when `rowCount` equals the limit. `issues[]` rows carry `url`, `httpCode`, `inLinks` and `issues`, a list of decoded labels: "301 redirect", "302 redirect", "HTTP 4xx", "HTTP 5xx", "Blocked by robots.txt", "Important URL blocked by robots.txt", "Contains malware", "DNS error" and "Timeout error". Rows come most inbound links first, so the top of the list is the most damaging. Group by label (a URL with several labels counts under each), count the URLs per group, keep the two or three examples with the most `inLinks`, and narrow to the user's focus path when one was given. An `emptyBecause` answer means Bing reports no issues; say so rather than leaving the section blank. Any "Contains malware" row is urgent and goes first.

5. **Feeds.** Call `get_bing_feeds`. `feeds[]` rows carry `url`, `status` (Pending, Success, Warning or Error), `type` (Sitemap, Sitemap index, Atom, RSS, Text or mRSS), `lastCrawled`, `submitted`, `urlCount`, `fileSize` and `compressed`; a date of 1601-01-01 is Bing's empty value, not a real date. Flag Error and Warning feeds, a `lastCrawled` well behind today, a `urlCount` of 0, and a property with no feeds at all (`emptyBecause`), which means Bing discovers pages only by crawling. For the Google sitemap view run the indexing-health skill rather than repeating it here.

6. **Most-linked URLs.** Call `get_bing_link_counts` with `page: 0` and `limit: 50`. Page 0 usually holds every linked URL, and `totalPages` is the number of linked URLs Bing reports, not a count of result pages, so do not page further; when `truncated` is true and the user wants the full list, raise `limit` instead. `links[]` rows carry `url` and `count`, most links first. Check each top URL against step 4 by exact URL: a most-linked URL that is also a 4xx, a redirect or a robots block wastes the links pointing at it and is the top fix, and a most-linked URL that redirects should have its links repointed at the final page.

7. **Submission quota.** Call `get_bing_url_submission_quota` for `dailyQuota` and `monthlyQuota` (null when Bing did not report one). Report both as Bing's remaining URL submission allowance for the property, which is separate from IndexNow and is not spent by anything in this workflow.

8. **Resubmit fixed URLs (optional, write).** Only when the user asks, or names URLs they have fixed. First call `get_indexnow_settings` and read `indexnowApiKeySet`, `keyFileVerified` and `keyFileUrl`: when `indexnowApiKeySet` is false, say the setup needs `update_indexnow_settings` with `generateKey: true` and the returned key file published at the site root, and ask before running that write. Then ALWAYS list the exact URLs (at most 100, all on the property; others are dropped and reported in `skippedOffProperty`) and ask the user to confirm before calling `submit_indexnow_urls` with `siteUrl` and `urls`. Read `outcome` and explain it:
   - `submitted`: IndexNow accepted the batch.
   - `pending_key_validation`: the usual 202, accepted with key validation pending; engines fetch the key file afterwards and discard the batch without notice if it is unreachable, so this is not delivered and not indexed.
   - `setup_incomplete`: nothing was sent, and `message` names the key file to publish.
   - `rejected`: IndexNow refused everything that was sent.
   Report `submitted`, `failed` and `message`. If the call is refused because the connection is read-only, say this step needs write access and continue with the read-only parts. `list_indexnow_submissions` shows the history afterwards; batches refused before sending are absent from it on purpose.

## Interpretation rules

- A day missing from `get_bing_crawl_stats` is unreported, not zero; a day with `crawledPages: 0` is a real zero.
- Weight every issue by `inLinks` and by the crawl volume behind it, not by the count of URLs alone: ten orphan 404s matter less than one 404 with fifty links.
- A URL carries every label that applies, so the per-type counts in the issue table can add up to more than the number of issue URLs; say so under the table.
- A feed date of 1601-01-01 means "never": a `lastCrawled` of 1601-01-01 is a feed Bing has not fetched.
- Present every multi-row result as a compact markdown table (top rows only, typically 5 to 10); keep prose for interpretation, not for restating numbers.
- Do not fabricate rows the tools did not return; if a tool returns nothing, say so and relay its `emptyBecause` and `nextStep` where present.

## Output

Present the findings in this order, with compact markdown tables (top rows only, typically 5 to 10) for multi-row data and prose only for interpretation:

1. **Crawl trend**: a sentence or two, plus a small table of the first and last reported weeks (pages crawled, `inIndex`, 4xx, 5xx, robots blocks) derived from the `daily` rows.
2. **Issues by type**:

| Issue type | URLs | Examples (most linked first) | Fix |
|---|---|---|---|

   Map each type to a concrete fix:
   - HTTP 4xx: restore the page or 301 it to the closest live page, then drop it from sitemaps and internal links.
   - HTTP 5xx, DNS error, Timeout error: a server or DNS problem, so check hosting, the CDN and any rate limiting of Bing's crawler.
   - 301 or 302 redirect: point internal links and sitemap entries at the final URL; turn a permanent 302 into a 301.
   - Blocked by robots.txt, Important URL blocked by robots.txt: confirm the block is intended and remove the rule if not.
   - Contains malware: urgent; clean the page and request a review in Bing Webmaster Tools.
3. **Feed status**:

| Feed URL | Type | Status | Last crawled | URLs | Fix |
|---|---|---|---|---|---|

4. **Most-linked URLs**: a table with URL, link count and health ("clean", or the issue label from step 4).
5. **Quota** in one line, and the **submission result** when step 8 ran.
6. End with a short prioritized list of 3 to 7 concrete recommendations, highest impact first: the most-linked broken URLs, the issue group with the most URLs, the feed to fix, and whether a resubmission is worth it once fixes ship.

For Bing traffic and rankings run the bing-performance skill; for Google's index run the indexing-health skill.

## Error handling

If any tool call fails with an authentication or subscription error, tell the user to run `/mcp` to (re)authenticate, and that a GSC Wizard account with an active plan or trial plus a connected Google Search Console account is required. If the property is not found, re-run `list_sites` and offer the closest matches instead of guessing a URL format. If a single tool fails for another reason, report the gap in the relevant section and complete the rest of the workflow with the remaining data. A Bing rate-limit error says to wait a moment and try again: do that once, and never loop.

## Grounding

Every number you report must name the tool it came from and the date range it covers, for example "clicks 12,340 (`get_site_summary`, 2026-09-21 to 2026-09-27)". For a table, state the tool and date range once on the line above it. If you derive a figure yourself (a delta, a sum, a share), say so and name the tool outputs it was computed from. Never report a number no tool returned.
