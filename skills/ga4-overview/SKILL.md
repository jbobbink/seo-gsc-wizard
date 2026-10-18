---
name: ga4-overview
description: Review the Google Analytics 4 side of a Search Console property through the GSC Wizard MCP server: which GA4 properties are readable and linked, the traffic overview with its previous-period comparison, the channel mix with the organic share and trend, one breakdown dimension of choice, the key event (conversion) that matters, error pages, and the site's own custom dimensions. Use when the user asks "how is my GA4 traffic", "show me analytics for my site", "sessions and conversions this month", "which pages get traffic in GA4", "is organic growing in analytics", "which pages show a 404", or "what custom dimensions do I have".
---

# GA4 Overview

Read the Google Analytics 4 property linked to one Search Console site and present a traffic overview, the organic channel's share and trend, conversions, error pages and recommendations. The user's request may contain a property, a date range, a key event name (for example "form_submit"), a dimension to break down by, or a custom dimension name; honor what is given and resolve the rest below.

## Workflow

1. **Resolve the property.** If the user's request or the conversation names a property, use it. Site URLs use GSC formats: `sc-domain:example.com` or `https://www.example.com/`. Otherwise call `list_sites` and pick the obvious match. If several plausible properties exist, ask the user which one before continuing. Use the last 28 days compared with the previous period unless the user specifies dates. Every GA4 tool here defaults to the same settled window as the Search Console tools (the last 28 days ending about 3 days back), so omitting `startDate` and `endDate` is the safe choice; when the user asks for explicit dates that reach into the last day or two, say that GA4 may still be processing them and treat the newest day as incomplete rather than as a drop.

2. **Confirm the GA4 link.** Call `list_ga4_properties` (no arguments). Read `connected`: `false` means the Google Analytics consent has not been granted in the GSC Wizard app for this account (`account` names it), and `connected: false` with `reauthRequired: true` means it was granted but Google now rejects every Google account carrying it, so the user has to reconnect it on the Account page of the app. Find the property whose `linkedSiteUrls` contains the resolved site; linking happens in the app, not through the MCP, so if no property lists the site, say so and tell the user to link one in GSC Wizard. `linkedSiteUrls` only covers the GSC Wizard account this connection is authenticated as, so a link made from another account of the user shows as empty here. Read `errors` for Google accounts whose properties are missing from the list and relay each `message`.

3. **Traffic overview.** Call `get_ga4_overview` with `siteUrl`; it always compares against the same-length period immediately before unless both `comparisonStartDate` and `comparisonEndDate` are passed. Read `summary` and `prevSummary`: sessions, active, total and new users, page views, `engagementRate`, `averageSessionDuration` (seconds), `bounceRate`, event count and key events. The two rates are 0-1 fractions, so multiply them by 100 for display and say so. When `comparisonHasData` is false, `prevSummary` is null because the data stream did not exist yet; report the current period alone instead of a change. Set `includeTimeseries: true` only when the user wants the daily shape (`timeseries`, oldest day first). If the response carries `siteScope`, the GA4 property is shared by several sites and every number is limited to this site's hostnames; say that once.

4. **Channel mix and the organic share.** Call `query_ga4_report` with `dimension: "channel"`, `comparisonStartDate` and `comparisonEndDate` set to the previous period (this tool only compares when both are given; without them the `prev*` fields are 0 and `hasComparison` is false) and `limit: 25`. Rows carry the metric names listed in `metrics` (sessions, activeUsers, engagementRate and keyEvents for this dimension), sorted by sessions. Derive the organic share as the "Organic Search" row's sessions divided by `summary.sessions` from step 3, label it as derived, and report the change in organic sessions against the comparison. For the trend over days, call the tool again with `dimension: "date"` and `filters: { channel: ["Organic Search"] }`; date breakdowns take no comparison range. Rows stop at `limit` (`truncated` and `note` say when more exist), so never sum rows to reach a total; `get_ga4_overview` owns the totals.

5. **One more breakdown when the question asks for it.** `query_ga4_report` takes one dimension per call and `secondaryDimension` (`date` or `hostName`, different from `dimension`) splits each row further, for example `dimension: "event"` with `secondaryDimension: "date"` shows on which days an event fired. `filters` narrow by `channel`, `sourceMedium`, `pagePath`, `landingPage`, `country`, `device`, `event` or `hostName`; to follow one event pass `filters: { event: ["<eventName>"] }`. Keep `limit` at 25 unless the user wants more (max 1000). Pick the dimension from the question:

| Question | `dimension` |
|---|---|
| which pages bring visitors in | `landingPage` |
| which pages are viewed most | `page` |
| which referrers or campaigns send traffic | `sourceMedium` |
| where the audience is, on what | `country`, `device` |
| which events fire, and when | `event`, with `secondaryDimension: "date"` |
| which host or stream the traffic hits | `hostName` |

6. **Conversions.** Call `get_ga4_key_events` with `siteUrl` and, when the user named one, `keyEvent`; omit it to let the tool pick the most active key event of the period. The response lists every available name in `keyEventNames` with their activity in `keyEvents`, so offer the others when the chosen one is not what the user meant. Read `summary` (`keyEventCount`, `sessionKeyEventRate` and `userKeyEventRate` as 0-1 fractions) and the breakdown tables `channels`, `sources`, `landingPages`, `pages`, `countries` and `devices`, each sorted by keyEventCount. `isKeyEvent: false` means the event exists but is not marked as a key event in GA4, so the numbers are plain event counts; `metricMode: "event_filter"` means the name has characters beyond letters, digits and underscores and sessions and users count the sessions in which it fired; when `rawEventCount` is above `keyEventCount`, the `note` explains that GA4 does not count occurrences from before the event was marked as a key event. Pass both comparison dates for a period-over-period view.

7. **Error pages.** Call `get_ga4_error_pages` with `siteUrl`. GA4 has no native 404 signal, so the tool matches the page title against the patterns saved for the site in the app's Error Pages report; `noPatterns: true` means none are saved and none were passed, in which case retry once with `titleFilters: [{ operator: "contains", value: "404" }, { operator: "contains", value: "not found" }]` (operators `contains`, `equals`, `starts_with`, `ends_with`, `regex`; case-insensitive, OR-ed, nothing is saved) and tell the user to save patterns in the app for next time. Report the `errorPages` rows (title and URL with sessions, page views, active users and bounce rate as a 0-1 fraction) and `totals`, which counts each session and user once across all matching pages and is therefore smaller than the row sum. An error page with real sessions is a redirect or restore candidate.

8. **Custom dimensions (only when relevant).** When the user asks about their own event parameters or user properties, call `list_ga4_custom_dimensions` first and read each entry's `apiName` (for example `customEvent:source_format`) and `queryable` flag; item-scoped definitions are listed with `queryable: false`, and a parameter that is not registered in GA4 Admin cannot be reported on at all, so never guess a name. Then call `query_ga4_custom_dimensions` with `dimension` set to that `apiName`, optionally `secondaryDimension` (another custom `apiName`, or one of `eventName`, `pagePath`, `landingPage`, `sessionDefaultChannelGroup`, `sessionSourceMedium`, `country`, `deviceCategory`) for one row per pair of values, `filters: { event: ["<eventName>"] }` to limit it to the event that carries the parameter, and `valueFilters` (`dimension`, `operator` from `contains`, `equals`, `not_contains`, `not_equals`, `regex`, and `value`) to drill into one value. Rows carry `key`, `secondary`, `eventCount`, `sessions`, `activeUsers` and `keyEvents`; `customMetrics` adds registered custom metrics as columns.

## Interpretation rules

- GA4 rates (`engagementRate`, `bounceRate`, `sessionKeyEventRate`, `userKeyEventRate`) are 0-1 fractions: show them as percentages after multiplying by 100 and say which tool they came from. GSC `ctr` values elsewhere are already percentages on a 0-100 scale; never multiply them by 100. `position`: lower is better.
- Present every multi-row result as a compact markdown table (top rows only, typically 5 to 10); keep prose for interpretation, not for restating numbers.
- Judge changes by the sessions and key events at stake, not by percentage alone: a channel that doubled from 20 sessions matters less than a 10% move on the organic channel.
- Do not fabricate rows the tools did not return; when a breakdown is empty, say so and move on.
- Keep Search Console questions (clicks, queries, rankings) out of this skill: refer the agent to the site-audit skill for the search side and to the seo-revenue skill when the question is which pages and queries make money.

## Output

1. **Overview table**: sessions, users, engagement rate, bounce rate and key events, current versus previous period with the change (`get_ga4_overview`), plus one sentence on the GA4 property and its link (`list_ga4_properties`).
2. **Channels**: the channel table and the derived organic share, with the organic trend from the date breakdown when it was pulled (`query_ga4_report`).
3. **Conversions**: the key event chosen, its totals and rates, and the top channels and landing pages behind it (`get_ga4_key_events`).
4. **Error pages**: the table and `totals`, or the note that no patterns are saved (`get_ga4_error_pages`).
5. Any extra breakdown or custom-dimension table the user asked for (`query_ga4_report`, `query_ga4_custom_dimensions`).
6. End with a short prioritized list of 3 to 7 concrete recommendations (restore or redirect error pages that still get sessions, investigate the channel that fell, mark a frequently fired event as a key event, put landing pages with poor engagement on a refresh list), each naming the pages or events to act on.

## Follow-up

After delivering the overview, offer `generate_seo_report` for the property, which runs the whole analysis suite in one call and includes the GA4 section when a property is linked, as a styled HTML report to hand over; run it only if the user asks, since the default `format: "html"` is a large result.

## Error handling

If any tool call fails with an authentication or subscription error, tell the user to run `/mcp` to (re)authenticate, and that a GSC Wizard account with an active plan or trial plus a connected Google Search Console account is required. If the property is not found, re-run `list_sites` and offer the closest matches instead of guessing a URL format. If a single tool fails for another reason, report the gap in the relevant section and complete the rest of the workflow with the remaining data.

A GA4 tool that answers `notConfigured: true` is not an error: read `reason`, relay `hint`, and continue with whatever else works.

| `reason` | Meaning | What to tell the user |
|---|---|---|
| `no_scope` | Google Analytics is not connected in the GSC Wizard app for the account in `account` | connect Google Analytics in the app, then retry |
| `no_scope` with `reauthRequired: true` | it is connected but Google rejects the saved connection | reconnect Google Analytics on the Account page of the app |
| `no_property` | no GA4 property is linked to this site in the app under that account | link one on the site's Analytics page in the app |

A refusal carrying `reason: "google_token_unavailable"` is temporary: retry the call once. `ga4_not_shared` means the property was shared with this account without GA4 access and only the owner can enable it on the invite; `google_reconnect_required` and `ga4_permission_denied` need the user to reconnect Google Analytics with an account that can read the GA4 property, and `owner_google_connection_unavailable` needs the owner who shared the property to do the same.

## Grounding

Every number you report must name the tool it came from and the date range it covers, for example "clicks 12,340 (`get_site_summary`, 2026-09-21 to 2026-09-27)". For a table, state the tool and date range once on the line above it. If you derive a figure yourself (a delta, a sum, a share), say so and name the tool outputs it was computed from. Never report a number no tool returned.
