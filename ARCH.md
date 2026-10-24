# Architecture

**Canonical system-shape document.** If any other document describes the system differently, this one wins. This document explains *what the system is made of and why* — for someone new to the project. The exact enums, state machines, API shapes and role permissions are in `CONTRACT.md`; this document explains the ideas behind them, not the frozen details.

---

## 1. What kind of system this is

A **modular monolith**: one backend application, internally split into clearly separated modules, talking to one PostgreSQL database and one private file store. "Monolith" means we deploy and run it as a single backend process (plus a small worker), not a dozen microservices. "Modular" means the code inside it is still cleanly divided — each module owns its own tables and logic, and other modules only call it through its functions, never by reaching into its tables directly.

This is the right shape for a six-person team building a prototype in a short time: a single deployable unit is far easier to build, test, and run than a distributed system, while the module boundaries mean we *could* split a piece out later if it ever needed to scale independently.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Browser (React + TypeScript)                  │
│  Institution forms │ Review queue │ Dashboards │ Release screens │
└───────────────────────────────┬───────────────────────────────────┘
                                │ HTTPS, JSON (REST API)
┌───────────────────────────────▼───────────────────────────────────┐
│                      Backend (FastAPI, Python)                   │
│  ┌─────────────────────── cross-cutting ───────────────────────┐ │
│  │ Login & sessions │ Roles & permissions │ Institution scoping │ │
│  │ Input validation │ Clock service │ Audit writer │ Metrics    │ │
│  └───────────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────── domain modules ───────────────────────┐ │
│  │ Institutions   Instruments    Documents      Import           │ │
│  │ Checks engine   Discrepancies  Case notes     Verification     │ │
│  │ Bank requests   Lifecycle      Release        Escalation       │ │
│  │ Notifications   Reporting     Metrics        Audit            │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└──────────┬──────────────────────────────────┬────────────────────────┘
           │                                  │
┌──────────▼──────────┐          ┌────────────▼─────────────────────┐
│ PostgreSQL 16        │          │ Private document storage          │
│ all structured data  │          │ uploaded FDR PDFs, scans, etc.    │
└──────────┬──────────┘          └───────────────────────────────────┘
           │
┌──────────▼───────────────────────────────────────────────────────┐
│ Background worker (separate process, same codebase)                │
│ runs reminders, escalations, text extraction, notification outbox   │
└─────────────────────────────────────────────────────────────────────┘

External systems (bank verification, SMS, AICTE systems) sit behind
small "adapter" interfaces. None of them are wired to a real provider
yet — they are mocked and labelled SIMULATED in the demo.
```

**Why a separate worker?** Some work — sending a reminder email, re-checking which FDRs matured overnight, extracting text from a PDF — takes time and doesn't need to happen while a user is waiting for a response. If we did it inside the same request that handles a user's click, the user's browser would hang. The worker picks up this kind of work from a `jobs` table and does it in the background, on its own schedule.

**Why PostgreSQL?** We need transactions (so a status change and its audit record always happen together, never one without the other), strong data types (so money is never stored as an imprecise floating-point number), and the ability to search and filter thousands of records quickly. PostgreSQL gives us all of this out of the box.

**Why "private" document storage?** Uploaded FDR documents are never served directly as public files. Every download goes through the backend, which checks who is asking and whether they're allowed to see that specific file, before returning the bytes.

---

## 2. The three layers, explained

### 2.1 Frontend (what the user sees)

A single-page React application. It talks to the backend only over the API — it never talks to the database directly, and it never decides who is allowed to do what. Hiding a button for a role that can't do something is a *convenience*, not security: if the backend didn't also check, a user could still call the API directly and bypass the UI. Every important decision is enforced twice — once in the UI (for a good experience) and always in the backend (for actual security).

The frontend is organized by *feature*, not by technical layer: there's a "records" feature, a "review" feature, a "release" feature, and so on, each bundling its own screens, forms and API calls together.

### 2.2 Backend (the rules and the gatekeeping)

The backend is where almost all of the thinking happens. Every request to it goes through the same four checks, in order, before anything else happens:

1. **Is this a valid, logged-in session?** (authentication)
2. **Does this role have permission to do this kind of action?** (authorization / RBAC — role-based access control)
3. **Is this record actually inside the scope this user is allowed to see?** (scoping — an institution user can only ever see their own institution's records, enforced by one shared piece of code used everywhere, not copy-pasted into each endpoint)
4. **Is the input shaped correctly?** (validation)

Only after all four pass does the backend run the actual business logic, inside one database transaction, and write an audit record and a metrics record as part of that same transaction (so you can never end up with a change that happened but wasn't logged, or a log entry for a change that never actually committed).

The backend is split into **domain modules** — think of each as its own mini-application with its own tables:

| Module | What it's responsible for, in plain terms |
|---|---|
| Institutions & Instruments | The actual FDR records: who submitted it, what bank, what amount, what dates |
| Documents | Uploaded files: storing them safely, keeping every version, controlling who can download them |
| Checks engine | Automatically scanning a submission for obvious problems or things that need a human to look at |
| Discrepancies | The follow-up: a human reviewing a flagged issue, writing notes, resolving it |
| Verification | Tracking how much an FDR's details can be trusted — from "institution typed this in" up to "the bank confirmed this" |
| Bank requests | The paper trail of actually asking a bank to confirm something, and recording what they said |
| Lifecycle | Whether an FDR is still active, about to mature, has matured, or has been renewed/replaced |
| Release | The multi-step process of approving and recording the release of a deposit |
| Notifications & Escalation | Reminders before deadlines, and escalating to someone else if nothing happens in time |
| Reporting | Dashboards, KPIs, exportable reports — all computed live from the real data, never stored as separate numbers that could drift out of sync |
| Audit | A permanent, tamper-evident record of every important action anyone took |

### 2.3 Database and storage (where the truth lives)

PostgreSQL holds every structured fact: institutions, instruments, who reviewed what, every status change, every audit entry. The private document store holds the actual file bytes (PDFs, scanned images) — the database only stores a reference to where a file lives and its cryptographic hash, never the file content itself.

---

## 3. Why status is not "one dropdown" — the idea beginners miss most

A very common beginner mistake is giving a record a single `status` field like `"pending"`, `"active"`, `"approved"`, and trying to cram every possible fact about it into that one value. This breaks quickly, because an FDR can genuinely be several independent things *at the same time*: it can be officially reviewed by an officer, administratively still in force, approaching its maturity date, **and** have an unresolved discrepancy open — all simultaneously. One field cannot represent four independent facts without an explosion of confusing combined states ("active-and-reviewed-and-expiring-and-flagged").

So instead, every instrument has **four separate axes**, each answering a different question:

| Axis | Question it answers | Is it stored, or worked out live? |
|---|---|---|
| `verification_level` | How much do we trust this data? | Stored — only changes when a specific, recorded event happens |
| `lifecycle` | Where is it in its administrative life (draft, submitted, active, closed...)? | Stored |
| `validity_state` | Is it time-sensitive right now (approaching maturity, matured...)? | **Computed** every time it's asked, from the dates and the current time — never stored |
| `review_flag` | Is anything currently blocking it? | **Computed** from whether there are open discrepancy cases — never stored |

The practical rule that follows from this: **the dashboard never stores its own counts.** "How many FDRs are expiring?" is answered by running a query against the real data at that moment, not by reading a cached number that was updated by some other piece of code and might have drifted wrong. This is slightly slower than reading a cached number, but it can never lie.

---

## 4. The guiding principle behind every workflow

**The system's job is to flag, track and record. A human's job is to decide.**

This shows up everywhere in the design:
- An automatic check can flag "this amount looks wrong" — but it never rejects the submission by itself. A human reviews the flag and decides.
- Extracting text from a PDF can suggest "this document says ₹5,00,000" — but that suggestion never overwrites what the institution actually typed in. Both are kept, side by side, forever.
- A digital signature on a document can prove the file hasn't changed since it was signed — but it can never, by itself, mark an FDR as "bank confirmed." Only a human-reviewed bank response can do that.
- Approving a release request is not the same thing as the money actually being released. Those are two separate facts, recorded separately, because conflating them would let the system imply something happened before a human confirmed it actually did.

If you're ever unsure whether a new feature should let the system decide something automatically, the answer is almost always: no — have it produce evidence and a flag, and let an authorized person make the call.

---

## 5. Security model, in plain terms

- **Nobody is trusted by default.** Every single request is checked for who's asking, what they're allowed to do, and whether the specific record is inside their scope — not just once at login, but on every request.
- **Institution A can never see Institution B's data.** This isn't just a UI filter — it's enforced centrally, in one piece of backend code that every module uses, so it can't accidentally be forgotten in a new feature.
- **Sensitive actions require more than one person.** For example, whoever *requested* a release can't also be the one who *approves* it. This is called "separation of duties," and the backend enforces it, not just the UI.
- **Nothing important is ever truly deleted or silently overwritten.** Document uploads keep every previous version. Corrected data keeps the original value alongside the correction. This means you can always answer "what did the institution originally submit, and who changed it to what, and why?"
- **Every important action is written to a permanent audit trail**, as part of the same transaction as the action itself, so an action and its audit record can never get out of sync.
- **Uploaded files are encrypted and access-controlled**, not just "stored on a disk somewhere." Downloads are only ever served through an authorized backend endpoint, never as a direct public link.

---

## 6. External systems — nothing is assumed to exist

The prototype does **not** assume any real bank API, SMS gateway, or AICTE internal system actually exists or is authorized for use yet. Instead, each external capability sits behind a small, swappable interface (an "adapter"):

```
VerificationProvider      → used for bank verification
NotificationProvider      → used for sending emails/SMS
InstitutionSystemAdapter  → used for talking to other AICTE systems
```

For the demo, these adapters are replaced with clearly labelled mock implementations (everything they produce is marked **SIMULATED** in the interface) that behave realistically without actually calling anything external. This means the rest of the system doesn't need to change at all on the day a real integration becomes available — only the adapter implementation behind the interface does.

---

## 7. What happens when something goes wrong

A good architecture also decides, in advance, what the system does when something fails, instead of leaving it to guesswork later:

| If this fails... | ...the system does this |
|---|---|
| The bank can't be reached automatically | Falls back to a manual request-and-response workflow a human runs by hand; never blocks waiting for an API that might not exist |
| A PDF signature can't be fully trusted | Keeps the result as supporting evidence only; never lets it decide anything by itself |
| Automatic text extraction fails or is uncertain | Keeps the original file and the originally typed value; flags it for a human to look at; never overwrites anything |
| Sending a reminder/notification fails | Retries later; the failure is visible on an operations screen; it never undoes or blocks the actual workflow step it was attached to |
| The audit trail is checked and something looks tampered with | The system reports exactly which entry is suspicious; we describe this as "tamper-evident" (we can tell it happened) rather than "tamper-proof" (impossible to ever happen) — an honest distinction, not a technicality |

---

## 8. Where to look next

This document explains the *shape* and the *reasoning*. For the exact, frozen details needed to actually write code:

- Exact state names, allowed transitions, API error format, role permission table, and "definition of done" → `CONTRACT.md`
- Folder layout, which agent owns which module, environment setup steps → `REPO-SETUP.md`
- Full table-by-table data model → `PRD.md` section 10
- Which features ship first, what gets cut if time runs out, and the demo script → `PRD.md` sections 15 and 17
