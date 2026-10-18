---
name: experiment-results
description: Read out an SEO split test for a Search Console property with the experiment tools of the GSC Wizard MCP server: the experiments with their control and variant URL groups, the control-versus-variant click growth with significance test, uplift confidence interval and winner, a sanity check of a few URLs per group, confounders (Google algorithm updates and logged site changes during the test), and a roll-out, extend or stop verdict that can be logged as an annotation. Use when the user asks "how is my SEO test doing", "did the variant win", "read my experiment results", "is the uplift significant", or "should I roll out the change".
---

# Experiment Results

Read out one SEO split test: which group won, by how much, whether the difference is significant, what else happened during the test, and what to do next. Experiments are created in the GSC Wizard app (its Experimentation page, where the control and variant URL groups are defined), not through the MCP; the tools here read and score them. The user's request may contain a property, an experiment name or id, a test window, a confidence level, or a note on what was changed on the variant pages.

## Steps

1. **Resolve the property.** If the user's request or the conversation names a property, use it. Site URLs use GSC formats: `sc-domain:example.com` or `https://www.example.com/`. Otherwise call `list_sites` and pick the obvious match. If several plausible properties exist, ask the user which one before continuing.

2. **Find the experiment.** Call `list_experiments` with the `siteUrl`; add `includeArchived: true` when the user asks about a finished or old test.
   - Each entry carries `id`, `name`, `description`, `status`, `startDate`, `groupCount` and `groups` (`group`, `urlCount`, `color`); the first group is the control.
   - Pick the experiment the user named, or show the list in a short table and ask when more than one is active.
   - An empty list comes with `emptyBecause` and `nextStep`. When `error` is set the list could not be read, and the empty result does not mean the property has none.
   - When none exists, tell the user to create one in the app first (define the control and variant URL groups there) and stop.

3. **Score it.** Call `get_experiment_results` with `siteUrl`, `experimentId` and, unless the user wants the default last 28 settled days, `startDate` set to the experiment's `startDate` (when it has one) with `endDate` left out, so the window runs to the latest settled day. The comparison window is always the same-length period immediately before the window, so this makes the pre-test period the baseline. `confidenceLevel` is 0.8 to 0.999 (default 0.95). Read:
   - `groups`: per group `matchedPages`, `totalClicks`, `totalImpressions`, `prevTotalClicks`, `prevTotalImpressions`, `ctr` (0-100), `avgPosition` (impression-weighted), `clickGrowthPct` (null when the group had no clicks in the comparison window) and `ctrConfidenceInterval` (`lower`, `point`, `upper`).
   - `comparisons`: one per variant against the control, with `controlGrowthPct`, `variantGrowthPct`, `upliftPoints` (variant growth minus control growth, in percentage points), `upliftCI` (`lower`, `upper`), `pValue`, `significant` (true exactly when the uplift CI excludes 0), `ctrPValue` (a separate CTR comparison, for reference), `confidenceLevel`, `winner` (the winning group's name, set only when `significant` is true, otherwise null), `powerWarning` (true when either group has under 100 clicks in either window) and `clicksDiff`.
   - `emptyBecause` and `nextStep` when no group matched a page: the group URLs do not match the pages Search Console reports (matching ignores case, a trailing slash and www), so the zeros measure nothing. Relay `nextStep` and stop scoring.
   - `truncated` and `truncationNote`: a page read hit its row cap and low-traffic experiment pages may be missing from a group; compare `matchedPages` with each group's `urlCount` from step 2 and say how many URLs are unaccounted for.
   - `windowNormalization`, when present: growth was compared per day because the two windows differ in length.
   - `range` and `comparison`: the two windows the tool actually used; quote both in the verdict, since the user may have asked for a window the data could not cover.
   - `note`: the tool's own reading rules (control first, a winner only on a significant growth difference); where it and this skill differ, the tool's note wins.

4. **Sanity-check the series.** Call `get_page_performance` for two or three URLs from the control group and two or three from the variant group, with `pageUrl` as the full URL, `startDate` moved back by the test's length so the baseline is visible, and `endDate` as in step 3. Read the `daily` rows (`date`, `clicks`, `impressions`, `ctr`, `position`) and look for:
   - a single URL carrying the whole group's growth;
   - a URL flat at zero (not indexed, or spelled differently in the group than in Search Console);
   - a step on a date other than the test start;
   - a dip at the newest edge. GSC data lags about 2 to 3 days: never treat the most recent 2 days as complete, and if a dip appears at the very edge of the range, say it is likely reporting lag, not a real drop.
   `ctr` values are already percentages on a 0-100 scale; never multiply them by 100. `position`: lower is better; a change toward a lower number is an improvement.

5. **Confounders.** Call `list_algo_updates` with `startDate` about 14 days before the comparison window starts and `endDate` set to the test window's end, and `list_annotations` with the `siteUrl` and the same dates.
   - Each `updates` entry has `name`, `beginISO`, `endISO`, `severity` and `uri`. Only Google-confirmed updates are listed, so an empty list is not proof that nothing changed.
   - An update that overlaps the test window hits both groups in principle, but not equally when the groups differ in template, section or intent, so say which group it could bias and in which direction.
   - An annotation (a deploy, a template change, a redirect batch) dated inside the test window and touching the variant pages is a stronger confounder than the test change itself.

6. **Offer to log the conclusion.** Offer `create_annotation` with the `siteUrl`, `eventDate` (the decision date or the test's end), a `label` such as "Experiment <name>: variant rolled out", an optional `description` holding the numbers and an optional `category` (free text, up to 50 characters).
   - Show the exact values and run the call only after the user confirms. The annotation marks the chart; it does not change the experiment's status in the app.
   - If the write is refused because the connection is read-only, say that this step needs write access and finish with the read-only parts.

## Output

1. **Verdict**: the experiment's name and window, control and variant growth, the uplift in points with its CI, the p-value and whether it is significant at the chosen confidence level, and the `winner` the tool named. Put the numbers in a compact table from `groups`: group, matched pages, clicks, previous clicks, growth %, CTR, position.
2. **Is it real**: the significance call in plain words.
   - A positive `upliftPoints` with `significant: false` (and so `winner` null) is a lead, not a result.
   - `powerWarning` means the groups have too few clicks to detect a realistic uplift; say how wide the CI is.
   - Weight the judgement by the clicks at stake, not by the percentage alone: a 30% uplift on 40 clicks is worth less than 4% on 10,000.
3. **Confounders**: the overlapping updates and annotations and what each could have done to the groups.
   - Be explicit when the cause is uncertain, and do not force a narrative.
   - When a confounder lands on the variant pages only, say that the uplift cannot be attributed to the test change until the test is re-run or extended past it.
4. **Series check**: one short paragraph on what the URL-level series showed (a concentrated gain, a dead URL, a step on the wrong date), or that nothing odd showed up.
5. **Recommendation**: one of the three, with the reason:
   - roll out: a significant positive uplift, no confounder that explains it, and the gain spread across the variant URLs;
   - extend: not significant, a power warning, a CI that straddles zero while the point estimate is useful, or fewer than four weeks of post-change data;
   - stop and revert: a significant negative uplift, or variant pages dropping out of the index.
   Then a short prioritized list of 3 to 5 concrete next steps: the roll-out scope, how much longer to run, which URLs to fix in the group definition, what to annotate.

Present every multi-row result as a compact markdown table (top rows only, typically 5 to 10); keep prose for interpretation, not for restating numbers. Do not fabricate rows the tools did not return. For a property-wide read of the same period run the weekly-report skill; for pages competing with each other inside a group, the cannibalization skill.

## Error handling

If any tool call fails with an authentication or subscription error, tell the user to run `/mcp` to (re)authenticate, and that a GSC Wizard account with an active plan or trial plus a connected Google Search Console account is required. If the property is not found, re-run `list_sites` and offer the closest matches instead of guessing a URL format. If a single tool fails for another reason, report the gap in the relevant section and complete the rest of the workflow with the remaining data.

## Grounding

Every number you report must name the tool it came from and the date range it covers, for example "clicks 12,340 (`get_site_summary`, 2026-09-21 to 2026-09-27)". For a table, state the tool and date range once on the line above it. If you derive a figure yourself (a delta, a sum, a share), say so and name the tool outputs it was computed from. Never report a number no tool returned.
