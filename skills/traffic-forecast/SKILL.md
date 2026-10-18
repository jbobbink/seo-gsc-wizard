---
name: traffic-forecast
description: Project future clicks or impressions for a Search Console property with the GSC Wizard MCP tools and put the projection in a seasonal context: the seasonal-decomposition forecast with its auto-selected trendline (optionally a growth target, and a conversion rate plus order value for revenue), the same window last year, the monthly seasonal shape, a level-shift check on the history, and logged or planned changes. Use when the user asks "forecast my traffic", "how many clicks next quarter", "project organic traffic for next year", "what does seasonality look like", "set a realistic traffic target", or "estimate revenue from organic growth".
---

# Traffic Forecast

Project future clicks or impressions for one property, place the projection next to last year's numbers and the seasonal shape, and say what has to change to beat the baseline. Every projected figure is an estimate and is labelled as one. The user's request may contain a property, the metric (clicks or impressions), a horizon ("next quarter", "12 months"), a growth target, a conversion rate and average order value for a revenue view, or the window to compare year over year.

## Steps

1. **Resolve the property and the inputs.** If the user's request or the conversation names a property, use it. Site URLs use GSC formats: `sc-domain:example.com` or `https://www.example.com/`. Otherwise call `list_sites` and pick the obvious match. If several plausible properties exist, ask the user which one before continuing. Then translate the horizon into `granularity` and `forecastPeriods`:
   - "next quarter" is `weekly` with 13 periods, "six months" `weekly` with 26 (the default), "next year" `monthly` with 12.
   - Weekly needs about 105 days of history (13 complete weeks) and monthly about 240 days (6 complete months), because the first and last period of the window are dropped as partial.

2. **Check whether the history is representative.** Call `detect_change_points` with `metric` set to the metric being forecast and `days: 180`; raise it to `480` to cover the forecast's full default history (the window must stay between 14 and 480 days). Read:
   - `changePoints`: each break carries `date`, `direction`, `changePercent`, and `beforeMean` / `afterMean`, which are window means over `windowDays` days either side of the break, not whole-period means (`segmentMeanBefore` / `segmentMeanAfter` cover the full segments).
   - A break dated inside the last 90 days means the series moved to a new level recently and the trendline will blend the old level with the new one. Say so, and offer to shorten `historyDays` to the days since the break, never below 90 and never below what the granularity needs.
   - When `beforeMean` is 0, `changePercent` is 0 by convention and the shift is traffic from zero, not "no change".
   - With `count` 0, `trendSummary` still carries the overall movement (`firstMean14d`, `lastMean14d`, `ratio`, `slopePerDay`, `direction`, `halfwayDate`); read `emptyBecause` and `nextStep` before calling the traffic stable.

3. **Run the forecast.** Call `forecast_traffic` with:
   - `siteUrl`, `metric` (`clicks` or `impressions`, default clicks), `granularity` (`weekly` or `monthly`) and `forecastPeriods` (1 to 104, default 26).
   - `historyDays`: the default 480 (90 to 1000; more history improves the seasonal indices) unless step 2 argued for a shorter fit.
   - `trendlineType` left on `auto`, which picks the best R-squared among `linear`, `polynomial`, `logarithmic`, `exponential` and `power`.
   - `growthRate` only when the user named a target: a decimal per forecast period, compounded by default (`compoundGrowth: true`), so 0.05 on a weekly forecast means +5% every week. Convert a yearly target first (a 20% yearly goal is about 0.0035 per week or 0.0153 per month) and state the conversion.
   - `additionalSessions` for a flat amount added to every period (a planned content batch, for example).
   - `cvr` (a decimal: 0.025 is 2.5%) and `aov` (in currency units) for a revenue view: together they add `baselineRevenue` and `growthRevenue` to every row, labelled with `currency` (display only, default USD). Both must be above 0 or no revenue fields appear.
   - If the call fails with "Not enough history", report the complete periods it found, then restore the default `historyDays` if step 2 shortened it, switch to weekly granularity, or tell the user the property does not have enough data yet; the minimum of 13 weeks or 6 months cannot be lowered.

4. **Read the forecast.** The response holds `historyRange`, `historicalPeriods`, `trendline` (`type`, `r2`, `equation`), `candidateTrendlines` (every fitted model with its `r2`, best first), `seasonalIndices`, and `forecast` rows with `period` (`YYYY-Www` or `YYYY-MM`), `baselineSessions`, `growthSessions` and the revenue fields when requested. "Sessions" is the model's name for whichever metric was forecast.
   - The tool reports no confidence interval. The uncertainty it does report is `r2` (how much of the history the trendline explains) and the spread between the candidate models.
   - When `r2` is below about 0.5, or the second candidate's `r2` is close to the first, re-run once with `trendlineType` forced to that second model and present the two baselines as a range.
   - Quote `forecastNote` when present (the model fell back, for example a flat forecast from a constant history), and `settledThrough` or `dataMaturity` so the reader knows where settled data ends.
   - GSC data lags about 2 to 3 days: never treat the most recent 2 days as complete, and if a dip appears at the very edge of the history, say it is likely reporting lag, not a real drop.

5. **Year-over-year context.** Call `get_site_summary` twice with explicit `startDate` and `endDate`:
   - once for the latest 28 settled days (or the window the user named), and once for the same dates 364 days earlier so weekdays line up;
   - each call returns `current` and `previous` (`clicks`, `impressions`, `ctr`, `avgPosition`) plus `deltas` against the period immediately before the window. Compute the year-over-year change yourself from the two `current` blocks and say so; the `deltas` are the recent trend, not the year-over-year figure.
   - `ctr` values are already percentages on a 0-100 scale; never multiply them by 100. `position`: lower is better, and a change toward a lower number is an improvement.

6. **Seasonal shape.** Call `get_decay_overview` with `dimension: "page"`, `granularity: "month"`, `metric` set to the forecast metric, the default `months: 16` and `limit: 10`. Do not leave `dimension` on its default `query`: those rows and totals cover only the queries Google lists, not the whole site.
   - `periods` lists the complete months, `totals.perPeriod` (when present) the per-month total over every page row read, the nearest figure to a property total here, and each row's `values` array is aligned to `periods`.
   - Name the peak and trough months and check that the forecast's high and low periods fall where last year's did; if they do not, the seasonal indices were fitted on too little history and the forecast deserves a wider caveat.
   - Treat any month in `incompletePeriods` as unread, not as zero.

7. **Planned and past changes.** Call `list_annotations` with the property's `siteUrl` and a `startDate` one year back; leave `endDate` out so future-dated entries come back too.
   - A past change (a migration, a redesign, a content purge) explains a break from step 2 and says whether the old level is coming back.
   - A planned one (a launch, a campaign, a seasonal promotion) is a reason the baseline will be beaten or missed and belongs in the recommendations.

## Output

Present these sections in order, with "estimate" in the heading of every projected figure:

1. **Forecast table**: one row per period from `forecast_traffic` (period, baseline estimate, estimate with growth, revenue when requested), the chosen trendline with its R-squared, the range from the second model when step 4 produced one, and the history range the fit used.
2. **Year-over-year context**: the two `get_site_summary` windows side by side with the derived change, plus each window's own prior-period trend.
3. **Seasonal shape**: a short table of the monthly totals from `get_decay_overview` with the peak and trough months named, and whether the forecast follows that shape.
4. **Caveats**, each in one sentence where it applies:
   - a level shift from step 2 and how the fit was shortened, or why it was not;
   - a low R-squared, a short history, a `forecastNote`, or months in `incompletePeriods`;
   - the reporting lag, and that the projection extends the past and cannot see a future algorithm update or a site change.
5. End with a short prioritized list of 3 to 7 concrete recommendations: what has to happen to beat the baseline (content ready before the peak months, decaying pages to refresh before the season turns, a growth target restated per period). Offer to log a planned change with `create_annotation`, showing the exact `eventDate` and `label` and running it only after the user confirms; if the write is refused because the connection is read-only, say that this step needs write access. For a full decay triage point the user to the content-decay skill; for the broader health picture, the site-audit skill.

Present every multi-row result as a compact markdown table (top rows only, typically 5 to 10); keep prose for interpretation, not for restating numbers. Weight the recommendations by the clicks and impressions at stake, not by percentages alone. Do not fabricate rows the tools did not return.

## Error handling

If any tool call fails with an authentication or subscription error, tell the user to run `/mcp` to (re)authenticate, and that a GSC Wizard account with an active plan or trial plus a connected Google Search Console account is required. If the property is not found, re-run `list_sites` and offer the closest matches instead of guessing a URL format. If a single tool fails for another reason, report the gap in the relevant section and complete the rest of the workflow with the remaining data.

## Grounding

Every number you report must name the tool it came from and the date range it covers, for example "clicks 12,340 (`get_site_summary`, 2026-09-21 to 2026-09-27)". For a table, state the tool and date range once on the line above it. If you derive a figure yourself (a delta, a sum, a share), say so and name the tool outputs it was computed from. Never report a number no tool returned.
