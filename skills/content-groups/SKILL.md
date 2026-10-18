---
name: content-groups
description: Define and measure content groups, the URL-rule segments (blog, product, category or locale folders, subdomains) of one Search Console property, with the GSC Wizard MCP tools. Lists the saved groups and their rules, proposes new groups from the site's folder structure with breakdown_by_path, creates, edits or deletes groups after confirmation, and measures clicks, impressions, CTR, position, page count and click share per group plus the uncategorized remainder with get_content_group_performance. Use when the user asks about content groups or site sections, "how is the blog doing versus the product pages", wants to segment pages by URL pattern, or asks which part of the site drives organic traffic.
---

# Content Groups

Define URL-rule based content groups on one property and measure how each group performs, so the user sees which parts of the site carry the organic traffic and which pages fall outside every group. `$ARGUMENTS` may contain a property, a date range, a focus hint (a folder, a group name, "propose groups"), or an instruction to create, edit or delete a group; honor it when present.

## Workflow

1. **Resolve the property.** If `$ARGUMENTS` or the conversation names a property, use it. Site URLs use GSC formats: `sc-domain:example.com` or `https://www.example.com/`. Otherwise call `list_sites` and pick the obvious match. If several plausible properties exist, ask the user which one before continuing. Use the last 28 days compared with the previous period unless the user specifies dates. GSC data lags about 2 to 3 days: never treat the most recent 2 days as complete, and if a dip appears at the very edge of the range, say it is likely reporting lag, not a real drop.

2. **Read the saved groups.** Call `list_content_groups` with `siteUrl` and read:
   - `groups`: each entry carries `id`, `name`, `description`, `rules`, `color` and `created_at`, sorted by name;
   - the order caveat: that list is a display order only. When the groups are measured, matching is first-match-wins with the newest group evaluated first, so a page that matches two groups counts in the newer one;
   - `emptyBecause`: the property has no groups yet. Continue with step 3 and propose groups instead of measuring.

3. **Propose groups from the site's structure.** Call `breakdown_by_path` with `siteUrl` and `depth: 1` (host plus first folder; raise `depth` to 2, at most 4, when one folder holds most of the traffic and the user wants it split). Omit the dates for the last 28 settled days; `limit` defaults to 100 (max 1000). Each row in `groups` has `path`, `host`, `subdomain`, `clicks`, `impressions`, `ctr`, `avgPosition` and `pageCount`, sorted by clicks. Quote the property totals from `coverage.siteTotals`, never from summed rows, and relay `truncationNote` when `truncated` is true (on the live-API path the least-clicked pages are missing from every group). Turn the folders and subdomains that carry meaningful clicks into proposed groups, one rule each. A rule is a `{ "type", "value" }` object and a group takes 1 to 50 of them:
   - `prefix` with the full URL start, for example `{ "type": "prefix", "value": "https://www.example.com/blog/" }`, for a folder or subdomain;
   - `contains` for a token anywhere in the URL, such as a locale segment or a query parameter;
   - `equals` for one exact page;
   - `regex` for a pattern, in RE2 syntax (no lookahead, lookbehind or backreferences).

4. **Measure the saved groups.** Call `get_content_group_performance` with `siteUrl`. The tool compares periods only when both comparison dates are given, so compute the windows: `endDate` is today minus 3 days, `startDate` 27 days before that, `comparisonEndDate` the day before `startDate`, and `comparisonStartDate` 27 days before that. Omitting the comparison pair returns `hasComparison: false` and no `prev*` fields; to avoid guessing the settled edge, call once without dates, read `range` back and derive the comparison pair from it. `searchType` defaults to `web` (also `image`, `video`, `news`, `discover`). Read out of the response:
   - `groups`: one row per group with `groupId`, `name`, `matchOrder`, `clicks`, `impressions`, `ctr`, `position`, `pages`, `clickShare` and, with a comparison, `prevClicks`, `prevImpressions`, `prevCtr`, `prevPosition`; `uncategorized` is the same row for the pages no group claims. Rows come in `matchOrder` (evaluation order), not ranked by clicks, so sort them yourself for the table.
   - `clickShare`: the group's share of all matched clicks, uncategorized included, on a 0-100 scale.
   - `dataSource` and `truncated`: from the warehouse the totals cover every page of the property; from the live API they cover the top 25,000 pages by clicks and `truncated` is true. `fallbackReason`, when present, names a regex rule the warehouse could not run.
   - The tool errors when the property has no groups at all, and answers with `emptyBecause` when groups exist but no page has data in the range.

5. **Drill into one group or the uncategorized bucket.** Call `get_content_group_performance` again with `groupId` set to a group id or the literal `"uncategorized"`; `limit` caps the rows (default 100, max 1000).
   - The response lists `pages` with `page`, `clicks`, `impressions`, `ctr` and `position`, by clicks, under `groupId` and `groupName`.
   - The uncategorized drill-down is the input for new rules: its top pages show which folders or URL patterns still lack a group.
   - An empty drill-down explains itself in `emptyBecause`: the rules match nothing, or a group earlier in `matchOrder` claims every page they match; for a named group `nextStep` says what to compare.

6. **Create, edit or delete groups (write access).** These are writes: ALWAYS list the exact group name and every rule, say what will change, and ask the user to confirm before calling.
   - `create_content_group` takes `siteUrl`, `name` (unique per property, up to 200 characters), `rules` (the shape from step 3) and optional `description` and `color` (6-digit hex). It returns the saved `group` and, when relevant, `ruleWarnings` with a `severity` and `message` per issue: a regex that cannot compile is rejected outright, a pattern that can backtrack catastrophically is saved but skipped and so matches no page, and a pattern the warehouse cannot run is saved but moves the group's reads to the capped live API. Relay every warning. Because the newest group is evaluated first, a broad new group takes pages away from the older groups it overlaps; say so before creating a catch-all.
   - `update_content_group` takes `groupId` plus any of `name`, `description`, `color`, `rules`. Passing `rules` replaces the whole list, so read the current rules with `list_content_groups` first when the user means to add one. The edit applies to the very next performance call; nothing is recomputed or stored.
   - `delete_content_group` takes `groupId` and returns `deleted: true` with the group's `name`. Deleting a group removes no page data; its pages fall back into the next matching group or into uncategorized.
   - If a write is refused because the connection is read-only, say that this step needs write access and continue with the read-only parts.

7. **Scope other reports to a group.** Call `get_filter_options` with `siteUrl`. Its `contentGroups` list says per group whether it is `filterable`, with a `reason` and `message` when it is not; `brand.configured` says whether branded keywords are set. Scoped reads need an active plan or trial: on a free account the five tools below refuse the scope with `payment_required`, while their unscoped calls still work. When the user wants a group-level report, pass a filterable id as `contentGroupId` to:
   - `get_site_summary`, for the group's totals with a prior-period comparison;
   - `query_top_queries` or `query_top_pages`, for the queries and pages inside the group;
   - `query_countries` or `query_devices`, for the group's market and device mix.

## Interpretation rules

- `ctr` values are already percentages on a 0-100 scale. Never multiply them by 100.
- `position`: lower is better. A change toward a lower number is an improvement; never color it as a decline.
- Present every multi-row result as a compact markdown table (top rows only, typically 5 to 10); keep prose for interpretation, not for restating numbers.
- Judge groups by the clicks and impressions at stake, not by percentage change alone: a 30% drop on a 20-click group matters less than a 5% drop on the group holding half the traffic.
- An uncategorized bucket above roughly 15% of clicks means the groups do not yet describe the site; propose rules from its top pages. A group with many `pages` but few clicks is a thin section; for a page-level triage of it run the content-decay skill, and for a full picture the site-audit skill.
- Do not fabricate rows the tools did not return. For keyword or theme segmentation over queries rather than URLs, run the topic-clusters skill instead.

## Output

1. **Group performance** (one table, tool and date range stated above it), sorted by clicks with the Uncategorized row last. Changes are derived from `clicks` and `prevClicks`; say so.

   | Group | Clicks | Previous | Change | Impressions | CTR | Position | Pages | Click share |
   |---|---|---|---|---|---|---|---|---|

2. **Uncategorized share**: its clicks and `clickShare`, plus the top uncategorized pages from step 5 when the share is material.
3. **Proposed groups**, with the evidence from `breakdown_by_path` or the uncategorized drill-down, and a status of created, awaiting confirmation, or suggestion only.

   | Name | Rule(s) | Clicks | Pages | Status |
   |---|---|---|---|---|

4. End with a short prioritized list of 3 to 7 concrete recommendations: which groups to create or fix, which group's pages to refresh or consolidate, and which group-scoped report to run next.

## Error handling

If any tool call fails with an authentication or subscription error, tell the user to run `/mcp` to (re)authenticate, and that a GSC Wizard account with an active plan or trial plus a connected Google Search Console account is required. If the property is not found, re-run `list_sites` and offer the closest matches instead of guessing a URL format. If a single tool fails for another reason, report the gap in the relevant section and complete the rest of the workflow with the remaining data.

## Grounding

Every number you report must name the tool it came from and the date range it covers, for example "clicks 12,340 (`get_site_summary`, 2026-09-21 to 2026-09-27)". For a table, state the tool and date range once on the line above it. If you derive a figure yourself (a delta, a sum, a share), say so and name the tool outputs it was computed from. Never report a number no tool returned.
