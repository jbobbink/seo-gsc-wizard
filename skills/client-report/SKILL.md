---
name: client-report
description: Produce a client-facing SEO report for a Search Console property and share it through the GSC Wizard client portal: generates the full report with generate_seo_report (ready-to-open HTML, a compact digest with a drill per section, or JSON), saves a table of the key rows as a shareable report, adds the client contact, grants access and hands back the share URL with who can open it, and audits or deletes earlier reports. Use when the user says "make a report for my client", "share this with the client", "create a shared report", "give my client access to the report", "who can see my shared reports", or "delete that shared report".
---

# Client Report

Turn one property's performance into a deliverable a client can open: a self-contained HTML report, a client-portal table, or both. The output is the report summary for the user, the exact share URL with who has access to it, and the next steps. The user's request may contain a property, a date range or `days`, the client's email and name, a title, a focus (queries, pages, movers), and whether the user wants the HTML file, the portal link or both. For the content of a weekly digest, run the weekly-report skill and bring its mover tables here.

## Workflow

1. **Resolve the property and the window.** If the user's request or the conversation names a property, use it. Site URLs use GSC formats: `sc-domain:example.com` or `https://www.example.com/`. Otherwise call `list_sites` and pick the obvious match. If several plausible properties exist, ask the user which one before continuing. Use the last 28 days compared with the previous period unless the user specifies dates; `generate_seo_report` sizes both windows from `days`. GSC data lags about 2 to 3 days and the tools count back from the latest settled date, so state the dates the response reports (`range`, `comparison`) rather than implying the report runs through today, and if a dip appears at the very edge of the range, say it is likely reporting lag, not a real drop.

2. **Confirm the deliverable.** Ask, or infer from the user's request, what the client gets and who receives it (email, optional name):
   - the HTML report: one self-contained file the user forwards or uploads;
   - a portal table: one URL behind a client login, which the user sends once access is granted;
   - both, with the portal table carrying the one table the client will look at most.
   Every write step below lists what it will create and waits for the user's yes, and all of them need write access. If a write is refused because the connection is read-only, say so and complete the read-only parts.

3. **Generate the report.** Call `generate_seo_report` with `siteUrl`, `days` (7 to 180, default 28), `format` and `includeSitemap` (default `true`; `false` skips the sitemap fetch). Choose `format` by use:
   - `html` (the default): a finished, self-contained report in `html`, with `bytes` as its size. Save that string as a `.html` file and hand the file to the user; do not paste it into the conversation.
   - `compact`: a few numbers per section in `sections` (`summary`, `trend`, `topQueries`, `topPages`, `countries`, `devices`, `ctrCurve`, `opportunities`, `rankingByQuery`, `rankingByPage`, `decay`, `cannibalization`, `sitemaps` and more), each with a `drill` naming the tool and the exact arguments that reproduce it. Use it to narrate the report in chat and to fetch full rows for the portal table over the same window.
   - `json`: every sub-result in full, which is large; only when the user asks for the raw data.
   Every format carries `highlights` (`kpis`, `topQueries`, `topPages`, `movers`), `range`, `comparison`, `settledThrough` and `dataSource`. One call fans out to about twenty reads, so call it once per format you need, not once per question. `ctr` values are already percentages on a 0-100 scale; never multiply them by 100. `position`: lower is better, so a change toward a lower number is an improvement; never color it as a decline. Weight the story by the clicks and impressions at stake, not by percentages alone.

4. **Assemble the portal rows.** A shared report is one table, so pick the rows the client should see:
   - the `topQueries` or `topPages` drill, which is `query_top_queries` or `query_top_pages` with `siteUrl`, `startDate`, `endDate` and `limit` (default 100);
   - `get_ranking_changes` for movers, with `startDate`/`endDate`, `comparisonStartDate`/`comparisonEndDate`, `dimension` (`query` or `page`) and `limit` per bucket;
   - a table the weekly-report skill produced.
   Keep each row an object holding the fields to show, and define `columns` in display order with `key`, `label` and `type`:
   - `number` for clicks, impressions and position; the portal formats these as numbers.
   - `text` (the default) for everything else. The tool also accepts `percent`, `url` and `date`, but the portal renders those as plain text today, so round `ctr` to two decimals yourself and put the unit in the label ("CTR (%)") rather than relying on the type.
   Up to 5,000 rows and 50 columns are accepted; 10 to 100 rows is a client-sized table.

5. **Create the shared report (write).** Show the user the `title`, the row count, the columns and the dates, then call `create_shared_report` with `title`, `rows`, `columns`, `siteUrl`, `dateRange` (`startDate`, `endDate`) and, when there is one, `comparisonRange`; `reportType` is a free label (default `mcp`) and `dataSourceType` one of `inline` (default), `queries`, `pages`, `countries`, `rankings`, `content-group`, `page-performance` or `migration`. Read the response:
   - `report.reportId`, the id the grant and delete tools take, and `report.url`, the portal link;
   - `report.rowCount` and `report.createdAt` for the summary;
   - `note`, which repeats that the URL opens for nobody, not even the user, until step 7 grants access. Say that plainly and do not hand the URL out yet.
   An account holds at most 50 reports; on a limit error, list them with `list_shared_reports` and offer to delete an old one.

6. **Find or add the client (write).** Call `list_report_clients` (`limit`, default 100) and match the email in `clients[]` (`clientId`, `email`, `name`). If absent, confirm the email and name with the user, then call `create_report_client` with `email` and optional `name`; `created: false` means the address already existed and the existing `client` came back. This sends no email and grants nothing by itself.

7. **Grant access (write).** Confirm the pairing, then call `manage_report_access` with `reportId`, `action: "grant"` and `clientIds` (1 to 100). Read the result:
   - `granted`: the clients who gained access in this call;
   - `alreadyHadAccess`: repeats, so nothing changed for them;
   - `unknownClientIds`: ids that do not belong to the account, so no grant happened for them;
   - `emailsSent`, always 0: the tool never notifies anyone.
   Give the user the `url` to send themselves; the client opens it, enters the granted email, and GSC Wizard mails them a login link. The app's Account > Shared Reports page can send that mail with its Resend button.

8. **Audit and clean up.** Three tools cover the lifecycle after the share:
   - `list_shared_reports` (`limit`, default 50, max 100) lists every report with its `url` and `sharedWith[]` (`clientId`, `email`, `name`, `grantedAt`); `unsharedCount` says how many open for nobody.
   - `manage_report_access` with `action: "revoke"` withdraws a client's access and reports `revoked` and `didNotHaveAccess`; confirm first, since the client loses the link at once.
   - `delete_shared_report` with `reportId` removes a report and every grant on it and breaks the link for anyone holding it, so name the title and ask for confirmation first.

## Output

1. **Report summary** for the user: the headline KPIs from `highlights.kpis` with their comparison, the top movers, and two or three sentences on what the client should take from it, each number with its tool and dates.
2. **The deliverable**: the saved HTML file path, and/or the portal table as a compact markdown preview (the top 5 to 10 rows, with the full count stated).
3. **Share status**, as a compact markdown table; the status reads "opens for nobody yet" until a grant exists, then "granted, no email sent":

| Report | URL | Granted to | Status |
|---|---|---|---|

4. **Next steps**: send the URL to the client, optionally trigger the login email from Account > Shared Reports, revoke or delete when the engagement ends, and regenerate on the next cycle with the same `days` so the periods line up. Keep prose for interpretation, not for restating numbers. Do not fabricate rows the tools did not return.

## Error handling

If any tool call fails with an authentication or subscription error, tell the user to run `/mcp` to (re)authenticate, and that a GSC Wizard account with an active plan or trial plus a connected Google Search Console account is required. If the property is not found, re-run `list_sites` and offer the closest matches instead of guessing a URL format. If a single tool fails for another reason, report the gap in the relevant section and complete the rest of the workflow with the remaining data.

## Grounding

Every number you report must name the tool it came from and the date range it covers, for example "clicks 12,340 (`get_site_summary`, 2026-09-21 to 2026-09-27)". For a table, state the tool and date range once on the line above it. If you derive a figure yourself (a delta, a sum, a share), say so and name the tool outputs it was computed from. Never report a number no tool returned.
