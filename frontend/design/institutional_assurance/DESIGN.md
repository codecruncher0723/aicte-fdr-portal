---
name: Institutional Assurance
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#3d4947'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#6d7a77'
  outline-variant: '#bcc9c6'
  surface-tint: '#006a61'
  primary: '#00685f'
  on-primary: '#ffffff'
  primary-container: '#008378'
  on-primary-container: '#f4fffc'
  inverse-primary: '#6bd8cb'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#825100'
  on-tertiary: '#ffffff'
  tertiary-container: '#a36700'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#89f5e7'
  primary-fixed-dim: '#6bd8cb'
  on-primary-fixed: '#00201d'
  on-primary-fixed-variant: '#005049'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
  data-mono:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-lg: 1.5rem
  margin: 1rem
  margin-md: 1.5rem
  margin-lg: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 2rem
---

## Brand & Style

This design system serves the regulatory and financial oversight domain of higher education technical institutions. It is engineered for operations officers, university finance controllers, and compliance auditors managing high-value Fixed Deposit Receipts (FDR) and institutional security reserves.

The system embodies **Precision SaaS Modernism**: a high-efficiency aesthetic prioritizing clarity, legal trust, and operational speed. It merges the structure of institutional governance with the agility of modern financial tools. 

Key attributes:
- **Absolute Legibility:** Data density without visual friction. Every value, certificate reference, and renewal date sits in unambiguous spatial priority.
- **Controlled Urgency:** Semantic color is reserved strictly for operational states—maturity timelines, statutory shortfalls, and verification milestones.
- **Architectural Calm:** Generous use of soft neutral canvases punctuated by pure white container surfaces, subtle micro-borders, and tactile interaction surfaces.

## Colors

The palette establishes an institutional authority anchored by slate and deep navy, paired with a vibrant, clinical teal for verified states and forward actions. 

- **Primary Teal (`#0D9488` / `#14B8A6`):** Dedicated to verified deposit states, primary interactive elements, batch settlement triggers, and confirmed legal endorsements.
- **Secondary Deep Navy (`#0F172A` / `#1E293B`):** Commands structural boundaries, primary metric figures, high-priority typography, and active navigation nodes.
- **Tertiary Amber (`#F59E0B` / `#D97706`):** Signals time-sensitive compliance actions: 30/60/90-day maturity horizons, pending joint-endorsements, and verification holds.
- **Semantic Rose (`#E11D48` / `#EF4444`):** Flags lapsed renewals, shortfall in statutory minimums, mismatched bank liens, and flagged audits.
- **Canvas & Surface Architecture:** Canvas surfaces render at `#F8FAFC`. Card surfaces use crisp `#FFFFFF`. Hairline structural borders use `#E2E8F0` with muted accents in `#CBD5E1`.

## Typography

The type system balances the modern, geometric confidence of **Plus Jakarta Sans** for dashboards, section titles, and high-impact totals with the utilitarian legibility of **Inter** for data grids, metadata, legal attestations, and operational controls.

- **Tabular Alignment:** Financial amounts, FDR serial numbers, IFSC keys, and maturity countdowns must use `font-feature-settings: "tnum" on, "cv05" on` to enforce uniform tabular numeral widths across table columns and comparisons.
- **Case Rhythms:** Use uppercase treatments strictly on `label-sm` for system status tokens, currency specifiers (INR), and table headers, coupled with `letter-spacing: 0.05em`.
- **Text Hierarchies:** Financial values default to 600 weight; accompanying currency marks use slate 400 at 500 weight.

## Layout & Spacing

This design system utilizes a structured responsive grid engineered for dense analytical workflows and ledger operations.

- **Desktop (1200px+):** 12-column fluid grid. Gutter: `1.5rem` (`gutter-lg`), margin: `2rem` (`margin-lg`). Max container cap: 1600px for panoramic monitoring viewports.
- **Tablet (768px – 1199px):** 8-column layout. Gutter: `1rem` (`gutter`), margin: `1.5rem` (`margin-md`). Analytical panels stack to 2-column or full-width patterns.
- **Mobile (< 768px):** 4-column layout. Gutter: `0.75rem`, margin: `1rem` (`margin`). Multicolumn tables convert into card-based records with sticky ledger identifiers.
- **Component Padding Scale:**
  - `space-xs` (4px): Micro gaps between status dots and badges; tight icon pairs.
  - `space-sm` (8px): Form input inner vertical padding; table cell compact vertical density.
  - `space-md` (12px): Standard inner button padding; chip array separations.
  - `space-lg` (20px): Primary card interiors; filter bar internal breathing room.
  - `space-xl` (32px): Separation between unrelated metric cards, KPI blocks, and legal audit logs.

## Elevation & Depth

Visual plane differentiation relies on a hybrid model of **pure white surfaces**, **calibrated hairline borders**, and **subtle, diffused ambient shadows**. High elevations are reserved for modal validations and dropdown portals.

- **Base Ground (Level 0):** Background canvas rendered at `#F8FAFC`.
- **Resting Container (Level 1):** Metric modules, audit cards, and data ledgers use `#FFFFFF` with a structural border: `1px solid #E2E8F0`. Shadow: `0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.02)`.
- **Interactive / Hover Surface (Level 2):** Quick-filter pills, hovering table rows, active cards. Shadow: `0 4px 6px -1px rgba(15, 23, 42, 0.06), 0 2px 4px -2px rgba(15, 23, 42, 0.04)`. Border shifts to `#CBD5E1`.
- **Flyouts & Popovers (Level 3):** Dropdown filters, date range selectors, joint-mandate signatures. Border: `1px solid #E2E8F0`. Shadow: `0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.03)`.
- **Critical Dialogs & Drawers (Level 4):** Certificate verification modal, encashment claims, and lien release authorizations. Background: `#FFFFFF`. Shadow: `0 20px 25px -5px rgba(15, 23, 42, 0.10), 0 8px 10px -6px rgba(15, 23, 42, 0.04)`.

## Shapes

The interface balances sharp fiscal discipline with modern approachable product contours:

- **Base Corners (`0.5rem` / 8px):** Applied to standard interactive controls, text fields, notification toasts, dropdown containers, and metric block containers.
- **Sub-elements (`0.25rem` / 4px):** Form check toggles, nested mini action items within tables, sparkline container corners.
- **Cards & Data Tables (`0.75rem` / 12px):** All major content cards, ledger wrappers, and visual analytics blocks use rounded-lg profiles to isolate modules cleanly against the `#F8FAFC` foundation.
- **Badges & Pills (Full Radius / 9999px):** Status badges (Matured, Active, Shortfall, Flagged), filter chips, and institutional category tags are strictly pill-shaped to contrast distinctly with tabular grids.

## Components

### Buttons
- **Primary Action (Teal):** Background `#0D9488`, text `#FFFFFF`, border `transparent`. Hover `#0F766E`, active `#115E59`. Focus ring: `2px solid #FFFFFF`, `2px solid #0D9488`.
- **Secondary (Navy/Outline):** Background `#FFFFFF`, text `#0F172A`, border `1px solid #E2E8F0`. Hover background `#F8FAFC`, border `#CBD5E1`.
- **Destructive (Rose):** Background `#EF4444`, text `#FFFFFF`. Hover `#DC2626`.
- **Dimensions:** Compact height of 36px for dashboard operations; 32px for in-table micro-actions; 40px for modal actions.

### Badges & Status Indicators
- **Fully Verified / Active:** Pill container, background `#CCFBF1`, text `#0F766E`, border `1px solid #99F6E4`. Includes a 6px circular dot (`#0D9488`).
- **Pending / Expiring Soon:** Background `#FEF3C7`, text `#B45309`, border `1px solid #FDE68A`.
- **Critical Shortfall / Lien Invoked:** Background `#FFE4E6`, text `#BE123C`, border `1px solid #FECDD3`.
- **Typography:** `label-sm` (11px, weight 600, uppercase).

### Metric Cards & Analytics Arc
- **Structure:** `#FFFFFF` canvas, `1px solid #E2E8F0`, padding `1.25rem`.
- **Content Flow:** Upper row displays metric label (`label-md`, `#64748B`) and status badge or delta; middle row showcases primary value (`headline-xl`, tabular figures, `#0F172A`); bottom row embeds mini arc-progress meters (showing statutory threshold met vs required) or trend sparklines.

### Financial Data Tables
- **Header:** Background `#F8FAFC`, text `#475569`, height 40px, font `label-sm` (uppercase, tracking +0.05em), border-bottom `1px solid #E2E8F0`.
- **Row Styling:** Height 48px, background `#FFFFFF`, border-bottom `1px solid #F1F5F9`. Hover state shifts row to `#F8FAFC`.
- **Numeric Cells:** Right-aligned, Inter tabular numerals (`data-mono`).
- **Sticky Column:** Fixed leftmost column for Institution Name / FDR Number during horizontal scroll on constrained viewports.

### Inputs & Filters
- **Form Controls:** Height 36px, background `#FFFFFF`, border `1px solid #CBD5E1`, text `#0F172A`, placeholder `#94A3B8`. Focus state uses border `#0D9488` with a `0 0 0 1px #0D9488` keyline.
- **Search & Filter Bars:** Integrated composite components with instant search, date range pickers (Maturity Horizon), and branch/bank dropdown tags.