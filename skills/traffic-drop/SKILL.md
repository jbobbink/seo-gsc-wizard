---
name: traffic-drop
description: Diagnose why organic traffic dropped on one Search Console property using the GSC Wizard MCP tools. Dates the break with the change-point and anomaly detectors, sizes it with before and after windows, then tests causes in order: Google ranking updates, logged site changes, query and page ranking losses, position-band shifts, device or country segments, reporting artefacts, and deindexed tracked pages. Ends with the most probable cause, a runner-up, what the evidence rules out, and an optional annotation. Use when the user asks "why did my traffic drop", "clicks fell last week", "did the Google update hit me", "lost rankings", "traffic down since", or "what happened on" a date.
---

# Traffic Drop Diagnosis

Answer "why did my organic traffic drop?" for one Search Console property: date the break, size it, test the usual causes in a fixed order, and name the most probable one with the evidence for and against it. The user's request may contain a property, the date or period the user noticed the drop ("since mid-September"), a metric (clicks or impressions), and a focus hint such as a country, a device or a site section; honor each by narrowing the windows and the segment checks.

## Workflow

1. **Resolve the property.** If the user's request or the conversation names a property, use it. Site URLs use GSC formats: `sc-domain:example.com` or `https://www.example.com/`. Otherwise call `list_sites` and pick the obvious match. If several plausible properties exist, ask the user which one before continuing. GSC data lags about 2 to 3 days: never treat the most recent 2 days as complete, and if a dip appears at the very edge of the range, say it is likely reporting lag, not a real drop.

2. **Date the break.** Call `detect_change_points` with `metric: "clicks"` and `days: 180` (14 to 480). When the user names a period, pass `startDate` and `endDate` instead; `startDate` overrides `days`. Read the response in this order:
   - `changePoints`: each entry carries `date`, `direction`, `beforeMean`, `afterMean` and `changePercent` (the means cover `windowDays` days either side of the break; `segmentMeanBefore` and `segmentMeanAfter` cover the whole segments). Take the latest entry with `direction: "down"`, or the one nearest the date the user complained about, as the break date.
   - If `count` is 0, read `emptyBecause` and `nextStep` before saying anything, then `trendSummary` (`firstWindow`, `lastWindow`, `ratio`, `slopePerDay`, `direction`, `halfwayDate`). A gradual slide has no step: report it as a trend dated by `halfwayDate`, and lower `sensitivity` (1 to 5, default 2) only when `nextStep` suggests it.
   - Run the same call with `metric: "impressions"`. A break in both metrics is a visibility loss; a break in clicks alone while impressions hold is a CTR loss (titles, a SERP feature, a layout change), which rankings alone will not explain.

3. **Single-day view.** Call `detect_anomalies` with `metric: "clicks"` and `days: 90` (minimum 21; `sensitivity` 2 to 6, default 3.5).
   - Read `anomalies` (`date`, `actual`, `expected`, `deviationPercent`, `severity`, `direction`) and keep the `down` entries around the break; `severity` runs `critical`, `high`, `medium`, `low`, `info`.
   - Check `coverage.zeroFilledDays` and `coverage.trailingGap`: days without rows count as zero, so a run of zero days is a data gap or a deindexing, not a demand change.
   - A single-day anomaly with no change point is an event (an outage, a holiday), not a drop; say so and stop the cause hunt early unless the user disagrees.

4. **Size the drop.** Call `get_site_summary` with `startDate` set to the break date and `endDate` set to the latest settled date (both explicit, so the window is reproducible).
   - The response holds `current` and `previous` blocks with `clicks`, `impressions`, `ctr` and `avgPosition`; `previous` is the same-length window immediately before, which is the baseline. Derive the deltas yourself and say so.
   - Fewer than 7 days after the break makes the sizing provisional; say that too.
   - If `get_filter_options` shows branded keywords configured, repeat with `brand: "non_branded"`: a drop confined to branded queries is brand demand, not ranking.

5. **Test the causes in this order.** Keep the two windows from step 4 (before = the `previous` window, after = the `current` window) in every call so the evidence lines up.
   - **Google updates.** `list_algo_updates` with `startDate` 14 days before the break and `endDate` 14 days after. An entry in `updates` (`name`, `beginISO`, `endISO`, `severity`) whose rollout overlaps the break supports an algorithmic cause only when the ranking test below also shows broad losses. An empty list is not proof that nothing changed: only confirmed updates are listed.
   - **Logged site changes.** `list_annotations` with `siteUrl`, `startDate` 14 days before and `endDate` 7 days after the break. A deploy, migration, template, robots or canonical change on or just before the break date is the strongest single lead.
   - **Ranking losses.** `get_ranking_changes` with `dimension: "query"`, `startDate`/`endDate` set to the after window, `comparisonStartDate`/`comparisonEndDate` set to the before window, `limit: 50` (per bucket, max 10000). Read `declined` and `lost`; rows carry `key`, `clicks`, `prevClicks`, `position`, `prevPosition` and `positionDelta` (prevPosition minus position, so a negative value is a worse rank), and `counts` gives the full bucket sizes. Repeat with `dimension: "page"`.
   - **Band shift.** `get_position_distribution` with `granularity: "period"` and `dimension: "query"`, once per window. Compare `impressionShare` and `rows` per band (`label` 1-3, 4-10, 11-20, 21+).
   - **Segment-only drop.** `query_devices` (it takes no limit and returns at most the three devices) and `query_countries` with `limit: 20`, each once per window; `devices` and `countries` rows carry `device` or `country`, `clicks`, `impressions`, `ctr`, `position`. Compare each segment's share of the loss with its share of the baseline.
   - **Reporting artefacts.** `analyze_sampling_impact` once per window. `totals` is the ground truth; `querySampling.gap.anonymisedShare` is a 0-1 fraction and `missingClicksPercent` stays on a 0-100 scale.
   - **Deindexing.** `get_indexing_tracker` first; when `tracker` is null, say no tracker exists and skip. Otherwise `get_indexing_tracker_report` with `days` covering the break (default 30, max 90) and read `lostPagesTotal`, `lostPages` (`url`, `changedAt`, `coverageState`) and `coverageBreakdown`.

6. **Decide.** Rank the causes by how much of the sized loss each explains, using the cause map below. Weight by clicks at stake, not by percentages: a cause that explains the top page's loss outranks one that explains ten small queries.

## Cause map

| Evidence pattern | Reads as |
|---|---|
| Many queries down a few positions across many pages, update rollout overlapping the break | Google update (algorithmic) |
| A few pages lose most of the clicks, their queries fall or vanish, no update overlap | Page-level: content, canonical or template change on those pages |
| Annotation on or just before the break date | Site change; confirm against the page and query losers |
| Impression share leaves 1-3 and 4-10 for deeper bands | Ranking loss |
| Band shares unchanged while `totals.impressions` fell | Lost demand (seasonality) or lost indexing |
| Clicks break, impressions and position hold | CTR loss: titles, a SERP feature, a layout change |
| One device or one country carries the whole loss, the rest flat | Local cause: mobile template, market SERP feature, geo-targeting or hreflang |
| `anonymisedShare` rises while `totals.clicks` holds | Reporting artefact: query tables lost rows, the site did not |
| `lostPages` dated at the break match the page decliners | Deindexing; the indexing-health skill owns the fix |

## Output

1. **Dated finding**: one sentence with the break date, the metric, `beforeMean`, `afterMean` and `changePercent` (`detect_change_points`), or the trend when no step was found, plus the worst single day from `detect_anomalies`.
2. **Size**: a two-row table of the before and after windows from `get_site_summary` (clicks, impressions, CTR, average position, derived delta). `ctr` values are already percentages on a 0-100 scale; never multiply them by 100. `position`: lower is better, so a change toward a lower number is an improvement; never color it as a decline.
3. **Cause tests**: one table with a row per cause and three columns:

   | Cause | Evidence (tool, dates, numbers) | Verdict |
   |---|---|---|

   Verdicts are supported, ruled out or inconclusive. Below it, the top 5 declined queries and the top 5 declined pages. Present every multi-row result as a compact markdown table (top rows only, typically 5 to 10); keep prose for interpretation, not for restating numbers. Do not fabricate rows the tools did not return; if a tool returned nothing, say so.
4. **Verdict**: the most probable cause, the runner-up, and what the evidence rules out, each in one or two flowing sentences. Say when the evidence is inconclusive rather than forcing a story.
5. **Log it (optional)**: offer to record the finding with `create_annotation` (`siteUrl`, `eventDate` set to the break date, `label` up to 200 characters, optional `description` up to 1000 and `category`). Show the exact fields and ask the user to confirm before calling; the call writes a chart marker and changes nothing else. If it is refused because the connection is read-only, say this step needs write access and leave it there.
6. End with a short prioritized list of 3 to 7 concrete recommendations, each naming the pages or queries to act on. For a slow slide rather than a step, point to the content-decay skill; for pages trading places on the same queries, to the cannibalization skill; for lost pages, to indexing-health.

## Error handling

If any tool call fails with an authentication or subscription error, tell the user to run `/mcp` to (re)authenticate, and that a GSC Wizard account with an active plan or trial plus a connected Google Search Console account is required. If the property is not found, re-run `list_sites` and offer the closest matches instead of guessing a URL format. If a single tool fails for another reason, report the gap in the relevant section and complete the rest of the workflow with the remaining data.

## Grounding

Every number you report must name the tool it came from and the date range it covers, for example "clicks 12,340 (`get_site_summary`, 2026-09-21 to 2026-09-27)". For a table, state the tool and date range once on the line above it. If you derive a figure yourself (a delta, a sum, a share), say so and name the tool outputs it was computed from. Never report a number no tool returned.
