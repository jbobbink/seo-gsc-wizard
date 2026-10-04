---
name: site-audit
description: Run a comprehensive SEO health audit of a single Search Console property using the GSC Wizard MCP tools, covering a 28-day performance overview with comparison, ranking mix, significant movers, anomalies, content decay, cannibalization, opportunity scoring, and Core Web Vitals, synthesized into a health verdict, top risks, top opportunities, and a prioritized action plan. Use when the user says things like "audit my site", "SEO health check", "how is my site doing in search", "give me a full SEO audit", or asks for an overall assessment of a property's organic search health.
---

# Site Audit

Run a full SEO health audit of one property and synthesize the results into a verdict and action plan. `$ARGUMENTS` may contain a property name or URL and an optional focus hint (for example "focus on decay"); honor the hint by going deeper on that section, but still run the full audit.

## Step 1: Resolve the property

1. If `$ARGUMENTS` or the conversation names a property, use it. Site URLs use GSC formats: `sc-domain:example.com` or `https://www.example.com/`.
2. Otherwise call `list_sites`. If exactly one plausible property matches, use it and say so. If several match, show them in a short table and ask the user which one before proceeding.
3. Use the last 28 days compared with the previous period unless the user specifies dates. You may omit date parameters entirely; the performance tools default to the last 28 settled days with the prior same-length period as comparison. GSC data lags about 2 to 3 days: never treat the most recent 2 days as complete, and if a dip appears at the very edge of the range, say it is likely reporting lag, not a real drop.

## Step 2: Gather the data

Call these tools for the resolved property. Keep going if one fails; note the gap and continue.

4. `get_site_summary`: clicks, impressions, CTR, and average position with the prior-period comparison. This anchors the verdict.
5. `get_position_distribution`: the ranking mix across bands (1-3, 4-10, 11-20, 21+). Note where impressions concentrate and whether the mix shifted versus the comparison period.
6. `get_ranking_changes`: new, lost, improved, and declined queries between the two periods. Pull the largest movers by click impact.
7. `detect_anomalies`: anomalous spike or drop days for clicks over the range. Record severity and dates; cross-reference dates with the movers from step 6.
8. `get_decay_overview`: the decay pressure picture (per-query or per-page metric matrix over recent complete months; this tool defaults to whole months rather than the 28-day window). Judge how much of the property's traffic sits in decaying rows versus stable or growing ones.
9. `analyze_cannibalization`: queries where two or more pages compete, scored by impression-split entropy. Keep this high level: report how widespread it is and the 3 to 5 worst affected queries, not an exhaustive list.
10. `score_opportunities`: impression-weighted opportunities favoring near-threshold positions with low current CTR (positions 3-30). These are the fastest wins.
11. `get_core_web_vitals`: CrUX field data with ratings and week-over-week regressions. If it returns `notConfigured`, say a CrUX API key is not set up in the app and skip page experience rather than guessing.

## Step 3: Interpretation rules

- `ctr` values are already percentages on a 0-100 scale. Never multiply them by 100.
- `position`: lower is better. A change toward a lower number is an improvement; describe it as such and never color it as a decline.
- Present every multi-row result as a compact markdown table (top rows only, typically 5 to 10); keep prose for interpretation, not for restating numbers.
- Weight findings by click and impression volume: a 50% drop on a 10-click query matters less than a 5% drop on the top page.

## Step 4: Synthesize the audit

Produce these four sections, in order:

12. **Overall health verdict.** One short paragraph plus a one-word rating (Healthy, Stable, At Risk, or Declining). Base it on the summary trend, the position-distribution shift, anomaly severity, and decay pressure combined, not on any single metric.
13. **Top 3 risks.** Ranked, each with the evidence (which tool, which numbers) and the traffic at stake. Draw from declines, anomaly drops, decay concentration, cannibalization, and CWV regressions.
14. **Top 3 opportunities.** Ranked, drawing mainly from `score_opportunities` and improved-but-not-yet-page-1 movers. Quantify the upside where the data allows (impressions available at the current position).
15. **Prioritized action plan.** End with a short prioritized list of concrete recommendations, numbered and ordered by expected impact and effort. Each item names the specific pages or queries to act on and the action (refresh content, consolidate competing pages, improve title/meta for CTR, fix the regressing vital, investigate the anomaly date). Aim for 4 to 7 items.

## Error handling

- If any call fails with an authentication or subscription error, stop and tell the user to run `/mcp` to (re)authenticate, and that a GSC Wizard account with an active plan or trial plus a connected Google Search Console account is required.
- If the property is not found, re-run `list_sites` and offer the closest matches instead of guessing a URL format.
- If a single analysis tool fails for another reason, report the gap in the relevant section and complete the audit with the remaining data.
