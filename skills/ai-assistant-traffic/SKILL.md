---
name: ai-assistant-traffic
description: Measure the traffic and the search queries that AI assistants send to one property from the user's own first-party data via the GSC Wizard MCP server: GA4 sessions, conversions and revenue referred by assistants with their share of all traffic, the Search Console query-shape classification that spots AI-conversation fingerprints (reply artefacts, pivot follow-ups, conversational questions, tracker probes, agent harnesses), the AI-shaped share trend by month or week, and the pages serving those queries. Use when the user asks "how much traffic do I get from AI assistants", "is AI traffic growing", "AI Mode or AI Overviews impact", "LLM referrals in GA4", or "weird long queries in Search Console".
---

# AI Assistant Traffic

Report how much of one property's traffic comes from AI assistants and what the shape of its search queries says about AI-driven use, from GA4 referrals and Search Console queries only. The user's request may contain a property, a date range, a focus hint (one assistant, one section of the site, "trend only"), or a search type; honor it and resolve the rest below.

## Workflow

1. **Resolve the property.** If the user's request or the conversation names a property, use it. Site URLs use GSC formats: `sc-domain:example.com` or `https://www.example.com/`. Otherwise call `list_sites` and pick the obvious match. If several plausible properties exist, ask the user which one before continuing. Use the last 28 days compared with the previous period unless the user specifies dates; the trend step uses complete months. GSC data lags about 2 to 3 days: never treat the most recent 2 days as complete, and if a dip appears at the very edge of the range, say it is likely reporting lag, not a real drop. The GA4 tool reads the same settled window when the dates are omitted; when explicit dates reach the last day or two, say GA4 may still be processing them.

2. **Assistant referrals in GA4.** Call `get_ga4_llm_traffic` with `siteUrl`, `comparisonStartDate` and `comparisonEndDate` set to the previous period (without both, the `prev*` fields are 0 and `hasComparison` is false), `limit: 25` landing-page rows (max 1000) and `includeDailySplit: true` only when the user wants a daily series (`sourceTimeseries`, one point per assistant per day). When the tool reports no assistant sessions at all, say that plainly (its `emptyBecause` says whether the property had any sessions in the window); otherwise read the response in four parts:
   - The totals: `summary` (sessions, active, total and new users, page views, `engagementRate`, `averageSessionDuration`, `bounceRate`, event count and key events, all for assistant-referred sessions) against `prevSummary`, `totalSessions` for the whole property, and `llmShareOfSessions` (a 0-1 fraction; multiply by 100 for display) against `prevLlmShareOfSessions`.
   - The `assistants` table: one row per assistant under the name the tool puts in `key`, with sessions, activeUsers, engagedSessions, `engagementRate`, keyEvents, totalRevenue, transactions and addToCarts, sorted by sessions. Present the rows under those names and never rename or merge them.
   - The `landingPages` table: where assistant visitors land, with sessions, activeUsers, `bounceRate`, keyEvents and totalRevenue; `hasEcommerce` says whether `ecommerceSummary` carries revenue (`currencyCode`).
   - The caveats, which go into the report: `methodLimits` says that Google's own AI surfaces pass no distinct referrer, so their visits count as google / organic and are not in these numbers; and, by the tool's contract, an assistant's activeUsers adds up its referrer domains, so a user who arrived through two of them counts twice (`summary.activeUsers` is exact).

3. **Query shapes.** Call `analyze_query_shapes` with `siteUrl`, `examplesPerBucket: 10` (0-100; 0 returns counts only) and the default `searchType: "web"`. The tool classifies every visible query by how it looks, in 27 languages, into buckets returned in `bucketOrder` with the conventional bucket last; each carries `label`, `queries`, `clicks`, `impressions`, `shareOfQueriesPct` and `shareOfImpressionsPct` (0-100), `zeroClickQueries`, `avgPosition` and `examples` (query, clicks, impressions, `ctr` as 0-100, position, `language`, `signals`), plus the `aiShaped` roll-up of the three conversational buckets with the same shares. Read the buckets this way:

| Bucket | What it is | What it signals |
|---|---|---|
| `reply_artefact` | bare mid-conversation replies ("yes", "show me") | a person answered an assistant and the reply reached Google as a search |
| `pivot_follow_up` | mid-conversation comparisons ("what about ...", "how about in ...") | the searcher asked the assistant to test an alternative |
| `conversational_question` | questions addressed to a listener ("is it free", "how do i sell it") | spoken-style intent; pages that answer plainly are being used as answers |
| `tracker_probe` | synthetic prompts from AI visibility tools | machine-generated; exclude from keyword opportunity work |
| `agent_harness` | full machine instructions logged as one query | an agent's prompt hit Google Search; the page is read by software, not a person |
| `search_operator` | operator syntax (`site:`, `filetype:`) logged as the query | SEO tools, extensions or fan-out crawlers, not someone at the search box |
| `pasted_string` | error messages, headers and other copy-pasted text | troubleshooting intent; the page serves as a reference |
| `long_uncategorised` | 10+ words with no clearer marker | human or machine; review by hand |

Pass `buckets: ["reply_artefact", "pivot_follow_up", "conversational_question"]` on a second call only when the user wants the AI-conversation shapes alone. Shares are of visible queries only: `coverage.hiddenClicksShare` (0-1) is the share of the property's clicks with no query row, and on a capped read the response says the long tail past the cap was never classified, which is where AI-shaped queries sit, so an empty bucket is a finding over what was classified, not proof of absence. Single rows are evidence, not proof, because the classifier judges form, not intent.

4. **The trend.** Call `get_query_shape_trend` with `siteUrl`, `months: 12` (1-16, ending with the last complete month) and `granularity: "month"`; use `"week"` for a short recent window, and pass both `startDate` and `endDate` to override the default window.
   - `periods` holds one row per period, oldest first, with `aiClicks`, `aiImpressions`, `conventionalClicks`, `conventionalImpressions`, `totalClicks`, `totalImpressions`, `aiShareOfClicksPct` and `aiShareOfImpressionsPct` (0-100).
   - Compare the latest complete period's share with the earliest, and with the same period a year back when the window allows; a share that climbs while `totalClicks` is flat means AI-shaped demand is replacing conventional demand, not adding to it.
   - `truncated: true` with `truncationNote` means the AI-shaped series may be understated while the totals stay exact, so narrow the window or use month granularity before concluding. Period totals are of visible query rows, again with `coverage.hiddenClicksShare`.

5. **Pages behind the AI-shaped queries.** Take the top 5 to 10 example queries by impressions from the `reply_artefact`, `pivot_follow_up` and `conversational_question` buckets and call `query_search_analytics` with `siteUrl`, `dimensions: ["query", "page"]` and `rowLimit: 100` (`startRow` with `pagination.nextOffset` pages further).
   - Filter with one entry, `{ dimension: "query", operator: "includingRegex", expression: "^(first query|second query|third query)$" }`, each query regex-escaped (RE2: no lookahead, no backreferences). Filters are AND-joined, so one anchored alternation covers the set in a single call; split it over two calls when the expression grows long.
   - Rows carry clicks, impressions, `ctr` (0-100) and position per query and page; group them by page to see which URLs serve assistant-shaped demand.
   - Match those pages by path against the `landingPages` table from step 2 to see whether the same pages also receive assistant referrals and how they convert (GA4 landing pages are paths, GSC pages are full URLs); mark that join as derived.

## Interpretation rules

- `llmShareOfSessions`, `engagementRate` and `bounceRate` from GA4 are 0-1 fractions; the `*Pct` shares from the query-shape tools and every `ctr` are already 0-100 percentages, so never multiply them by 100. `position`: lower is better.
- Present every multi-row result as a compact markdown table (top rows only, typically 5 to 10); keep prose for interpretation, not for restating numbers. Weigh by sessions, clicks and impressions at stake, not by percentage alone: a share that doubled from 0.2% to 0.4% is still small.
- Do not fabricate rows the tools did not return. Keep assistant names exactly as the `assistants` rows carry them, and never attribute a query to a specific assistant, since Search Console records none.
- Recommendations stay inside these numbers: which pages to keep accurate, current and fast because assistants send people to them, which converting landing pages deserve the same care, where key events or revenue tracking is missing on assistant landing pages, and which tracker-probe or harness queries to exclude from keyword work. Do not add speculative advice about how to appear in assistants.
- For the wider search picture refer the agent to the site-audit skill, and for the conversions and revenue behind these pages to the ga4-overview skill.

## Output

1. **Share and trend**: assistant sessions, their share of all sessions and the change against the previous period (`get_ga4_llm_traffic`), then the AI-shaped share of clicks and impressions by period (`get_query_shape_trend`).
2. **Assistants and landing pages**: the per-assistant table and the landing-page table with engagement, key events and revenue where present (`get_ga4_llm_traffic`).
3. **Query shapes**: the bucket table with counts and shares, the top examples of the three conversational buckets, and the coverage caveat (`analyze_query_shapes`).
4. **Pages serving AI-shaped queries**: the per-page table from step 5, joined to the GA4 landing pages where they overlap (`query_search_analytics`, with the join marked as derived).
5. End with a short prioritized list of 3 to 7 concrete recommendations grounded in the data above.

## Follow-up

When the user wants every referral source rather than assistants alone, call `query_ga4_report` with `dimension: "sourceMedium"` and the same dates; when they want the daily shape of one assistant's visits, rerun `get_ga4_llm_traffic` with `includeDailySplit: true` and read `sourceTimeseries`. Run either only when asked.

## Error handling

If any tool call fails with an authentication or subscription error, tell the user to run `/mcp` to (re)authenticate, and that a GSC Wizard account with an active plan or trial plus a connected Google Search Console account is required. If the property is not found, re-run `list_sites` and offer the closest matches instead of guessing a URL format. If a single tool fails for another reason, report the gap in the relevant section and complete the rest of the workflow with the remaining data.

`get_ga4_llm_traffic` answers `notConfigured: true` instead of data when `reason` is `no_scope` (Google Analytics is not connected in the GSC Wizard app for the account in `account`; with `reauthRequired: true` it is connected but has to be reconnected there) or `no_property` (no GA4 property is linked to this site under that account): relay `hint`, say which it was, and run steps 3 to 5, which need only Search Console. A refusal with `reason: "google_token_unavailable"` is temporary and worth one retry; `ga4_not_shared` means the owner has not enabled GA4 access on the share, which only the owner can change.

## Grounding

Every number you report must name the tool it came from and the date range it covers, for example "clicks 12,340 (`get_site_summary`, 2026-09-21 to 2026-09-27)". For a table, state the tool and date range once on the line above it. If you derive a figure yourself (a delta, a sum, a share), say so and name the tool outputs it was computed from. Never report a number no tool returned.
