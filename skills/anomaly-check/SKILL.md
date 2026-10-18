---
name: anomaly-check
description: Quiet daily or weekly health check for one Search Console property, built to run unattended from a scheduler with the GSC Wizard MCP tools and a read-only connection. Scans clicks and impressions for severe anomalies and downward level shifts, compares the last settled week with the one before, checks the indexing tracker for lost pages, and overlaps findings with Google updates. Stays silent with one fixed line unless a threshold is crossed, then reports the dated finding, cause class and next skill to run. Use when the user asks "check my site for anomalies", "anything wrong today", "daily SEO check", "monitor my property", or sets up a scheduled check.
---

# Anomaly Check

Run a quiet health check on one property and speak only when something needs a human. It is meant for a scheduler: it calls no write tool, works with a read-only connection, and its quiet-case reply is one fixed line so a log stays readable. The user's request may contain a property (or several, checked one after another with the same rules), a cadence (daily or weekly; daily is the default) and a metric to focus on; nothing else is needed.

## Workflow

1. **Resolve the property.** If the user's request or the conversation names a property, use it. Site URLs use GSC formats: `sc-domain:example.com` or `https://www.example.com/`. Otherwise call `list_sites` and pick the obvious match. If several plausible properties exist, ask the user which one before continuing; a scheduled run with no clear match reports that as its finding. GSC data lags about 2 to 3 days: the tools end at the latest settled date, so the check window is the last 7 settled days for a daily run and the last 14 for a weekly one; never treat the most recent 2 days as complete.

2. **Single-day anomalies.** Call `detect_anomalies` with `metric: "clicks"`, `days: 28` (minimum 21) and the default `sensitivity` (3.5; the range is 2 to 6 and lower finds more). Repeat with `metric: "impressions"`.
   - Keep only `anomalies` whose `date` falls inside the check window; read `severity` (`critical`, `high`, `medium`, `low`, `info`), `direction` (`up` or `down`), `actual`, `expected` and `deviationPercent`.
   - `summary` carries the counts per severity. `coverage.zeroFilledDays` says how many days had no rows at all; a drop to zero is flagged, which is also what a data gap looks like.

3. **Level shift.** Call `detect_change_points` with `metric: "clicks"`, `days: 60` and the default `sensitivity` of 2.
   - Read `changePoints` (`date`, `direction`, `beforeMean`, `afterMean`, `changePercent`) and keep entries dated within the last 14 days.
   - When `count` is 0, `trendSummary.direction` and `trendSummary.ratio` describe the slope. A gradual slide is not a finding for this check, but mention it in a weekly run when `ratio` is below 0.8.

4. **Week over week.** Call `get_site_summary` with `days: 7` (`days: 14` for a weekly run).
   - Compare `current` with `previous` on `clicks` and `impressions`; derive the percentage change yourself and say so.
   - `ctr` is already a percentage on a 0-100 scale, never multiply it by 100; `avgPosition` is lower-is-better, so a move toward a lower number is an improvement.

5. **Lost pages.** Call `get_indexing_tracker_report` with `days: 7` (`days: 14` weekly; max 90).
   - `configured: false` means no tracker exists for the property: skip this signal without comment.
   - Otherwise read `lostPagesTotal`, the first entries of `lostPages` (`url`, `changedAt`, `coverageState`) and `healthScore`; a failed check is not counted as a lost page, so the figure is conservative.

6. **Context, not a trigger.** Call `list_algo_updates` with `startDate` 21 days ago.
   - An entry in `updates` whose `beginISO` to `endISO` span overlaps a fired signal is its likely cause class.
   - An update on its own, with nothing else firing, stays quiet; an empty list is not proof that nothing changed, since only confirmed updates are listed.

## Thresholds

Report when any row below is true; otherwise stay quiet. Judge by volume as well: when `previous.clicks` from `get_site_summary` is under 100, the percentage rules fire only at twice the stated size, because small numbers swing on their own.

| Signal | Tool | Report when | Stay quiet when |
|---|---|---|---|
| Day anomaly | `detect_anomalies` | `severity` is `critical` or `high` with `direction` `down`; or `critical` with `direction` `up` (a spike to verify) | `medium` and below; an anomaly only on the newest 2 settled days (likely lag) unless it is `critical` |
| Level shift | `detect_change_points` | `direction` `down`, dated in the last 14 days, `changePercent` at or below -15 | `direction` `up`; older breaks; no change point |
| Week over week | `get_site_summary` | `clicks` or `impressions` down 20% or more against `previous` | smaller moves, or a gain |
| Lost pages | `get_indexing_tracker_report` | `lostPagesTotal` of 1 or more | 0, or `configured: false` |

## Output

Quiet case: reply with exactly this one line and nothing else, filling in the property and the check window's first and last date:

`All clear for <siteUrl> (<first date> to <last date>): no signal crossed the reporting threshold.`

Do not add a greeting, a summary of what was checked, or a table to the quiet reply; that line is the whole message, so a scheduler can match it.

When something fires, keep the reply under 15 lines and give, in this order:

1. One dated sentence per fired signal with the tool, the dates and the numbers, for example "clicks 412 against an expected 980 on 2026-10-13, severity high (`detect_anomalies`, 2026-09-16 to 2026-10-13)". Present several fired signals as a compact markdown table rather than a list:

   | Signal | Date(s) | Numbers | Tool |
   |---|---|---|---|

   Do not fabricate rows the tools did not return.
2. The likely cause class, one of: reporting lag or data gap (the anomaly sits on the newest days, or `zeroFilledDays` grew), Google update (an overlap from `list_algo_updates`), deindexing (lost tracked pages), or site change or ranking loss (none of the above fits).
3. The next skill to run: traffic-drop for a fall in clicks or impressions, indexing-health for lost pages, weekly-report when the move is small but the user wants the full picture.

Never call a write tool from this skill, and never log an annotation on the user's behalf; a scheduled run has nobody to confirm it.

## Error handling

If any tool call fails with an authentication or subscription error, tell the user to run `/mcp` to (re)authenticate, and that a GSC Wizard account with an active plan or trial plus a connected Google Search Console account is required. If the property is not found, re-run `list_sites` and offer the closest matches instead of guessing a URL format. If a single tool fails for another reason, report the gap in the relevant section and complete the rest of the workflow with the remaining data.

## Grounding

Every number you report must name the tool it came from and the date range it covers, for example "clicks 12,340 (`get_site_summary`, 2026-09-21 to 2026-09-27)". For a table, state the tool and date range once on the line above it. If you derive a figure yourself (a delta, a sum, a share), say so and name the tool outputs it was computed from. Never report a number no tool returned.
