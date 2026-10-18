---
name: property-setup
description: Onboard a new client site into GSC Wizard and get it ready for the other skills; checks the account and plan with get_account_info, inventories list_sites, registers Search Console properties with add_site or creates folder-level ones with create_gsc_property, shows them on the dashboard, sets tags, branded keywords, sitemap URLs and crawl rate with update_site, manages filter presets, unregisters a property on request, and hands back a setup checklist and the first skills to run. Use when the user says "add my site", "onboard a new client", "set up this property", "register example.com", "create a property for /blog/", "set branded keywords", "save a filter preset" or "remove this property".
---

# Property Setup

Take a property from "not in GSC Wizard" (or half configured) to ready for the analysis skills, and hand back a checklist of what was done and what still needs the user. `$ARGUMENTS` may contain the property (a GSC site URL or a recognizable site name), a client name to use as a tag, brand terms, sitemap URLs, folder paths to create as separate properties, filter presets to save, or a request to remove a property; honor what is given and ask for the rest only when a step needs it.

## Workflow

1. **Check the account first.** Call `get_account_info` (no arguments) and read:
   - `googleAccounts` (`email`, `scopes`, `isPrimary`): an empty list with `emptyBecause` means no Google account is connected, so send the user to tool.gscwizard.com/account unless they only use properties shared with them.
   - `subscription` (`plan`, `status`, `currentPeriodEnd`, `cancelAtPeriodEnd`) and `access.level`: `paid` means the property tools will run. A `payment_required` refusal on this first call means there is no running trial or active paid plan (the free tier serves only the GSC Wizard mobile app, so from an MCP client every tool refuses): tell the user to start or renew a plan at tool.gscwizard.com/settings/subscription, mark every step as blocked, and stop. `unknown`, or a `warning` saying a read failed, means retry before acting on those fields.
   - `apiKey.scope`: `read` means every write below needs write access, so report those steps as "needs write access" instead of attempting them.

2. **Inventory what is registered.** Call `list_sites` (no arguments) and show a compact table of `siteUrl`, `tags`, `permissionLevel`, `readable`, `activated`, `gscScope` and, on shared rows, `sharedBy` and `accessLevel`. Read the flags like this:

   | Flag | Meaning | What to do |
   |---|---|---|
   | `readable: false` | Listed in Search Console but not verified (`permissionLevel` is `siteUnverifiedUser`); Google refuses every data request | The user verifies it at search.google.com/search-console; no tool here can fix it |
   | `activated: false` | Registered but hidden from the dashboard and not synced; every other property-scoped tool refuses it | Show it in step 5 |
   | `gscScope: "readonly"` | The Google connection behind it has read-only Search Console access; Google refuses `submit_sitemap` and `create_gsc_property` | The user reconnects that Google account with full access in the app |
   | `sharedBy` present | Someone else's property; `accessLevel` `READ_ONLY` refuses every write in this skill, `FULL` allows `update_site` and presets | Only the owner can delete it or create properties under it |

   If the user's property is already listed, skip to step 5 or 6. An empty list carries `emptyBecause` and `nextStep`; relay them.

3. **Register a property that already exists in Search Console.** If `$ARGUMENTS` or the conversation names a property, use it. Site URLs use GSC formats: `sc-domain:example.com` or `https://www.example.com/`. If several plausible properties exist, ask the user which one before continuing. List the exact URL and tags, confirm, then call `add_site` with:
   - `siteUrl`: must already be in Search Console and verified for a connected Google account; the scheme and host match case-insensitively and a missing trailing slash is added, but nothing is provisioned.
   - `tags` (optional, up to 20 strings), for example the client name.

   Read `alreadyRegistered` (`true` is not an error; read `message` and `accountRepaired`) and `site.activated`, which says whether step 5 is still needed. A not-found error names the closest verified URLs in the user's Search Console (often the domain form of a URL-prefix property, or the reverse): retry with that exact URL rather than guessing. A "not verified" error carries the verification instructions; relay them and mark the property as blocked.

4. **Create folder-level properties that do not exist yet.** For separate section properties (a blog, a docs folder, a language folder), list the exact URLs, say that this creates properties in Search Console itself, confirm, then call `create_gsc_property` with:
   - `parentSiteUrl`: a property the user owns, already registered, whose Google account owns the domain (`gscScope: "full"` is needed, and a shared parent is refused).
   - `propertyUrls`: 1 to 50 absolute URL-prefix URLs, each on the parent's domain or a subdomain of it.
   - `register`: defaults to true.

   Read `created`, `failed`, `registered` and `results[]` (`url`, `created`, `registered`, `error`). Created properties are registered hidden and consume no plan slot until step 5 shows them.

5. **Show the property on the dashboard.** Say that showing a property consumes one dashboard slot of the plan, confirm, then call `set_dashboard_visibility` with `siteUrls` (1 to 100 registered URLs) and `visible: true`. Read `updated`, `unchanged`, `notRegistered` and `slots` (`used`, `limit`, `plan`). A refusal that starts "Dashboard property limit reached" names the plan, the slots in use and the limit: report those numbers and offer to hide another property first (`visible: false` deletes nothing and can be undone at any time) or to upgrade. Properties synced to full storage are always shown and consume no slot. From here on the other tools accept the property.

6. **Set the property's metadata.** List the exact field values, confirm, then call `update_site` with `siteUrl` and only the fields to change:
   - `tags`: up to 20.
   - `brandedKeywords`: up to 500; a plain word matches anywhere in a query, `/pattern/` is a regular expression, and a keyword that cannot compile is refused with nothing saved. This is the one setting the other skills depend on: the branded reports and the `brand` scope on summaries do nothing without it, so ask for every spelling of the brand, its abbreviations and product names.
   - `sitemapUrls`: up to 50 absolute URLs that GSC Wizard stores for the property; this submits nothing to Google. Call `list_sitemaps` with `siteUrl` first and read `sitemaps[]` (`path`, `lastDownloaded`, `warnings`, `errors`; ignore `contents[].indexed`, which Google has deprecated), then pass the real paths. If Search Console lists no sitemap (`emptyBecause`), say that `submit_sitemap` (up to 20 published sitemap URLs, needs `gscScope: "full"`) registers one with Google and that the sitemap-audit skill covers it.
   - `crawlMaxConcurrency` (1 to 10) and `crawlMinDelayMs` (0 to 60000): how fast the on-page audit, link crawler and feed audit may fetch the site. Lower them if the site answers 429; `null` returns either to the app default.

   The response `site` echoes `tags`, `brandedKeywords`, `sitemapUrls` and `crawlRateEffective`.

7. **Saved filter presets.** Call `list_saved_filters` with `siteUrl`: `filters[]` rows carry `id`, `name`, `filters` (the rows), `filterLogic` and `createdAt`, newest first. To add one, list the exact preset, confirm, then call `create_saved_filter` with `siteUrl`, `name` (up to 200 characters), `filters` and `filterLogic` (`and`, the default, or `or`). Each filter row is:

   | Field | Allowed values |
   |---|---|
   | `dimension` | `query`, `page`, `country`, `device`, `branded` |
   | `operator` | `contains`, `equals`, `not_contains`, `not_equals`, `regex` |
   | `value` | non-empty; `MOBILE`, `DESKTOP` or `TABLET` for device; ISO-3166-1 alpha-3 codes such as `NLD,BEL` for country; exactly `branded` or `non_branded` for branded |

   Useful starter presets for a new client: a non-branded view (`branded` equals `non_branded`, which needs the branded keywords of step 6), the main market (`country` equals its code) and the key section (`page` contains `/blog/`). Saving a preset applies nothing by itself; it appears in the property's presets for the user to pick. `update_saved_filter` takes `filterId` plus `name` and/or `filters`; the rows are replaced wholesale, so read the current rows first and pass `filterLogic` with them or the preset resets to `and`. `delete_saved_filter` takes `filterId`. Confirm each write first.

8. **Remove a property (only when asked).** `delete_site` takes `siteUrl` and `confirm: true`. Before calling it, restate that this unregisters the property from GSC Wizard only (Search Console is untouched) and irreversibly deletes its topic clusters, content groups, saved filters, inspections and annotations, that only the owner can do it, and ask for an explicit yes. If the user only wants it off the dashboard, use `set_dashboard_visibility` with `visible: false` instead, which deletes nothing.

9. **Readiness checks.** Three quick reads close the setup:
   - `get_site_summary` with `siteUrl` and `days: 28`: non-zero `current.clicks` or `current.impressions` over `range.startDate` to `range.endDate` proves the property reads. GSC data lags about 2 to 3 days, so the window ends at the latest settled date.
   - `get_indexing_tracker` with `siteUrl`: `tracker: null` means no tracker is configured; the indexing-tracker skill sets one up.
   - `get_indexnow_settings` with `siteUrl`: `indexnowApiKeySet: false` means no key yet; `keyFileVerified` `false` means the key file is missing or wrong (`keyFileUrl` names the file to publish) and `null` means the probe was inconclusive; the indexnow-submit skill configures and uses it.

## Output

Present a setup checklist as a compact markdown table:

| Item | Status | Detail |
|---|---|---|

Status is one of done, already set, blocked or skipped, with one row each for: account and plan, Google connection and `gscScope`, property registered, verified in Search Console, shown on the dashboard (slots used of limit, from `set_dashboard_visibility`), tags, branded keywords (how many), sitemap URLs, crawl rate, filter presets (names), indexing tracker, IndexNow, and first data read (clicks and impressions from `get_site_summary` with its dates). Below it, list what remains for the user to do outside the tools (verify the property, reconnect Google with full access, upgrade the plan, publish the IndexNow key file, give the connection write access).

Then name the first skills to run on the new property, in order: site-audit for the baseline, then quick-wins, content-decay and cannibalization as the audit points to them, with indexing-health if the data read or the sitemap list looked thin. End with a short list of next steps, each naming the tool or skill that performs it. Do not fabricate rows the tools did not return; if a read came back empty, say so.

## Error handling

If any tool call fails with an authentication or subscription error, tell the user to run `/mcp` to (re)authenticate, and that a GSC Wizard account with an active plan or trial plus a connected Google Search Console account is required. If the property is not found, re-run `list_sites` and offer the closest matches instead of guessing a URL format. If a single tool fails for another reason, report the gap in the relevant section and complete the rest of the workflow with the remaining data. If a write is refused because the connection is read-only, say that this step needs write access and continue with the read-only parts.

## Grounding

Every number you report must name the tool it came from and the date range it covers, for example "clicks 12,340 (`get_site_summary`, 2026-09-21 to 2026-09-27)". For a table, state the tool and date range once on the line above it. If you derive a figure yourself (a delta, a sum, a share), say so and name the tool outputs it was computed from. Never report a number no tool returned.
