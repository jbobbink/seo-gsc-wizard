---
name: sitemap-audit
description: Audit sitemap health and coverage for a Search Console property with the GSC Wizard MCP tools: the submitted sitemaps with their errors, warnings and download dates (list_sitemaps), the join of one sitemap's URLs with Search Console metrics to find URLs that never show (get_sitemap_performance), stored inspection verdicts for those suspects without spending quota (list_url_inspections), the Bing side (get_bing_feeds), and, after confirmation, submitting or resubmitting published sitemaps (submit_sitemap). Use when the user asks "is my sitemap ok", "which sitemap URLs get no traffic", "sitemap errors", "resubmit my sitemap", "does Google read my sitemap", or about sitemap coverage.
---

# Sitemap Audit

Check the sitemaps a property has submitted, measure how much of one sitemap Google actually shows in search, group the URLs that never show by their likely cause, and, when the user wants it, submit or resubmit a published sitemap. `$ARGUMENTS` may contain a property, a sitemap URL, a section path, a date range, or "bing"; use it to skip resolution, pick the sitemap, or widen the engine side. For a diagnosis that spends inspection quota, hand over to the indexing-health skill.

## Workflow

1. **Resolve the property.** If `$ARGUMENTS` or the conversation names a property, use it. Site URLs use GSC formats: `sc-domain:example.com` or `https://www.example.com/`. Otherwise call `list_sites` and pick the obvious match. If several plausible properties exist, ask the user which one before continuing. Note the property's `gscScope` from `list_sites` ("full" or "readonly"): step 6 depends on it. For the Bing side, `list_bing_sites` shows which sites Bing has verified (`isVerified` in `siteDetails`) and answers `notConfigured: true` when Bing Webmaster Tools is not connected.

2. **Submitted sitemaps.** Call `list_sitemaps` with `siteUrl`. Read `sitemaps[]`, sorted by `path`: `lastSubmitted`, `lastDownloaded`, `isPending`, `isSitemapsIndex`, `type`, `warnings`, `errors`, and `contents[]` with `type` and `submitted` per content type.
   - Google has deprecated `contents[].indexed` and it typically reads 0, so never present it as an indexed count or as evidence that nothing is indexed.
   - Flag `errors` above 0 (Google could not parse part of the file) and `warnings` above 0 (usually URLs that redirect, 404 or are blocked).
   - Flag `isPending` long after `lastSubmitted` (Google has not fetched it yet) and a `lastDownloaded` older than the site's publishing cadence (a daily news sitemap downloaded two weeks ago is stale).
   - An empty list carries `emptyBecause` and `nextStep`; say Search Console lists no sitemap and offer step 6.

3. **Coverage of the main sitemap.** Pick the sitemap the user named, else the sitemap index or the one with the most submitted URLs. Call `get_sitemap_performance` with `siteUrl`, `sitemapUrl` (it must be on the property host or a subdomain), `maxUrls` (default 500, max 2000) and, unless the user gave dates, no `startDate` or `endDate` so the join covers the last 28 settled days. `searchType` defaults to web.
   - GSC data lags about 2 to 3 days: never treat the most recent 2 days as complete, and a URL published in the last few days with zero impressions is new, not broken.
   - Read `urlCount` (URLs extracted), `indexedInGscCount` (URLs with impressions above 0) and `range`; compute the share yourself and say so.
   - Read `urls[]`, sorted by clicks then impressions, highest first, each with `url`, `clicks`, `impressions`, `ctr` (a 0-100 percentage, never multiply it by 100) and `position` (lower is better); zeros mean the page had no Search Console data.
   - Read `truncated` with `scanLimit` and `truncationNote`: on the live API the join pages through the property's top pages by clicks and may not reach every sitemap URL, so a zero is then unknown rather than "no impressions" and `indexedInGscCount` is a lower bound. `dataSource` tells which path served the call; the warehouse reads the sitemap URLs directly, so its zeros are exact.
   - An index expands one level, up to 5 child sitemaps; `childSitemapNote` and `failedChildSitemaps` name children that could not be read, so their URLs are missing. `sitemapNote` means a body exceeded the read cap. `crawlNote` or an error about a blocked fetch means the server rejected the sitemap fetch; relay the whitelisting advice. If `urls` is empty, follow `nextStep`.
   - The suspects are the URLs with zero impressions over the range. For a very large sitemap, say the join was capped at `maxUrls` and audit child sitemaps one at a time.

4. **Group the suspects by likely cause without spending quota.** First sort the suspect URLs by pattern: parameter or tracking URLs, pagination, tag and archive pages, http or trailing-slash variants of a canonical URL, media files, and URLs outside the property host all point at sitemap hygiene rather than indexing problems. Then call `list_url_inspections` with `siteUrl`, `urlContains` set to a path segment the suspects share, `latestPerUrl: true` and `limit` up to 500, following `pagination.nextOffset` until the stored history is exhausted. Each row carries `url`, `verdict`, `coverage_state`, `robots_txt_state`, `indexing_state`, `page_fetch_state`, `last_crawl_time`, `google_canonical`, `user_canonical`, `inspection_result_link` and `requested_at`; all three canonical fields null means the row predates canonical storage. Map the suspects onto these groups, keeping the ones with no stored verdict in an "unknown, not yet inspected" group:

| Likely cause | Evidence | Fix |
|---|---|---|
| Not in the sitemap's remit (parameter, pagination, variant, non-canonical URL) | URL pattern; `google_canonical` differs from `url` | Regenerate the sitemap so it lists only canonical 200-status URLs |
| Discovered, never crawled | `coverage_state` says discovered, `last_crawl_time` null | Internal links to the page; fewer low-value URLs competing for crawl budget |
| Crawled, not indexed | `coverage_state` says crawled, `verdict` not passing | Strengthen or consolidate thin or duplicate content |
| Blocked or non-indexable | `robots_txt_state` blocked, or `indexing_state` reporting noindex | Fix the robots.txt rule or remove the noindex, or drop the URL from the sitemap if intentional |
| Fetch problem | `page_fetch_state` not successful (redirect, 404, server error) | Serve 200 at the listed URL, or list the final URL instead |
| Recently published | Zero impressions and a recent publish date the user confirms | Wait; recheck after the next sitemap download |

   Do not invent a verdict for a URL with no stored row; the indexing-health skill inspects those within quota.

5. **Bing side.** Call `get_bing_feeds` with `siteUrl`.
   - `notConfigured: true`: say Bing Webmaster Tools is not connected for this property in the GSC Wizard app, relay the `hint`, and continue.
   - Otherwise read `feeds[]`, sorted by URL: `url`, `status` (Success, Pending, Warning or Error), `type` (Sitemap, RSS, Atom and so on), `submitted`, `lastCrawled` and `urlCount`. A date of 1601-01-01 is Bing's empty value, not a real date, and `emptyBecause` means Bing lists no feed at all.
   - Compare the two engines: a sitemap Google has and Bing lacks, or an Error status only on Bing, goes into the recommendations.

6. **Submit or resubmit (write, confirm first).** Only when the user asks, or when step 2 found no sitemap or a pending or error-state one that the user wants refetched.
   - Before calling, list the exact sitemap URLs and ask the user to confirm. Explain what the call does: `submit_sitemap` registers already-published sitemap URLs with Google (it never generates or hosts a file), queues a download, is idempotent, does not index anything, and Google reports warnings and errors only after it has downloaded the file, so a fresh submission normally comes back pending.
   - Each URL in `sitemapUrls` must be absolute, on the property host or a subdomain, and already reachable; up to 20 per call.
   - Google refuses it when the connection's `gscScope` is readonly (the tool refuses before sending anything and its message names "Enable full access" on the Account page in the app), and a read-only connection refuses it too. In both cases say this step needs full access or a write access and continue with the read-only parts.
   - Read `submitted`, `failed`, `results[]` (`sitemapUrl`, `accepted`, `confirmed`, `isPending`, `warnings`, `errors`, or `error` for a rejected one), `notAttempted` with `stopReason` when a rate limit or permission refusal stopped the batch, `message` and `actions`. Tell the user to re-check `list_sitemaps` in a few hours for warnings and errors.

## Output

Present the audit in this order, with compact markdown tables (top rows only, typically 5 to 10) and prose only for interpretation:

1. **Sitemap table** (`list_sitemaps`): Sitemap, Type, Index?, Last submitted, Last downloaded, Pending, Warnings, Errors, URLs submitted (from `contents[].submitted`). Never a column for indexed counts.
2. **Coverage line** (`get_sitemap_performance`, with the `range`): URLs in the sitemap, URLs with impressions, the derived share, whether the join was truncated, and the top 5 URLs by clicks.
3. **Suspects by likely cause**: one row per group from step 4 with the URL count, two or three example URLs, and the fix; state how many suspects have no stored verdict.
4. **Bing** (`get_bing_feeds`): Feed, Type, Status, Submitted, Last crawled, URL count, or the not-configured note.
5. **Submission result** (`submit_sitemap`, only if step 6 ran): per sitemap accepted, confirmed, pending, warnings and errors, plus anything in `notAttempted`.

End with a short prioritized list of 3 to 7 concrete recommendations (regenerate the sitemap without the hygiene groups, fix the fetch problems, resubmit after the fix, inspect the unknown group with the indexing-health skill and roughly how much quota that needs, submit the sitemap to Bing). Judge by the clicks and impressions at stake, not by URL counts alone. Do not fabricate rows the tools did not return; if a tool returns nothing, say so.

## Error handling

If any tool call fails with an authentication or subscription error, tell the user to run `/mcp` to (re)authenticate, and that a GSC Wizard account with an active plan or trial plus a connected Google Search Console account is required. If the property is not found, re-run `list_sites` and offer the closest matches instead of guessing a URL format. If a single tool fails for another reason, report the gap in the relevant section and complete the rest of the workflow with the remaining data.

## Grounding

Every number you report must name the tool it came from and the date range it covers, for example "clicks 12,340 (`get_site_summary`, 2026-09-21 to 2026-09-27)". For a table, state the tool and date range once on the line above it. If you derive a figure yourself (a delta, a sum, a share), say so and name the tool outputs it was computed from. Never report a number no tool returned.
