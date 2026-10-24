# FDR Portal: Frontend Change Brief (for Antigravity)

> Paste this whole file into Antigravity as the task. Work in the order given in section 9. Do not add features, buttons, labels or helper text that are not listed here.

---

## 0. Ground rules

1. **Inspect first, change second.** Before editing, scan the frontend and report: framework, router, styling system (Tailwind / CSS modules / other), where the current role is stored, where the sidebar and top bar live, which pages exist today. Then plan, then edit.
2. **Keep the existing theme** (colours, fonts, spacing, component style). New pages must look like they belong to the current app.
3. **Minimal UI.** Every new page shows only what that role needs to do its job. No instructional text, no decorative cards, no extra buttons, no extra labels, no empty "coming soon" sections.
4. **Reuse existing components** (tables, badges, cards, modals) instead of creating new ones.
5. **Do not touch the Institution Officer pages** other than making sure the other roles cannot reach them (see section 2).
6. **Do not rename** enums, API routes or role values already used by the backend. Roles used in the PRD: `institution_submitter`, `document_reviewer`, `verification_officer`, `clearance_officer`, `authorized_approver`, `auditor`, `system_admin`. In this task, "Approving Authority" = `authorized_approver`, "Admin" = `system_admin`.
7. Role checks in the UI are for navigation and display only. If the backend already enforces roles, keep that; if a route guard layer exists on the frontend, use it.

---

## 1. Problem to fix

Verification Officer and Approving Authority currently see the **same page**. They do different jobs and must get **two separate pages**, each with only what that role needs.

| Role | Job |
|---|---|
| Verification Officer | Review submitted FDRs, check document completeness |
| Approving Authority | Review referred cases, approve or reject within delegated authority |

---

## 2. Role-based access (main part)

### 2.1 What each role can open

| Page | Institution Officer | Verification Officer | Approving Authority | Admin |
|---|---|---|---|---|
| Institution Officer pages (submission, own requests) | Yes | No | No | **No** |
| Dashboard | Yes (existing, own scope) | Yes | Yes | Yes |
| FDR Registry | Yes (existing, own scope) | Yes | Yes (read only) | Yes |
| **Verification page (new)** | No | Yes | No | Yes |
| **Approval page (new)** | No | No | Yes | Yes |
| Audit log / Users / Config (whatever exists today) | No | No | No | Yes |

Rules:

- **Admin can open every page except the Institution Officer pages.** Admin sees the Verification page and the Approval page, but the decision buttons (Mark reviewed, Return, Approve, Reject) are **hidden for Admin**, because per the PRD an administrator cannot make verification or approval decisions. Keep this in one place (a single `canAct` check) so it is easy to flip.
- **Verification Officer sees only:** Dashboard, FDR Registry, Verification page. Nothing else in the sidebar.
- **Approving Authority sees only:** Dashboard, FDR Registry, Approval page. Nothing else in the sidebar.
- Sidebar items that a role cannot open must **not render at all** (not greyed out).
- Direct URL access to a forbidden page redirects to that role's default page (Dashboard). No error screen.
- Create one central place for this (for example a `roleAccess` config: role -> allowed routes -> sidebar items) and drive the sidebar and route guards from it. Do not scatter `if (role === ...)` checks across components.

### 2.2 Role-specific dashboard

Keep one Dashboard component, but each role gets only the widgets relevant to it:

- **Verification Officer:** counts and list focused on submitted FDRs awaiting review, open discrepancies, expiring maturities.
- **Approving Authority:** counts and list focused on referred cases awaiting decision, expiring maturities.
- **Admin:** the full current dashboard.

If the current dashboard already has widgets that do not apply to a role, hide them for that role. Do not add new widgets.

---

## 3. Verification Officer page (new)

**Purpose:** work through submitted FDRs and confirm their documents are complete and consistent.

### 3.1 List view (queue)

One table of FDRs in `submitted` state (and `needs_info` returned ones), oldest first.

Columns, nothing more: **Institution, FDR number, Bank, Amount, Maturity date, Documents (e.g. 3/4), Flags (count), Submitted on.**

- Row click opens the detail view.
- One search box and one status filter (All / Needs review / Returned). No other filters.

### 3.2 Detail view (one FDR)

Two-column layout:

- **Left:** the FDR's entered values (FDR number, bank, branch, IFSC, amount, issue date, maturity date, holder name, lien details), each with its source badge as already used in the app (submitted / extracted / corrected).
- **Right:** the **document checklist**: each required document with a state of Present or Missing, and a way to open/preview the uploaded file. Below it, the list of **flags** (each with its rule and reason, e.g. "Needs review: amount differs from document").

Actions (only these):

| Action | Behaviour |
|---|---|
| **Mark reviewed** | Disabled while a mandatory document is missing or a High/Medium flag is open. Sets the verification level to Officer-reviewed. |
| **Return for information** | Requires a short reason. Sends the FDR back to the institution. |
| **Add note** | Scrutiny observation, saved to the FDR. |
| **Resolve / Accept flag** | Per flag, with a rationale. |

If the current UI already has bank-confirmation request actions for this role, keep them in this page as they are. **Do not add them if they do not exist.**

---

## 4. Approving Authority page (new)

**Purpose:** decide on cases that have been referred upward, within the authority delegated to this user.

### 4.1 List view (queue)

One table of **referred cases** (release/refund requests in `ready_for_decision`, plus referred exceptions), oldest first.

Columns, nothing more: **Institution, FDR number, Request type, Amount, Referred on, Checklist (e.g. 5/5).**

- Show only cases **within this user's delegated authority**. If the data already has an authority limit or scope field, filter by it. If it does not, scope by assigned bureau/institutions and put a single constant (`DELEGATED_AMOUNT_LIMIT`) in config, marked with a `TODO: confirm with backend`. Cases outside authority are not shown.
- Hide any case this user raised or prepared (separation of duties).
- Row click opens the detail view.

### 4.2 Detail view (one case): single-screen summary

Show, in one screen and read-only: FDR summary, verification badge, checklist status (done / excepted, with who waived and why), history timeline (compact), and the reviewer's notes.

Actions (only these two):

| Action | Behaviour |
|---|---|
| **Approve** | Requires a rationale. |
| **Reject** | Requires a rationale. |

After a decision, return to the queue and remove the case from it.

---

## 5. Maturity schedule colours (Dashboard)

The "upcoming maturity schedule" has a **6-month horizon**. Colour each item (row, bar, chip or dot, whichever the current component uses) by time remaining to maturity:

| Time to maturity | Colour |
|---|---|
| 0 to 1 month (up to 30 days) | **Red** |
| More than 1 month up to 3 months (31 to 90 days) | **Yellow** |
| More than 3 months up to 6 months (91 to 180 days) | **Green** |

- Compute days remaining with the app's existing clock/"today" source (the PRD has a simulated demo clock; if the frontend has a clock helper or API, use it, not `new Date()`).
- Put the thresholds in one small helper, e.g. `maturityColor(daysRemaining)`, so they are not hard-coded in the JSX.
- Colours must read well in both light and dark mode (use theme tokens, not raw hex scattered in components).
- Do not add a legend sentence. If a legend is needed for clarity, use three tiny coloured dots with the labels "1 mo", "2-3 mo", "4-6 mo", nothing more.
- Already matured FDRs are not part of this schedule; leave them in their existing section.

---

## 6. Role switcher clean-up

Currently there are too many places to change role (about 5). Reduce to **exactly 2**:

1. **Bottom-left of the sidebar:** the user/role control.
2. **Top-right of the top bar:** the profile menu.

Remove every other role-changing control. Both remaining controls must read from and write to the **same role state**, so changing in one updates the other instantly, and the sidebar, route guard and dashboard all react to it.

Role options in the switcher: Institution Officer, Verification Officer, Approving Authority, Admin. After switching, navigate to that role's default page (Dashboard).

---

## 7. Dark mode

- Add a **sun/moon icon button in the top bar, to the left of the profile menu**. Icon only, with a tooltip/aria-label ("Dark mode" / "Light mode").
- Clicking toggles dark mode on and off. Icon swaps (moon in light mode, sun in dark mode).
- Persist the choice in `localStorage`; on first visit follow `prefers-color-scheme`.
- Apply the theme **before first paint** (set the class/attribute on `<html>` in a tiny inline script or at app bootstrap) so there is no white flash.
- Implementation: if Tailwind, use `darkMode: 'class'` and add `dark:` variants; if the app already uses CSS variables, define a dark set of the same variables under `.dark` / `[data-theme="dark"]`. Keep the same brand/accent colours, only adjust backgrounds, surfaces, borders, text and shadows.
- Check dark mode on: sidebar, top bar, tables, badges, modals, forms, charts, the new Verification and Approval pages, and the maturity colours (red/yellow/green must stay distinguishable).
- Text contrast must stay readable (aim for WCAG AA).

---

## 8. Remove

- Remove the helper line on the dashboard: **"Click an item to open the corresponding workflow queue"** (and any similar "click here to..." instruction text). Keep the items clickable with a pointer cursor and a subtle hover state; users already know to click.
- Remove the extra role-switcher controls (section 6).
- While in these files, do not add replacement hint text anywhere.

---

## 9. Order of work

1. Recon report: stack, current role mechanism, current pages, where the 5 role switchers are.
2. Central `roleAccess` config + route guards + sidebar driven by it (section 2).
3. Role switcher reduced to 2, one shared state (section 6).
4. Verification page (section 3).
5. Approval page (section 4).
6. Role-specific dashboard + maturity colours + removal of helper text (sections 2.2, 5, 8).
7. Dark mode (section 7).
8. Final pass against the checklist below.

---

## 10. Acceptance checklist

- [ ] Verification Officer and Approving Authority land on different pages with different content.
- [ ] Verification Officer sidebar: Dashboard, FDR Registry, Verification. Nothing else.
- [ ] Approving Authority sidebar: Dashboard, FDR Registry, Approval. Nothing else.
- [ ] Admin can open everything except Institution Officer pages; decision buttons are hidden for Admin.
- [ ] Typing a forbidden URL redirects to Dashboard.
- [ ] Verification page has only the columns and actions listed in section 3. "Mark reviewed" is disabled while a mandatory document is missing or a High/Medium flag is open.
- [ ] Approval page has only Approve and Reject, both requiring a rationale. Out-of-authority and self-raised cases are not shown.
- [ ] Maturity schedule: 0-1 month red, 2-3 months yellow, 4-6 months green, driven by one helper and the app clock.
- [ ] Exactly 2 role switchers (sidebar bottom-left, top-right profile), always in sync.
- [ ] Dark mode icon top-right, toggles instantly, persists after refresh, no flash, all pages and the maturity colours look correct.
- [ ] "Click an item to open the corresponding workflow queue" is gone; items still clickable.
- [ ] No new buttons, labels or hint text beyond what is listed. Existing theme unchanged in light mode.
- [ ] No console errors, no TypeScript/lint errors.

When finished, reply with: files changed, any assumption you had to make (especially around delegated authority and the document checklist data), and anything you could not complete.
