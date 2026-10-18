---
name: indexnow-submit
description: Set up IndexNow for a Search Console property and submit changed URLs with the GSC Wizard MCP tools: checks that a key and its published key file are in place, generates or sets a key when needed, draws the URL set from the user's list or a sitemap, submits up to 100 URLs per batch, reads the outcome (a 202 is accepted pending key validation, not delivered), and reviews the submission history and the Bing URL-submission quota. Use when the user says "submit these URLs to IndexNow", "ping Bing about my new pages", "set up IndexNow", "did my IndexNow submissions go through", or wants Bing told about changed pages.
---

# IndexNow Submit

Get IndexNow working for one property and submit a set of changed URLs to it. The output is the setup status, what was submitted with each URL's response, and what to check later. The user's request may contain a property, a list of URLs, a path prefix or sitemap URL to draw URLs from, and an action hint ("set up", "rotate", "submit", "history"). IndexNow reaches the engines that take part in it (Bing, Yandex, Seznam); it tells Google nothing, so say so when the user's goal is Google indexing and point them to the indexing-tracker skill for that.

## Workflow

1. **Resolve the property.** If the user's request or the conversation names a property, use it. Site URLs use GSC formats: `sc-domain:example.com` or `https://www.example.com/`. Otherwise call `list_sites` and pick the obvious match. If several plausible properties exist, ask the user which one before continuing. The IndexNow tools take the GSC `siteUrl`; when the user also cares about the Bing side, `list_bing_sites` shows which sites Bing has verified (`siteDetails[].isVerified`), and `notConfigured: true` there means Bing Webmaster Tools is not connected in the GSC Wizard app.

2. **Check the setup.** Call `get_indexnow_settings` with `siteUrl` and read `indexnowApiKeySet`, `indexnowApiKeyMasked` (the last four characters only), `keyFileVerified` and `keyFileUrl`. Both halves must hold before engines accept anything: a key stored, and the key file reachable on the site. Read `keyFileVerified` as follows:
   - `true`: ready, go to step 4.
   - `false`: the file is missing or holds the wrong key, and `keyFileUrl` names the exact file to publish; hand that to the user before submitting anything.
   - `null`: the probe was inconclusive (a timeout or a bot rule), which is not a failure and does not block a submission.
   `keySiteUrl`, when present, means another of the owner's properties that covers this one already holds the key, so no new key is needed. With no key set at all, go to step 3.

3. **Create, set or rotate the key (write).** Say what will happen and ask for confirmation first. Pass `siteUrl` and exactly one mode to `update_indexnow_settings`:
   - `generateKey: true` creates a key and returns `keyFileUrl`, `keyFileUrls` (every host of a domain property) and `keyFileContent`. The user must publish `keyFileContent` as a plain-text file at each of those URLs before any submission validates; a key generated this moment is not probed, so `keyFileVerified` reads `false` until they do. It refuses to replace an existing key.
   - `indexnowApiKey` (8 to 128 letters, digits and hyphens) sets a key the site already publishes; the file is checked at once and `keyFileVerified: true` means submissions can start.
   - `clear: true` removes the key and disables submissions. To rotate, run `clear: true`, then `generateKey: true`, then have the file republished.
   After the user publishes the file, call `get_indexnow_settings` again and only proceed on `keyFileVerified: true` (or `null`). If the write is refused because the connection is read-only, say this step needs write access and continue with the read-only parts (steps 2, 4, 6 and 7).

4. **Choose the URL set.** IndexNow is for URLs that were added, updated or removed, so do not submit a whole site because it exists. Draw the set from:
   - The user's list first (new pages, pages just updated, URLs just taken down).
   - A section or a sitemap: call `list_sitemaps` (each sitemap's `path`, `lastSubmitted`, `lastDownloaded`, `warnings` and `errors`), then `get_sitemap_performance` with `sitemapUrl`, optional `startDate`/`endDate` (the last 28 settled days by default) and `maxUrls` (default 500, max 2000); keep the URLs matching the user's prefix. Its rows carry `clicks`, `impressions`, `ctr` (already a percentage on a 0-100 scale; never multiply by 100) and `position` (lower is better), so URLs with zero impressions are the ones most worth a ping, with the caveat that `truncated: true` means a zero may be unknown rather than real.
   - The Indexing Tracker's not-indexed list: run the indexing-tracker skill and reuse it.
   Keep only absolute URLs on the property; the tool drops any other and reports them in `skippedOffProperty`.

5. **Submit (write).** List the exact URLs with the count, explain that a 202 means accepted with key validation pending (not delivered, not indexed), and ask for confirmation. Call `submit_indexnow_urls` with `siteUrl` and `urls` (1 to 100 per call; split a larger set into batches and confirm each); a read-only connection refuses this call too. The tool probes the key file per host before sending anything. Read `outcome`:
   - `submitted`: IndexNow validated the key (response 200).
   - `pending_key_validation`: accepted (202); the engines fetch the key file afterwards and drop the batch without notice if it is unreachable.
   - `setup_incomplete`: the key file is missing or wrong on at least one host, nothing was sent for that host, and `message` names the file to publish; such a batch is not written to history.
   - `rejected`: IndexNow refused what was sent (403 key not valid, 422 URLs not on the host, 429 rate limited, 0 never reached IndexNow).
   Also read:
   - `submitted` (the accepted count), `failed` and `attempted`;
   - `keyFile[]` (`host`, `verified`, `error`, and `url` naming the key file when that host needs attention), one entry per host that was probed;
   - `submissions[]` (`url`, `responseCode`, `status`, `accepted`) and the `actions` the tool derived from them;
   - `historyLogged` (`false` means the batch went out but is missing from history) and `skippedOffProperty`.
   The per-URL `responseCode` values mean the following, and `status` spells each one out:

| Code | Meaning | What to do |
|---|---|---|
| 200 | submitted, key validated | nothing |
| 202 | accepted, key validation pending | keep the key file reachable; a batch whose file cannot be fetched is discarded |
| 403 | rejected: key not valid | fix the key file, then resubmit |
| 422 | rejected: URLs not on the host, or key schema mismatch | submit only URLs on the same host as the key file |
| 429 | rate limited | wait, then resubmit the URLs that were not accepted |
| 0 | not sent: the request never reached IndexNow, or the host's key file failed the probe (`status` says which) | resubmit; in the second case publish the key file first |

6. **Bing quota (optional).** When the user also submits to Bing directly or asks how much Bing allows, call `get_bing_url_submission_quota` with `siteUrl` and read `dailyQuota` and `monthlyQuota`. This is Bing Webmaster's own URL-submission allowance, separate from IndexNow, which the tool does not meter. `notConfigured: true` with a `hint` means Bing Webmaster Tools is not connected for this property in the GSC Wizard app; say so and continue.

7. **History.** Call `list_indexnow_submissions` with `siteUrl` and `limit` (default 100, max 500) to confirm the batch is stored and to show earlier ones: `submissions[]` carry `url`, `response_code`, `batch_id`, `source` and `submitted_at`, newest first, with `total` as the full count. Batches refused before sending are deliberately absent. A history full of 202s next to `keyFileVerified: false` in step 2 means those batches were never validated, which is the most common reason IndexNow appears to do nothing.

## Output

1. **Setup status**: key set or not (masked), key file verified, missing or inconclusive, the file to publish when one is needed, and whether the key comes from a sibling property.
2. **What was submitted** (`submit_indexnow_urls`), as a compact markdown table of the top rows, typically 5 to 10, with counts for the rest; state `outcome`, `submitted` of `attempted`, the off-property URLs that were skipped, and the `actions` the tool returned:

| URL | Response | Status | Accepted |
|---|---|---|---|

3. **What to check later**: when the key file was unverified, re-run `get_indexnow_settings` after publishing and resubmit; re-read `list_indexnow_submissions` for the batch; and use the Bing tools or the indexing-tracker skill to see whether the pages appear, since IndexNow itself never confirms indexing. Name every step a read-only connection refused.
4. End with a short prioritized list of 3 to 5 concrete recommendations. Keep prose for interpretation, not for restating numbers. Do not fabricate rows the tools did not return.

## Error handling

If any tool call fails with an authentication or subscription error, tell the user to run `/mcp` to (re)authenticate, and that a GSC Wizard account with an active plan or trial plus a connected Google Search Console account is required. If the property is not found, re-run `list_sites` and offer the closest matches instead of guessing a URL format. If a single tool fails for another reason, report the gap in the relevant section and complete the rest of the workflow with the remaining data.

## Grounding

Every number you report must name the tool it came from and the date range it covers, for example "clicks 12,340 (`get_site_summary`, 2026-09-21 to 2026-09-27)". For a table, state the tool and date range once on the line above it. If you derive a figure yourself (a delta, a sum, a share), say so and name the tool outputs it was computed from. Never report a number no tool returned.
