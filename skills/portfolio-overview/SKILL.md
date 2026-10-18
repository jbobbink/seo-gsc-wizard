---
name: portfolio-overview
description: Build an agency or multi-site portfolio view across every Search Console property on a GSC Wizard account. Lists owned and shared properties with their readiness (list_sites, get_account_info), ranks them by clicks against the prior period and names the sites that lost the most (get_cross_site_summary, optionally split by search type and country), reports each client tag's aggregated view (list_tags, get_tag_group_view), and manages tags and dashboard slots after confirmation (manage_tags, set_dashboard_visibility). Use when the user asks "how are all my sites doing", wants a client or portfolio overview, asks which site dropped the most, groups properties by client or tag, or asks which property to look at next.
---

# Portfolio Overview

Produce a cross-property view of the account: which sites carry the traffic, which lost the most, how each client tag performs, and which property deserves the next deep dive. `$ARGUMENTS` may contain a tag name, a number of days, a search type, a focus hint ("only client X", "which sites dropped"), or a tag or visibility instruction; honor it when present.

## Workflow

1. **Inventory the account.** Call `get_account_info` (no arguments), then `list_sites` (no arguments), and read:
   - from `get_account_info`: `user`, `googleAccounts` (each with `email`, `isPrimary`, `scopes`, `connectedAt`), `subscription` (`plan`, `status`, `currentPeriodEnd`, `cancelAtPeriodEnd`, or null), `access.level` and `apiKey.scope`, which tells you up front whether the writes in steps 6 and 7 will be refused. If the response carries `warning`, a read failed: relay it and do not tell the user to connect Google or subscribe on the strength of empty fields.
   - from `list_sites`: owned properties first, then shared ones, each by `siteUrl`. Each row carries `siteUrl`, `tags`, `dataSource`, `permissionLevel`, `readable`, `activated` and, when known, `gscScope`; a shared row adds `sharedBy` (the owner) and `accessLevel` (`READ_ONLY` or `FULL`).
   - the readiness flags: `readable: false` means the property is listed in Search Console but not verified, so every read of it fails until the user verifies it; `activated: false` means an owned property is neither on the dashboard nor synced, so the other tools refuse it and the portfolio tools leave it out. Count owned, shared, unreadable and not-activated properties for the account line.
   - the empty and error cases: if the list is empty, relay `emptyBecause` and `nextStep`; if the call errors with reason `google_account_disconnected`, relay its message (reconnecting Google on the Account page fixes it; re-authorizing this integration does not).

2. **Set the window.** Use `days: 28` unless the user asks for another length (1 to 180). The portfolio tools take no dates: they count `days` back from today minus 3 (the Search Console lag) and compare with the same-length window before it, and each response states the exact `range` and `comparison` dates, so quote those. GSC data lags about 2 to 3 days: never treat the most recent 2 days as complete, and if the newest days of a daily trend look low, say it is likely reporting lag, not a real drop. `searchType` defaults to `web` (also `image`, `video`, `news`, `discover`).

3. **Portfolio totals and per-site ranking.** Call `get_cross_site_summary` with `days` and no `tag`, so the properties shared with the account are included (`shared: true` on their rows). Add `includeSearchTypes: true` only when the user asks about the Discover, image, video or news mix (five extra reads per property), and `includeCountries: true` with `countryLimit` (default 25, max 250) when markets matter (one extra read per property). Read out of the response:
   - `scope` (`siteCount`, `sharedCount`, `truncated`), `range`, `comparison`, `current` and `previous` (`clicks`, `impressions`), `deltas`.
   - `sitesIncluded`, `sitesFailed` and `warning`: when `warning` is set, the totals cover only part of the portfolio; say so and never present them as the whole.
   - `perSite`, sorted by clicks: `siteUrl`, `clicks`, `impressions`, `prevClicks`, `prevImpressions`, `dataSource`, `shared` and, when requested, `searchTypes`. These rows carry no CTR or position; derive CTR from `clicks` and `impressions` yourself and say so, or read `get_site_summary` for the sites that matter (step 4).
   - `errors`, one per property left out, with `siteUrl`, `code`, `reason` and `error`. Map the reason to advice: `share_inactive` (the owner revoked the share or their plan ended; ask them to re-share or renew), `google_reconnect_required` or `google_account_disconnected` (reconnect that Google account on the Account page), `property_not_verified` (verify it in Search Console), `search_console_permission_denied` (the Google account lost access), `search_console_rate_limited` (retry later), `read_failed` (retry; report it if it persists).
   - `searchTypes` (`searchType`, `clicks`, `impressions`, `ctr`, `clickShare`) and `countries` (`country`, `clicks`, `impressions`, `ctr`, `position`, `siteCount`) with `countryTotal`, when requested.
   Only selected properties (shown on the dashboard or warehouse-synced) and active shares are covered, at most `maxSites` (default and maximum 100) per call; when `scope.truncated` is true, run the call again per `tag` to cover the rest, and say which properties the headline leaves out.

4. **Sites that need attention.** For every `perSite` row compute the click change (`clicks` minus `prevClicks`) and rank by absolute loss, not by percentage, so a 15% drop on the largest site outranks a 60% drop on a 30-click site; mention the relative change alongside. For the top 3 decliners call `get_site_summary` with `siteUrl` and the same `days` to add CTR and average position with their comparison, which separates a ranking loss (position worse) from a demand or snippet loss (impressions or CTR down at a steady position). Also list the properties in `errors` as attention items, since a site nobody can read is a portfolio gap.

5. **Per-tag view.** Call `list_tags` with `includeSites: true` and read `tags` (`name`, `siteCount`, `isGlobal`, `sites`), `totalTags` and `totalSites`; tags live on owned properties only, so shares never carry one. If no tag exists, `emptyBecause` says so: skip to step 6 and propose a tagging scheme. Otherwise, for the tag the user named or for the largest 3 to 5 tags by `siteCount`, call `get_tag_group_view` with `tag`, `days` and `dimensions: ["query", "page"]` (the default is all four of `query`, `page`, `country`, `device`; each dimension is one more read per property, so add `country` and `device` only when asked); `limit` defaults to 100 (max 1000). Read `current` (`clicks`, `impressions`, `ctr`), `previous`, `deltas`, `daily` (by date, each with `clicks`, `impressions`, `ctr`, `position`), the merged `queries` and `pages` (each row keyed by `query` or `page` with `clicks`, `impressions`, `ctr`, `position`), `perSite`, and the same `sitesIncluded`, `warning` and `errors` fields as step 3. The call errors when no selected property carries the tag; `scope.truncated` means more than `maxSites` (100) do. Do not run it for every tag on a large account; ask which clients matter.

6. **Tag management (write access).** `manage_tags` is a write: ALWAYS list the tag and the exact `siteUrls`, say what will change, and ask the user to confirm first. It takes `action` (`create`, `assign`, `unassign`, `rename`, `delete`) and `tag` (up to 100 characters); `siteUrls` (1 to 100) is required for `assign` and `unassign`, and `newName` for `rename`.
   - `create` defines an account-level global tag and returns the account's `globalTags`.
   - `assign` adds the tag to the listed properties and returns `updated` and `alreadyTagged`; `unassign` removes it and returns `updated` and `notTagged`.
   - `rename` and `delete` apply across every owned property and the global list at once, returning `updatedSites` with `globalTagRenamed`, or `removedFromSites` with `globalTagRemoved`; confirm those with extra care.
   - A property shared read-only is refused with reason `read_only_share` and nothing is written; a batch that would push a property past 50 tags is refused whole.
   - When step 1 showed untagged properties, propose a scheme (one tag per client, or per market) and offer to assign it. If a write is refused because the connection is read-only, say that this step needs write access and continue with the read-only parts.

7. **Dashboard slots (write access).** For owned properties with `activated: false` that the user wants in the portfolio, call `set_dashboard_visibility` with `siteUrls` (1 to 100, exact URLs from `list_sites`) and `visible: true`, after listing them and asking for confirmation.
   - Showing a property consumes a dashboard slot of the plan and is refused when the limit is reached; `visible: false` hides a property and deletes no data.
   - The response reports `updated`, `unchanged`, `notRegistered`, `slots` (`used`, `limit`, `plan`) and a `note` on when the dashboard reflects the change. Report `slots.used` of `slots.limit` so the user knows how many more properties fit.
   - Shares cannot be toggled (the grant is their selection), and warehouse-synced properties are always shown and use no slot.

## Interpretation rules

- `ctr` values are already percentages on a 0-100 scale. Never multiply them by 100.
- `position`: lower is better. A change toward a lower number is an improvement; never color it as a decline.
- Present every multi-row result as a compact markdown table (top rows only, typically 5 to 10); keep prose for interpretation, not for restating numbers.
- Judge by the clicks and impressions at stake, not by percentage alone, and keep a site's `dataSource` in mind when two sites differ: a warehouse-served site and a live-API site are both complete for a 28-day window, but only the warehouse holds long history.
- Do not fabricate rows the tools did not return. For a single property's deep dive, hand off: the site-audit skill for the overall picture, the traffic-drop skill for the largest decliner, the weekly-report skill for a recurring digest.

## Output

1. **Account line**: plan and status, connected Google accounts, and the owned, shared, unreadable and not-activated counts (`get_account_info`, `list_sites`).
2. **Portfolio headline**: current versus previous clicks and impressions with the deltas, the dates covered, and `sitesIncluded` of `scope.siteCount` with the `warning` when the totals are short.
3. **Portfolio table** ranked by clicks (tool and date range above it). Show the top 10 to 15 and say how many more there are; Change is derived from `clicks` and `prevClicks`.

   | Site | Clicks | Previous | Change | Impressions | Previous | Shared | Source |
   |---|---|---|---|---|---|---|---|

4. **Needs attention**: the largest declines by absolute clicks with CTR and position from `get_site_summary`, then the properties in `errors`.

   | Site | Reason | What fixes it |
   |---|---|---|

5. **Per-tag view** when tags exist, one row per tag, and for the focus tag its top queries and pages and a one-line read of the daily trend.

   | Tag | Sites | Clicks | Previous | Change | CTR |
   |---|---|---|---|---|---|

6. **Search-type mix and country leaderboard**, only when requested.
7. End with a short prioritized list of 3 to 7 concrete recommendations: which site to run the site-audit or traffic-drop skill on next and why, which errors to fix, which tags to create or assign, and whether slots allow more properties.

## Error handling

If any tool call fails with an authentication or subscription error, tell the user to run `/mcp` to (re)authenticate, and that a GSC Wizard account with an active plan or trial plus a connected Google Search Console account is required. If the property is not found, re-run `list_sites` and offer the closest matches instead of guessing a URL format. If a single tool fails for another reason, report the gap in the relevant section and complete the rest of the workflow with the remaining data.

## Grounding

Every number you report must name the tool it came from and the date range it covers, for example "clicks 12,340 (`get_site_summary`, 2026-09-21 to 2026-09-27)". For a table, state the tool and date range once on the line above it. If you derive a figure yourself (a delta, a sum, a share), say so and name the tool outputs it was computed from. Never report a number no tool returned.
