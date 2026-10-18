---
name: onpage-audit
description: Run a technical on-page audit of a set of pages on a Search Console property with the GSC Wizard MCP tools: pick the URLs from the user's list, the top pages by clicks, or a sitemap, crawl them in batches with audit_onpage_seo (indexability, canonical, titles and meta, headings, links, images, structured data), optionally confirm a canonical mismatch with a quota-aware URL inspection, then report issues grouped by severity with affected URLs and fixes. Use when the user says "audit these pages", "check my on-page SEO", "technical check of my top pages", "are my titles and meta descriptions ok", or asks for a technical review of specific URLs.
---

# On-Page Audit

Crawl a chosen set of pages on one property, run the technical on-page checks on each, and report the issues grouped by severity with the affected URLs and the fix. `$ARGUMENTS` may contain a property, a list of URLs, a sitemap URL, a section path (for example "/blog/"), or a page count; use it to skip resolution and to narrow the URL set. This skill reads the pages' own HTML. For whether Google indexed them, run the indexing-health skill.

## Workflow

1. **Resolve the property.** If `$ARGUMENTS` or the conversation names a property, use it. Site URLs use GSC formats: `sc-domain:example.com` or `https://www.example.com/`. Otherwise call `list_sites` and pick the obvious match. If several plausible properties exist, ask the user which one before continuing.
   - The property also bounds the crawl: `audit_onpage_seo` fetches only URLs that belong to it (a domain property covers its subdomains, a URL-prefix property only its own origin and path prefix) and lists any other URL in `skipped` with a reason, so a URL on another host needs its own property.

2. **Choose the URL set.** Take the first source that applies, and keep the whole workflow to about 25 to 50 pages unless the user asks for more, because every page is fetched live from the user's site.
   - The user named URLs: use them as given, at most 25 per call (the `urls` cap).
   - "My top pages" or no hint: call `query_top_pages` with the `siteUrl` and `limit: 25`, omitting `startDate` and `endDate` for the last 28 settled days, and take the `page` values. Rows are sorted by clicks, highest first; `ctr` is a 0-100 percentage, never multiply it by 100; `position` is lower-is-better. GSC data lags about 2 to 3 days, so the window ends before today.
   - No list and no traffic read: omit `urls` and let the tool auto-pick the top pages by impressions with `maxUrls` (default 10, max 25) and `minImpressions` (default 0, counted over the same 28 days).
   - A sitemap or a section: call `get_sitemap_performance` with `sitemapUrl` (on the property host; one level of sitemap-index expansion) and `maxUrls` (default 500, max 2000). Audit the URLs with clicks or impressions first.
   - URLs with zero impressions are an index-coverage question for the sitemap-audit and indexing-health skills, not an on-page one, unless the user asks about them.

3. **Run the audit in batches.** Call `audit_onpage_seo` with `siteUrl` and `urls` (up to 25).
   - The tool fetches each page live, honouring robots.txt Crawl-delay per host and the property's crawl rate, and stops after about 50 seconds. When `truncated` is true, the URLs in `notAudited` were not fetched: call again with `urls` set to that list and repeat until `notAudited` is empty.
   - On a slow or throttled site, batches of 10 finish more reliably than batches of 25. A site that keeps answering 429 can be crawled more gently with `update_site` (lower `crawlMaxConcurrency`, raise `crawlMinDelayMs`) once the user confirms the change; a read-only API key refuses it.
   - Read `auditedCount`, `skipped`, `contextRange` (the 28-day window behind `impressions` and `clicks`) and `summary`: `total_pages`, `total_issues`, `by_severity` (critical, high, medium, low, info), `indexable_pages`, `non_indexable_pages`. `summary` covers one call, so merge the batches yourself before reporting totals and say so.
   - Read `pages[]`, sorted by `issueCount` descending then `impressions`. Crawl fields per page: `statusCode`, `redirected`, `redirectChain`, `responseTimeMs`, `bodyBytes`, `impressions`, `clicks`.
   - On-page fields per page: `indexable`, `indexabilityStatus`, `noindex`, `canonicalUrl`, `canonicalIsSelf`, `title`, `titleLength`, `metaDescriptionLength`, `h1Count`, `wordCount`, `internalLinks`, `externalLinks`, `imagesMissingAlt`, `imagesCount`, `hasStructuredData`, `structuredDataTypes`, `schemaIssues`, `hasViewport`, `lang`, `hreflangCount`.
   - Each entry in `issues[]` has `id`, `category`, `severity` and `message`; `issueCount` is the length of that list and the primary sort key.
   - `crawlNote`: some pages answered a blocked-looking status because a bot rule rejects the crawler; relay the whitelisting advice instead of reporting broken pages.
   - `robotsNote`: robots.txt disallows GSCWizard-Bot, so those pages were not fetched and carry the `blocked-by-robots` issue.
   - `metricsUnavailable` with `contextNote`: `impressions` and `clicks` are null, meaning unknown, not 0; the on-page checks still stand.
   - If `pages` is empty, read `emptyBecause` and do what `nextStep` says.

4. **Interpret by category and weight by traffic.** Severities are critical, high, medium, low, info; categories are indexability, canonical, meta, headings, content, links, images, structured-data, technical. Read them with this table.

| Category | Issue ids | What it means and the usual fix |
|---|---|---|
| indexability | `blocked-by-robots` (critical), `noindex` (critical with impressions, else high), `nofollow` (medium) | Google is told to stay away; remove the robots rule, tag or header unless it is intentional |
| technical | `fetch-failed`, `http-error` (critical), `redirect-loop` (high), `redirected`, `slow-response`, `missing-viewport`, `large-page-weight` (low), `non-html` (info) | The URL does not serve a plain 200 HTML page; fix the status, shorten the chain, link to the final URL, trim the page |
| canonical | `missing-canonical` (medium), `canonicalised` (medium with impressions, else low) | The page points elsewhere or nowhere; make the preferred URL self-canonical, consolidate duplicates |
| meta | `missing-title` (high), `missing-meta` (medium), `title-long`, `title-short`, `meta-long`, `meta-short` (low) | Rewrite titles and descriptions within the length hints in `message`; prioritise pages with impressions but low `ctr` |
| headings, content | `missing-h1` (high), `multiple-h1` (low), `thin-content` (medium under 100 words, else low) | One descriptive H1; expand or merge thin pages |
| links, images | `no-internal-links` (medium), `images-missing-alt` (low) | Link the page into the site; add alt text, most important on pages with image impressions |
| structured-data | `no-structured-data` (low), schema issues from `schemaIssues` (medium when the level is error) | Add or repair JSON-LD for the page type; an error-level schema issue can cost rich results |

   Always rank a finding by the `impressions` and `clicks` of the pages it affects, not by its count: a `noindex` on a page with clicks is an emergency, a short title on a page with no impressions is housekeeping. Issue `message` texts carry the measured value (the title length, the word count, the HTTP status), so quote them rather than restating thresholds.

5. **Confirm a canonical mismatch (optional, quota-aware).** Only for pages with impressions where `canonicalIsSelf` is false or `canonicalUrl` is null.
   - First call `list_url_inspections` with `urlContains` set to the path and `latestPerUrl: true`. It spends no quota and returns the stored `google_canonical` and `user_canonical` per row; a row whose `google_canonical`, `user_canonical` and `inspection_result_link` are all null predates canonical storage.
   - If nothing is stored, call `get_inspection_quota` and read `remaining` (Google allows 2,000 inspections per property per day, shared with the app; `unavailable: true` means the counter could not be read and the figures are placeholders, so treat the quota as unknown). Only when plenty remains, call `inspect_url` with `inspectionUrl` for at most 3 to 5 pages and compare `googleCanonical`, `userCanonical` and the audit's `canonicalUrl`. A null canonical means Google did not report one, which is common for unindexed pages.
   - Stop if a response carries `quotaExhausted: true`. For a wider inspection run, hand over to the indexing-health skill.

## Output

Open with one line of scope: pages audited, pages skipped or not audited, the `contextRange`, and the merged issue counts by severity with indexable versus non-indexable pages. Then present, in this order:

1. **Issues by severity** (`audit_onpage_seo`, with the context range): one table, critical first, with columns Severity, Issue (`id`), Category, Affected pages, Example URL, Fix. Group identical ids across pages into one row and give the fix in one sentence.
2. **Worst pages** (top 5 to 10 by `issueCount` then `impressions`): URL, impressions, clicks, status code, issue count, the most severe issue. Keep prose for interpretation, not for restating numbers.
3. **Canonical check** (only if step 5 ran): URL, declared canonical, Google's canonical, verdict.
4. **Not yet audited**: the URLs still in `notAudited` or `skipped`, with the reason, if any remain.
5. **Crawl notes**: the whitelisting or robots.txt advice from `crawlNote` and `robotsNote`, when either is present, since those pages need the user's action before a rerun.

End with a short prioritized list of 3 to 7 concrete recommendations ordered by traffic at stake and effort, each naming the pages and the action. Present every multi-row result as a compact markdown table (top rows only, typically 5 to 10). Do not fabricate rows the tools did not return; if a batch returned no issues, say the pages passed the checks that were run.

## Error handling

If any tool call fails with an authentication or subscription error, tell the user to run `/mcp` to (re)authenticate, and that a GSC Wizard account with an active plan or trial plus a connected Google Search Console account is required. If the property is not found, re-run `list_sites` and offer the closest matches instead of guessing a URL format. If a single tool fails for another reason, report the gap in the relevant section and complete the rest of the workflow with the remaining data.

## Grounding

Every number you report must name the tool it came from and the date range it covers, for example "clicks 12,340 (`get_site_summary`, 2026-09-21 to 2026-09-27)". For a table, state the tool and date range once on the line above it. If you derive a figure yourself (a delta, a sum, a share), say so and name the tool outputs it was computed from. Never report a number no tool returned.
