---
name: annotations
description: Keep a change log on a Search Console property's charts with the GSC Wizard MCP annotation tools (list, create, update and delete annotations, plus Google's confirmed ranking updates from list_algo_updates as context) and measure what one change did with before and after windows from get_site_summary, detect_change_points and get_ranking_changes, saying whether a level shift coincides with the change and what else could explain it. Use when the user says "log this change", "add an annotation", "mark the redesign on the chart", "did the launch on date X help", "show the change log", "was it the core update or the release", or wants to edit or remove a chart note.
---

# Annotations and Change Impact

Keep the property's change log complete (every deploy, content launch, redirect, migration or campaign on the chart, with Google's own updates alongside) and, for one change the user asks about, say whether the numbers moved and whether the move can be tied to it. `$ARGUMENTS` may contain the property, a date or date range, an event to log, an annotation to edit or delete, or the change to measure; honor what is given.

## Workflow

1. **Resolve the property.** If `$ARGUMENTS` or the conversation names a property, use it. Site URLs use GSC formats: `sc-domain:example.com` or `https://www.example.com/`. Otherwise call `list_sites` and pick the obvious match. If several plausible properties exist, ask the user which one before continuing. An account-wide note (a tool change, a team event) needs no property; everything that goes on one property's chart does.

2. **Read the change log.** Call `list_annotations` with `siteUrl`, `startDate` and `endDate` (YYYY-MM-DD; both optional, so use the last 90 days unless the user gives a range). Without `siteUrl` the property's own notes are not read, only platform and account ones. Rows carry `id`, `scope`, `event_date`, `label`, `description`, `category`, `color` and `external_source`, newest first:

   | `scope` | What it is | Editable here |
   |---|---|---|
   | `platform` | Google updates synced from the status feed | No |
   | `account` | The user's notes across every property | Yes, by their author |
   | `property` | This property's notes, whoever on the team wrote them | Only the user's own, and on a shared property full access is needed too |

   An empty answer carries `emptyBecause` and `nextStep`; relay them rather than calling the log empty by inference.

3. **Add Google's updates as context.** Call `list_algo_updates` with `startDate` and `endDate`. An update is listed when its rollout overlaps the range, so one that began before the window but was still rolling out inside it is included, and `endISO: null` means it is still rolling out. Rows carry `name`, `beginISO`, `endISO`, `severity` and `uri`. An empty answer carries `methodLimits`: only the updates Google confirms are listed, so never read an empty list as "no ranking change happened". This is the platform-scope context the user did not write; use it for rollout begin and end dates, and the platform rows of step 2 for what is already on the chart.

4. **Log a change.** List the exact date, label, category and scope, confirm, then call `create_annotation` with:
   - `eventDate` (YYYY-MM-DD) and `label` (up to 200 characters).
   - `description` (up to 1000 characters), optional; for a rollout spread over days, annotate the first day and put the end here. One annotation per change.
   - `category` (up to 50 characters), optional; the app's own values are `core-update`, `spam-update`, `content`, `technical`, `agency` and `other`, each with a default colour on the chart, so prefer them.
   - `color`, optional, a 6-digit hex such as `#2563eb`.
   - `siteUrl` to put the note on that property; omit it for an account-wide note. The scope is fixed at creation. Platform annotations cannot be created here.
   - `clientRequestId` (a UUID), optional; a resend with the same key returns the first row instead of a duplicate.

   The response `annotation` carries the `id`; quote it so the user can edit the note later.

5. **Edit or remove a note.** `update_annotation` takes `annotationId` and only the fields to change: `eventDate`, `label`, `description`, `category` and `color` (pass `null` to clear description, category or colour). Scope cannot change; to move a note between account and property, delete it and create a new one. Only the user's own annotations can be edited, platform ones never, and a note on a property shared with the user needs full access to it. `delete_annotation` takes `annotationId`; restate the label and date and ask for an explicit yes first. For every write, list what will change and confirm before calling.

6. **Choose the windows for the change the user asks about.** Let D be the annotation's `event_date` (ask for it if the change is not logged yet, and offer to log it). Then:
   - After window: 14 days starting on D (28 when the property has few daily clicks). Before window: the same length, ending the day before D. Equal lengths keep the weekday mix identical.
   - GSC data lags about 2 to 3 days: the after window must end on or before the latest settled date, never treat the most recent 2 days as complete, and if a dip appears at the very edge of the range, say it is likely reporting lag, not a real drop.
   - If fewer than 7 settled days have passed since D, say the read is early, report what exists, and name the date on which a full window will be available.
   - Note any update from step 3 whose rollout overlaps either window: it is a confounder the verdict must state.

7. **Before and after totals.** Call `get_site_summary` with `siteUrl`, `startDate` set to D and `endDate` set to the last day of the after window. The comparison is always the same-length window immediately before, so `current` is the after window and `previous` the before window. Read:
   - `clicks`, `impressions`, `ctr` and `avgPosition` on `current` and `previous`, and `deltas` (`clicks`, `impressions`, `ctrPoints`, `positionDelta`). `ctr` values are already percentages on a 0-100 scale; never multiply them by 100. `position`: lower is better, so a negative `positionDelta` is an improvement; never color it as a decline.
   - `dailyRows` and `previousDailyRows` (oldest first): whether the after days are uniformly different or one spike carries the delta, and how large the day-to-day spread of the before window is; a delta inside that spread is not a change.
   - When the change touched one part of the site, narrow the read with `contentGroupId` or `topicClusterId` (ids from `get_filter_options`) or with `brand: "non_branded"` (needs branded keywords on the property) so brand demand does not mask the effect.

8. **Was it a level shift?** Call `detect_change_points` with `siteUrl`, `metric` (`clicks`, then `impressions` if only one of them moved), `startDate` about 60 days before D and `endDate` set to the after window's end (the window must span 14 to 480 days), leaving `sensitivity` at its default of 2 (1 to 5, lower finds more). Read:
   - Each change point's `date`, `beforeMean`, `afterMean`, `changePercent` (0 by convention when `beforeMean` is 0, which is new traffic from zero, not no change), `segmentMeanBefore` and `segmentMeanAfter`. A change point within 3 days of D supports a shift tied to the change; one weeks away points at something else.
   - The detector only tests days with N full days on either side, where N is one eighth of the series and at least 3, so a change in the last N days cannot be dated: when D sits that close to the end, `nextStep` says so, and the daily rows of step 7 are the evidence instead.
   - On `count: 0`, `emptyBecause`, `strongestShift` (`date`, `stdDevs`) and `trendSummary` (`firstMean14d`, `lastMean14d`, `ratio`, `slopePerDay`, `direction`, `halfwayDate`) before saying anything was stable: a gradual trend has no step and is reported there.

9. **What moved.** Call `get_ranking_changes` with `siteUrl`, `startDate` and `endDate` set to the after window, `comparisonStartDate` and `comparisonEndDate` set to the before window, `dimension: "page"` for a change made to pages (a redesign, a redirect, a template, a content launch) or `dimension: "query"` for a change aimed at rankings, and `limit: 20` per bucket. Read `new`, `lost`, `improved` and `declined` (each row carries `key`, `clicks`, `impressions`, `ctr`, `position`, `prevClicks`, `prevImpressions`, `prevPosition` and `positionDelta`, which is `prevPosition` minus `position`, so positive means improved) and `counts` for the full bucket sizes. Check whether the movers are the pages or queries the change touched: a redesign of `/blog/` should move `/blog/` pages, and movers elsewhere point at a different cause. Query movers are only the queries Google lists, so a share of clicks has no query row.

10. **Attribute, carefully.** Combine the three reads into one verdict, judged by the clicks and impressions at stake rather than by percentages alone:

    | Verdict | Evidence |
    |---|---|
    | Coincides with the change | A change point within 3 days of D, movers concentrated on what was touched, no overlapping update |
    | Confounded | An update from step 3 overlaps a window, or the movers are spread across untouched pages |
    | No shift | The deltas sit within the day-to-day spread of the before window and no change point lands near D |
    | Too early | Fewer than 7 settled days since D (step 6) |

    Write "coincides with", never "caused": the tools show timing, not causation.

## Output

1. **Change log** for the window: a compact markdown table with Date, Scope, Category, Label and Source (`list_annotations` or `list_algo_updates`), with the tool and date range stated once above it. Say which changes mentioned in the conversation are not yet logged and offer to add them.
2. **Before and after** for the change asked about: a table with Metric, Before, After and Delta for clicks, impressions, CTR and position (`get_site_summary`, both windows' dates), followed by one sentence on the daily pattern.
3. **Level shift**: the change point nearest D with its `beforeMean`, `afterMean` and `changePercent`, or the `emptyBecause` and `trendSummary` reading when there is none.
4. **Movers**: the top 5 of each relevant bucket from `get_ranking_changes`, with a line on whether they are the touched pages or queries.
5. **Verdict**: one short paragraph with the call from step 10 and every confounder named (an overlapping update, reporting lag, an early read, brand demand).
6. **Writes performed**: each annotation created, edited or deleted with its `id`, date and label, or "none".
7. End with a short prioritized list of 3 to 5 concrete recommendations: the date to re-measure, events still to annotate, whether to extend, adjust or roll back the change, and the skill to run next (content-decay for pages that lost clicks, cannibalization when two pages swapped places, weekly-report to keep watching).

Do not fabricate rows the tools did not return; if a bucket or a window is empty, say so.

## Error handling

If any tool call fails with an authentication or subscription error, tell the user to run `/mcp` to (re)authenticate, and that a GSC Wizard account with an active plan or trial plus a connected Google Search Console account is required. If the property is not found, re-run `list_sites` and offer the closest matches instead of guessing a URL format. If a single tool fails for another reason, report the gap in the relevant section and complete the rest of the workflow with the remaining data. If a write is refused because the connection uses a read-only API key, say that this step needs a read & write key and continue with the read-only parts.

## Grounding

Every number you report must name the tool it came from and the date range it covers, for example "clicks 12,340 (`get_site_summary`, 2026-09-21 to 2026-09-27)". For a table, state the tool and date range once on the line above it. If you derive a figure yourself (a delta, a sum, a share), say so and name the tool outputs it was computed from. Never report a number no tool returned.
