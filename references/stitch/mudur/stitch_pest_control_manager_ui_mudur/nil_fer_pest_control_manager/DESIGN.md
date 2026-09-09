---
name: Nilüfer Pest Control Manager
colors:
  surface: '#f0fdf1'
  surface-dim: '#d0ddd2'
  surface-bright: '#f0fdf1'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eaf7eb'
  surface-container: '#e4f1e6'
  surface-container-high: '#deece0'
  surface-container-highest: '#d9e6da'
  on-surface: '#131e17'
  on-surface-variant: '#40493f'
  inverse-surface: '#28332b'
  inverse-on-surface: '#e7f4e8'
  outline: '#707a6e'
  outline-variant: '#bfc9bc'
  surface-tint: '#1c6c34'
  primary: '#186a32'
  on-primary: '#ffffff'
  primary-container: '#368348'
  on-primary-container: '#f7fff3'
  inverse-primary: '#89d894'
  secondary: '#436746'
  on-secondary: '#ffffff'
  secondary-container: '#c4edc3'
  on-secondary-container: '#496d4b'
  tertiary: '#565e59'
  on-tertiary: '#ffffff'
  tertiary-container: '#6f7672'
  on-tertiary-container: '#f7fef8'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#a4f5ae'
  primary-fixed-dim: '#89d894'
  on-primary-fixed: '#002109'
  on-primary-fixed-variant: '#005321'
  secondary-fixed: '#c4edc3'
  secondary-fixed-dim: '#a9d1a8'
  on-secondary-fixed: '#002108'
  on-secondary-fixed-variant: '#2b4e30'
  tertiary-fixed: '#dde4de'
  tertiary-fixed-dim: '#c1c8c3'
  on-tertiary-fixed: '#161d1a'
  on-tertiary-fixed-variant: '#414844'
  background: '#f0fdf1'
  on-background: '#131e17'
  surface-variant: '#d9e6da'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.04em
  metric-display:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 38px
    letterSpacing: -0.03em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  space-2xs: 0.25rem
  space-xs: 0.5rem
  space-sm: 0.75rem
  space-md: 1rem
  space-lg: 1.25rem
  space-xl: 1.5rem
  space-2xl: 2rem
  space-3xl: 2.5rem
  screen-edge-padding: 1rem
  card-internal-padding: 1.125rem
  bottom-bar-clearance: 5.5rem
---

## Brand & Style

The design system is engineered for field service leadership, specifically tailored to the operational demands of pest control operations in Turkey. It bridges institutional hygiene, biochemical reliability, and rapid mobile logistics.

The visual style is **Tactile Modern Utility**—crisp, authoritative, and clean. It balances sterile, health-grade clarity with organic botanical undertones. Interfaces eliminate visual noise while maximizing legibility in both bright outdoor sunlight and dim basements. High-contrast typography, generous click targets, tactile surface elevations, and definitive status chips ensure seamless oversight of field teams, chemical application logs, customer signatures, and route dispatches.

## Colors

The color palette reinforces biophilic sanitation and operational command:

- **Primary Green (`#3D8A4E`)**: Used for core primary actions, floating interactive elements, active navigation states, and confirmed operations.
- **Deep Forest Dark Green (`#2F5233`)**: Provides executive authority. Anchors headers, drawer banners, major visual groupings, and primary icon accents.
- **Surface Highlight / Tint (`#F1F8F2`)**: Utilized for selected states, active list item backgrounds, filter chip fills, and subtle operational cards.
- **Page Canvas (`#F4F7F4`)**: A cool, clinical off-white canvas that prevents glare while contrasting with pure white surfaces.
- **Card Surface (`#FFFFFF`)**: Pure crisp white for elevated structural containers, modals, sheets, and dynamic inputs.
- **Borders & Dividers (`#E3E8E3`)**: Low-contrast structural borders defining touch boundaries without visual heaviness.
- **Text Primary (`#16211A`)**: Deep charcoal-forest hue for critical metrics, customer names, and primary headers.
- **Text Secondary (`#5A6B5E`)**: Muted botanical slate for field labels, timestamps, and secondary statuses.
- **Text Faint (`#8B9A8E`)**: For placeholder text, inactive tab states, and non-critical metadata.
- **Semantic Accents**:
  - Success (`#15803D`): Completed treatments, validated compliance.
  - Warning (`#B57F13`): Pending approvals, approaching SLA windows, chemical storage warnings.
  - Danger (`#C0392B`): Infestation escalations, missed appointments, critical hazard alerts.
  - Info (`#1F6FA8`): Technician updates, schedule realignments, diagnostic system notices.

## Typography

The typographic system utilizes **Plus Jakarta Sans** for structural headers, primary body copy, and metric cards to provide an approachable, modern, and humanized touch. **Inter** is reserved for labels, badges, numerical data tables, and interactive UI controls where mechanical clarity and tabular lining numbers are critical.

Turkish character sets (ç, ğ, ı, İ, ö, ş, ü) must render natively with balanced vertical metrics and accurate diacritic positioning. All KPI metrics and live dispatch counters use tabular figures (`tnum`) to eliminate layout shift during status changes.

## Layout & Spacing

The layout is built upon an 8pt spatial grid (with a 4pt subgrid for micro-alignments like icons and badges). 

- **Phone Layout (Primary)**: Single-column fluid architecture constrained within a full-bleed viewport. Screen edges maintain a default horizontal gutter of `16px` (`space-md`), scaling to `20px` (`space-lg`) on devices exceeding 390px width.
- **Vertical Rhythm**: Related items maintain `8px` (`space-xs`) or `12px` (`space-sm`) gaps; distinct functional cards maintain `16px` (`space-md`) margins.
- **Fixed System Insets**: Every screen strictly enforces bottom padding of `bottom-bar-clearance` (`88px`) to ensure the floating 4-tab bar and raised central action trigger never obstruct actionable items, signatures, or action confirmation sheets.

## Elevation & Depth

Visual hierarchy uses a refined green-tinted shadow model that mimics diffuse daylight rather than stark gray artificial shadows:

- **Base Layer (Flat)**: Background canvas `#F4F7F4`.
- **Card Tier (Level 1)**: Pure `#FFFFFF` surface accompanied by a 1px perimeter outline (`#E3E8E3`) and diffuse elevation:
  `box-shadow: 0 4px 16px -2px rgba(47, 82, 51, 0.05), 0 1px 3px 0 rgba(22, 33, 26, 0.03)`.
- **Floating Navigation & Popovers (Level 2)**: Floating 4-tab bar and action menus:
  `box-shadow: 0 12px 28px -6px rgba(47, 82, 51, 0.12), 0 4px 10px -2px rgba(22, 33, 26, 0.04)`.
- **Center Action Button (Hero Elevation)**: Raised green quick action button:
  `box-shadow: 0 8px 20px -4px rgba(61, 138, 78, 0.45), 0 2px 6px 0 rgba(47, 82, 51, 0.20)`.
- **Modals & Drawers (Level 3)**: Slide-in navigation drawer with backdrop dimming (`rgba(22, 33, 26, 0.40)`) and directional casting:
  `box-shadow: 8px 0 32px 0 rgba(22, 33, 26, 0.16)`.

## Shapes

The interface adopts an organic, friendly geometric language:

- **Cards & Surface Modules**: Formed with standard corner radii of `16px` to `18px`, avoiding abrasive industrial corners.
- **Pill Badges & Chips**: Fully circular/pill boundaries (`9999px`) for status pills, technician chips, and category tags.
- **Buttons & Text Fields**: Styled with consistent `12px` to `14px` curvature to match card corners proportionally.
- **Center Quick-Action Button**: Strictly circular (`56px` diameter) with continuous curvature.

## Components

### 1. Navigation Shell
- **Floating Bottom Navigation**: Elevated container floating `16px` above the bottom screen edge with `16px` horizontal margins. White surface (`#FFFFFF`), `24px` radius, housing 4 tabs:
  - *Ana Sayfa* (Home)
  - *İşler* (Jobs)
  - *Bildirimler* (Notifications)
  - *Mesajlar* (Messages)
- **Active Tab**: Displays `#3D8A4E` icon and text with a faint `#F1F8F2` pill background indicator.
- **Inactive Tab**: `#8B9A8E` iconography with `label-sm` text.
- **Center Quick-Action Button**: `56px` circle elevated `-20px` above the navigation bar center. Solid `#3D8A4E` fill, white plus (`+`) or action icon, with radiant primary shadow.
- **Slide-in Hamburger Drawer**: 
  - Header: Rich linear gradient from `#2F5233` to `#1E3521`. Includes manager photo/avatar, "Ayşe Yılmaz", role tag "Müdür" in a semi-transparent pill (`rgba(255, 255, 255, 0.15)`), and branch indicator ("Nilüfer Şubesi").
  - Body: `#FFFFFF` list links with icons in `#3D8A4E` and divider separations in `#E3E8E3`.

### 2. Buttons
- **Primary**: Solid `#3D8A4E` background, `#FFFFFF` text, `14px` border radius, `48px` minimum height for field touchability. Active state darkens to `#2F5233`.
- **Secondary / Subtle**: Background `#F1F8F2`, text `#3D8A4E`, border `1px solid transparent`. Active state shifts to border `#3D8A4E`.
- **Outline**: White background, `1.5px` border `#E3E8E3`, text `#16211A`.

### 3. Cards & Task Modules
- **Job / Inspection Card**: White background, `18px` border radius, `1px solid #E3E8E3`. Top bar displays customer/site name (`headline-md`) alongside a pill-shaped status badge. Body displays street address with map pin icon, assigned technician tag, and scheduled time window.

### 4. Pill-Shaped Status Badges
- Strict `padding: 4px 10px`, font `label-sm`, uppercase tracking, pill rounded (`9999px`).
  - *Tamamlandı (Completed)*: Background `#DCFCE7`, text `#15803D`.
  - *Devam Ediyor (In Progress)*: Background `#FEF3C7`, text `#B57F13`.
  - *Acil / Müdahale (Urgent)*: Background `#FEE2E2`, text `#C0392B`.
  - *Planlandı (Scheduled)*: Background `#E0F2FE`, text `#1F6FA8`.

### 5. Input Fields & Form Controls
- **Inputs**: Height `48px`, background `#FFFFFF`, border `1px solid #E3E8E3`, radius `12px`, text `body-md` in `#16211A`. Placeholder text in `#8B9A8E`. Focused state adds `1.5px solid #3D8A4E` and an ambient tint glow.
- **Checkboxes & Radios**: `22px` diameter, `#3D8A4E` fill when checked with crisp white icon. Border `#8B9A8E` in resting unchecked state.

### 6. Metric Cards & Field Summary Modules
- Displayed in a 2-column layout for the Manager dashboard. Background `#FFFFFF` or `#F1F8F2`, housing large counts (`metric-display` in `#16211A`), paired with a trend chip (e.g., "+4 bugün") and a dedicated category icon tinted in `#2F5233`.