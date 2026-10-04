---
name: indexing-health
description: Run an indexing and crawl health check for a Search Console property via the GSC Wizard MCP server; reviews tracked-URL indexing status, sitemap coverage, and quota-aware targeted URL inspections, optionally Bing crawl issues and IndexNow resubmission, then reports issues grouped by cause with concrete fixes. Use when the user mentions indexing problems, pages not indexed, deindexed or dropped pages, crawl issues, sitemap coverage, or asks "is Google indexing my site".
---

# Indexing Health Check

Diagnose why pages are missing from Google's (and optionally Bing's) index and produce an issue summary grouped by cause, with affected URL counts and concrete fixes. `$ARGUMENTS` may contain a property name and/or a focus hint (for example a URL path or "check my blog section"); use it to skip resolution steps or narrow the suspect set.

## Workflow

1. **Resolve the property.** If the user (or `$ARGUMENTS`) named a property, use it; site URLs use GSC formats like `sc-domain:example.com` or `https://www.example.com/`. Otherwise call `list_sites` and pick the obvious match. If several plausible matches exist, ask the user which one before continuing.

2. **Tracked-URL status.** Call `get_indexing_tracker` for the tracker config and status summary. If URLs are being tracked, also call `get_indexing_tracker_report` for the indexing health score, coverage, crawl freshness, and lost / newly-indexed URLs; the lost list is your primary suspect pool. Use `list_tracked_urls` with a status filter when you need the concrete non-indexed URLs. If the tracker is not set up, say so briefly and continue; the sitemap and inspection steps still work.

3. **Sitemap coverage.** Call `list_sitemaps` and check for errors, warnings, and stale last-download dates. For the main sitemap (or the one matching the user's focus), call `get_sitemap_performance` to join sitemap URLs with GSC metrics over the default range (last 28 days compared with the previous period, unless the user specifies otherwise). URLs present in the sitemap but with zero impressions across the range are indexing suspects. Remember GSC data lags about 2 to 3 days: never treat the most recent 2 days as complete, and say so if a dip is visible at the edge of the range. `ctr` values are already percentages on a 0-100 scale; never multiply them by 100. Position: lower is better.

4. **Check inspection quota BEFORE inspecting anything.** Call `get_inspection_quota` and report the remaining daily quota for this property. Plan the inspection batch so it uses well under half of what remains; never spend the whole quota in this workflow. If the quota is exhausted or nearly so, skip step 5, rely on step 6 instead, and tell the user the quota is a daily per-property limit (2,000 inspections per day) that resets each day, so they can rerun this check tomorrow.

5. **Targeted bulk inspection.** Build a small suspect set, typically 5 to 15 URLs and never more than 25: lost or never-indexed URLs from the tracker, sitemap URLs with zero impressions, and any URLs the user named. Call `bulk_inspect_urls` on that set. Group the results by root cause from the verdict and coverage state, for example:
   - Crawled - currently not indexed
   - Discovered - currently not indexed (not yet crawled)
   - Excluded by noindex
   - Google chose a different canonical than the user-declared one
   - Page with redirect, or Not found (404), still listed in the sitemap
   - Blocked by robots.txt

6. **Recent inspection history.** Call `list_url_inspections` to pull recent persisted results without spending quota. Use it to widen the evidence base and to spot status changes (previously indexed URLs that flipped to not indexed).

7. **Bing (optional).** If the user cares about Bing or asked to (re)submit pages, call `get_bing_crawl_issues` for URLs with 4xx/5xx errors, robots blocks, redirect problems, or malware flags; a `notConfigured` response means no Bing API key is linked, so mention that and move on. When the user wants pages (re)submitted, ALWAYS list the exact URLs and ask for confirmation first, then call `submit_indexnow_urls` (up to 100 URLs). Explain that a 202 response means accepted with key validation pending, not confirmation of delivery or indexing; `list_indexnow_submissions` shows the submission history.

## Output

Present findings as an indexing issue summary grouped by cause, as a compact markdown table:

| Cause | Affected URLs | Examples | Fix |
|---|---|---|---|

Keep prose for interpretation. Map causes to concrete fixes, for example:
- Discovered, not crawled: improve internal linking to those URLs, reduce low-value URLs competing for crawl budget.
- Crawled, not indexed: strengthen or consolidate thin/duplicate content; these pages were seen and judged not worth indexing.
- Noindex: remove the tag/header if unintentional.
- Canonical mismatch: align declared canonicals with the pages you want indexed, deduplicate near-identical pages.
- Redirects/404s in sitemap: regenerate the sitemap so it only lists 200-status canonical URLs.
- Robots blocked: fix the robots.txt rule.

End with a short prioritized list of concrete recommendations (highest impact first), including whether a follow-up inspection run is worthwhile once fixes ship and roughly how much quota that will need.

## Error handling

If any tool call fails with an authentication or subscription error, tell the user to run `/mcp` to (re)authenticate, and that a GSC Wizard account with an active plan or trial plus a connected Google Search Console account is required. If a single tool fails for another reason, report it, skip that step, and continue with the rest of the check.
