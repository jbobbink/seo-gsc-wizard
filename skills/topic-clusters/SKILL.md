---
name: topic-clusters
description: Define and measure topic clusters, the keyword-based segments over the search queries of one Search Console property, with the GSC Wizard MCP tools. Lists the saved clusters and their keywords, proposes clusters from the property's top queries with query_top_queries, creates, extends, trims or deletes clusters after confirmation (create_topic_cluster, update_topic_cluster with mode replace, add or remove, delete_topic_cluster), and measures each cluster's clicks, impressions, CTR, position, matched queries and click share with overlap accounting and the unclustered remainder (get_topic_cluster_performance). Use when the user asks about topic clusters, keyword groups or themes, "how does the pricing topic perform", wants to group queries by subject or intent, or asks which topics drive organic traffic.
---

# Topic Clusters

Define keyword-based topic clusters on one property and measure how each topic performs across the property's queries, including how much of the demand no cluster covers yet. The user's request may contain a property, a date range, a topic or keyword list, a cluster name, or an instruction to create, extend or delete a cluster; honor it when present.

## Workflow

1. **Resolve the property.** If the user's request or the conversation names a property, use it. Site URLs use GSC formats: `sc-domain:example.com` or `https://www.example.com/`. Otherwise call `list_sites` and pick the obvious match. If several plausible properties exist, ask the user which one before continuing. Use the last 28 days compared with the previous period unless the user specifies dates. GSC data lags about 2 to 3 days: never treat the most recent 2 days as complete, and if a dip appears at the very edge of the range, say it is likely reporting lag, not a real drop.

2. **Read the saved clusters.** Call `list_topic_clusters` with `siteUrl` and read:
   - `clusters`: each entry carries `id`, `name`, `keywords` and `created_at`, sorted by name;
   - `emptyBecause`: the property has no clusters yet. Continue with step 3 and propose clusters instead of measuring.

3. **Propose clusters from the query set.** Call `query_top_queries` with `siteUrl` and `limit: 500` (default 100, max 1000 per call; pass `offset` from `pagination.nextOffset` for the next page and stop when `pagination.hasMore` is false or the rows reach single clicks). Omit the dates for the last 28 settled days. Each row in `queries` has `query`, `clicks`, `impressions`, `ctr` and `position`, by clicks. `coverage.hiddenClicksShare` is a 0-1 fraction: the share of the property's clicks that have no query row at all, so quote totals from `coverage.siteTotals`, never from summed rows. When the user wants branded demand kept apart, check `brand.configured` in `get_filter_options` and, if branded keywords are set, call `query_top_queries` with `brand: "non_branded"` so the proposal is built on non-branded demand. Group the queries by shared head term, product or service name and intent (how-to, comparison, pricing), and give each proposed cluster 3 to 10 keywords. Keyword semantics decide what a cluster catches:
   - a plain keyword is a case-insensitive substring matched anywhere in the query, so a short one like `seo` catches every query containing it; prefer specific terms;
   - a keyword wrapped in slashes, `/seo ?tools/`, is a regex in RE2 syntax (no lookahead, lookbehind or backreferences);
   - a cluster holds up to 1000 keywords.

4. **Measure the saved clusters.** Call `get_topic_cluster_performance` with `siteUrl`. The tool compares periods only when both comparison dates are given, so compute the windows: `endDate` is today minus 3 days, `startDate` 27 days before that, `comparisonEndDate` the day before `startDate`, and `comparisonStartDate` 27 days before that; omitting the comparison pair returns `hasComparison: false` and no `prev*` fields; to avoid guessing the settled edge, call once without dates, read `range` back and derive the comparison pair from it. `searchType` defaults to `web` (also `image`, `video`, `news`). Matching runs over the top `scanLimit` queries by clicks (default 50,000; min 1,000, max 200,000; the warehouse path clamps it, and `scanLimit` in the response is the limit actually applied). Read out of the response:
   - `clusters`: one row per cluster with `clusterId`, `name`, `keywordCount`, `clicks`, `impressions`, `ctr`, `position`, `queries` (distinct matched queries), `clickShare` and, with a comparison, `prevClicks`, `prevImpressions`, `prevCtr`, `prevPosition`; `unclustered` is the same row for the queries no cluster claims. Rows are listed by name, so sort them by clicks for the table.
   - Overlap accounting: `overlappingQueries` counts the queries that matched more than one cluster, and `overlapNote` restates the rule. A query matching two clusters counts fully in both, so cluster totals can exceed `scannedClicks` and are not a partition of the property; only `unclustered` is disjoint from the rest. Never present the cluster rows as summing to the site total.
   - Coverage: `scannedQueries` of `scanLimit`, with `truncated: true` when the long tail was cut; `clickShare` is of the scanned clicks, and `coverage.hiddenClicksShare` (0-1) says how much of the property's clicks had no query row in the first place. Re-run with a larger `scanLimit` only when the user needs the tail, since this call costs twice the usual rate-limit budget.
   - The tool errors when the property has no clusters at all, and answers with `emptyBecause` when Search Console lists no query in the range.

5. **Drill into one cluster or the unclustered bucket.** Call `get_topic_cluster_performance` again with `clusterId` set to a cluster id or the literal `"unclustered"`; `limit` caps the rows (default 100, max 1000).
   - The response lists `queries` with `query`, `clicks`, `impressions`, `ctr`, `position` and `matchedKeywords` (which of the cluster's keywords pulled the query in), plus `matchedQueryCount`, under `clusterId` and `clusterName`.
   - A keyword that shows up on unrelated queries is over-matching: propose removing it or tightening it to a regex.
   - The unclustered drill-down is the pool for new clusters.
   - An empty drill-down explains itself in `emptyBecause` and `nextStep` (raise `scanLimit`, or compare the keywords with the `query_top_queries` rows).

6. **Create, extend, trim or delete clusters (write access).** These are writes: ALWAYS list the exact cluster name and keyword list, say what will change, and ask the user to confirm before calling.
   - `create_topic_cluster` takes `siteUrl`, `name` (unique per property, up to 200 characters) and `keywords` (1 to 1000). It returns the saved `cluster` and `alreadyExisted`; the call is idempotent, so an existing name returns that cluster unchanged (its keywords are not merged), and changing it is an update.
   - `update_topic_cluster` takes `clusterId` plus `name` and/or `keywords`, with `mode` deciding how `keywords` applies: `replace` (the default) swaps the whole list, `add` merges the new keywords in (deduplicated case-insensitively), `remove` drops the listed ones. `mode` only applies together with `keywords`. Read the current list with `list_topic_clusters` before a replace. The response carries the saved `cluster`, `keywordsBefore` and `keywordsAfter`; quote both counts.
   - `delete_topic_cluster` takes `clusterId` and returns `deleted: true` with the cluster's `name`. Deleting a cluster removes no query data.
   - If a write is refused because the connection is read-only, say that this step needs write access and continue with the read-only parts.

7. **Scope other reports to a cluster.** Call `get_filter_options` with `siteUrl`. Its `topicClusters` list says per cluster whether it is `filterable`, with a `reason` and `message` when it is not. Scoped reads need an active plan or trial: on a free account the five tools below refuse the scope with `payment_required`, while their unscoped calls still work. Pass a filterable id as `topicClusterId` to:
   - `query_top_pages`, for the pages that win the topic's clicks;
   - `get_site_summary`, for the topic's totals with a prior-period comparison;
   - `query_top_queries`, `query_countries` or `query_devices`, for the topic's queries, markets and devices.

## Topic clusters or content groups

Content groups segment pages by URL rule: first match wins, every page lands in exactly one group or in uncategorized, and the unit is the page with its page count. Topic clusters segment queries by keyword: clusters overlap, one query can count in several, and the unit is the query. Use content groups when the question is about site sections, templates or folders ("blog versus product pages"), and topic clusters when it is about demand themes that cut across folders ("everything about pricing", "the migration topic") or about intent. On a site whose URL structure mirrors its topics, start with content groups, since they are a true partition; on a site where one topic is spread over many folders, or where the URLs carry no meaning, use clusters. For the page side run the content-groups skill.

## Interpretation rules

- `ctr` values are already percentages on a 0-100 scale. Never multiply them by 100.
- `position`: lower is better. A change toward a lower number is an improvement; never color it as a decline.
- Present every multi-row result as a compact markdown table (top rows only, typically 5 to 10); keep prose for interpretation, not for restating numbers.
- Judge clusters by the clicks and impressions at stake, not by percentage change alone.
- A cluster with few `queries` but many clicks is carried by a head term; one with many queries and few clicks is long tail. A cluster with large impressions at a `position` between 8 and 20 is the growth target (run the quick-wins skill on it); a cluster whose impressions held while clicks and CTR fell points at titles or a SERP change rather than lost rankings; a cluster losing both is the content-decay skill's territory, and one topic split over several ranking pages belongs to the cannibalization skill.
- Do not fabricate rows the tools did not return.

## Output

1. **Cluster performance** (one table, tool and date range stated above it), sorted by clicks with the Unclustered row last. Changes are derived from `clicks` and `prevClicks`; say so.

   | Cluster | Keywords | Clicks | Previous | Change | Impressions | CTR | Position | Queries | Click share |
   |---|---|---|---|---|---|---|---|---|---|

2. **Overlap and unclustered share**: `overlappingQueries`, the summed cluster clicks against `scannedClicks` (derived, say so), the unclustered `clickShare`, and `scannedQueries` of `scanLimit` with `truncated` and `coverage.hiddenClicksShare`.
3. **Proposed clusters**, with the evidence being the clicks of the matching `query_top_queries` rows summed by you, and a status of created, awaiting confirmation, or suggestion only.

   | Name | Keywords | Evidence clicks | Status |
   |---|---|---|---|

4. End with a short prioritized list of 3 to 7 concrete recommendations: which clusters to create, extend or trim, which cluster to grow or defend first, and which cluster-scoped report to run next.

## Error handling

If any tool call fails with an authentication or subscription error, tell the user to run `/mcp` to (re)authenticate, and that a GSC Wizard account with an active plan or trial plus a connected Google Search Console account is required. If the property is not found, re-run `list_sites` and offer the closest matches instead of guessing a URL format. If a single tool fails for another reason, report the gap in the relevant section and complete the rest of the workflow with the remaining data.

## Grounding

Every number you report must name the tool it came from and the date range it covers, for example "clicks 12,340 (`get_site_summary`, 2026-09-21 to 2026-09-27)". For a table, state the tool and date range once on the line above it. If you derive a figure yourself (a delta, a sum, a share), say so and name the tool outputs it was computed from. Never report a number no tool returned.
