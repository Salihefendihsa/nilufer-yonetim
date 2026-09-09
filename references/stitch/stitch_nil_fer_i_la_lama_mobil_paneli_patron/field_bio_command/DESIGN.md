---
name: Field Bio-Command
colors:
  surface: '#ebfeee'
  surface-dim: '#ccdfcf'
  surface-bright: '#ebfeee'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#e6f8e8'
  surface-container: '#e0f3e2'
  surface-container-high: '#daeddd'
  surface-container-highest: '#d5e7d7'
  on-surface: '#0f1f15'
  on-surface-variant: '#40493f'
  inverse-surface: '#243429'
  inverse-on-surface: '#e3f6e5'
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
  tertiary: '#006098'
  on-tertiary: '#ffffff'
  tertiary-container: '#2e79b3'
  on-tertiary-container: '#fdfcff'
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
  tertiary-fixed: '#cee5ff'
  tertiary-fixed-dim: '#97cbff'
  on-tertiary-fixed: '#001d33'
  on-tertiary-fixed-variant: '#004a76'
  background: '#ebfeee'
  on-background: '#0f1f15'
  surface-variant: '#d5e7d7'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: '0'
  title-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 22px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: '0'
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: '0'
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: '0'
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
  kpi-stat:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '800'
    lineHeight: 32px
    letterSpacing: -0.03em
  kpi-unit:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
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
  gutter-mobile: 1rem
  margin-mobile: 1rem
  nav-floating-height: 4.25rem
---

## Brand & Style

This design system establishes a high-precision, tactical, yet calm operational environment for agricultural and urban pest control professionals. Built to instill certainty, clinical rigor, and ecological responsibility, the interface balances raw field utility with modern SaaS refinement. 

The aesthetic is **Modern Bio-Tactical**:
- Crisp, clinical surfaces anchored by botanical deep-moss tones.
- High visual legibility under harsh outdoor sunlight, paired with refined macro-states for executive dispatchers.
- Low-noise surfaces using soft sage tints that reduce eye fatigue during full-day dispatch routes.
- Purposeful micro-interactions: pulsing telemetry indicators, subtle tactile feedbacks, and clear visual state confirmations that reduce user error when recording critical chemical applications and premises audits.

## Colors

The palette derives from natural flora and clinical inspection standards:

- **Primary (`#3D8A4E` - Forest Green)**: Used for affirmative primary actions, active filters, completed stages, and verified telemetry markers.
- **Secondary / Primary Dark (`#2F5233` - Deep Moss)**: The brand anchor. Applied to high-hierarchy headers, primary command action buttons, top app-bar elements, and active navigation nodes.
- **Surface & Backgrounds**:
  - Global Canvas: `#F4F7F4` (Ultra-light clean sage-white). Eliminates stark glare while preserving contrast.
  - Surface/Card Background: `#FFFFFF` for data-bearing cards and modals.
  - Surface Raised / Highlight: `#EBF2EB` for selected cell fills, nested metrics, and secondary button states.
- **Borders & Dividers**: `#E3E8E3` (Soft botanical gray-green) at 1px width to enforce card separation without visual clutter.
- **Typography**:
  - Primary Text: `#16211A` (Near-black carbon with a subtle dark-forest undertone; minimum contrast ratio 12.8:1 against white).
  - Secondary / Muted Text: `#5A6B5E` (Balanced moss-slate for helper text, timestamps, and field meta-labels).
- **Operational Status Roles**:
  - **Critical / Danger (`Kritik`)**: Text/Icon `#C0392B`, Tinted Fill `#FDF0EF`, Border `#FADBD8`. Used for high pest density, hazardous chemical alerts, and overdue actions.
  - **Warning (`Bekliyor`)**: Text/Icon `#B57F13`, Tinted Fill `#FEF8EC`, Border `#FBEECF`. Denotes pending inspections, unverified dosage, or delayed visits.
  - **Success (`Tamamlandı`)**: Text/Icon `#2F5233`, Accent `#3D8A4E`, Tinted Fill `#F1F8F2`, Border `#DBEBDE`. Denotes resolved calls, compliant traps, and verified applications.
  - **Informational (`Planlandı`)**: Text/Icon `#1F6FA8`, Tinted Fill `#EFF6FC`, Border `#D5E7F6`. Used for scheduled visits, weather reports, and client notes.

## Typography

Typography pairs **Plus Jakarta Sans** for expressive, geometric, and modern headers and numeric readouts with **Inter** for dense, ultra-legible inspection checklists and form fields.

- Numeric figures across KPIs and metric dashboards must feature tabular lining (`font-variant-numeric: tabular-nums`) to prevent horizontal layout shift during live field counts.
- `label-sm` utilizes subtle letter-spacing (`+0.04em`) and uppercase formatting when deployed in table column titles, station badge statuses, and trap telemetry indicators.
- In field forms, `title-md` is prioritized for input group titles to ensure immediate visual scanning under motion.

## Layout & Spacing

The layout system is tailored for single-hand mobile ergonomics and dense operational readouts.

- **Grid Model**:
  - **Mobile (<600px)**: Single column with a 4-column sub-grid, 16px lateral padding (`margin-mobile`), and 12px or 16px row gaps.
  - **Tablet/Field Slate (600px - 1024px)**: 8-column layout with 24px margins, allowing split-screen operation (inspection map alongside active room checklist).
- **Vertical Spacing Cadence**:
  - Adheres strictly to an 8pt layout grid (4pt for micro-offsets and badge internal paddings).
  - Cards enforce an internal padding of `space-md` (16px) or `space-lg` (20px) depending on content density.
  - Bottom sheet and main scroll views must append `5.5rem` (88px) of bottom padding to ensure zero collision with the floating bottom action navigation bar.

## Elevation & Depth

Visual hierarchy uses subtle ambient shadows coupled with crisp, 1px low-contrast organic borders (`#E3E8E3`). This prevents murky gray silhouettes and keeps the UI clean and sterile.

- **Level 0 (Flat / Canvas)**:
  - Surface color `#F4F7F4`. No shadow, no outline.
- **Level 1 (Operational Cards, Standard Tiles)**:
  - Background `#FFFFFF`.
  - Border: 1px solid `#E3E8E3`.
  - Shadow: `0 2px 8px rgba(22, 33, 26, 0.04), 0 1px 2px rgba(22, 33, 26, 0.03)`.
- **Level 2 (Active Cards, Filter Modals, Interactive Elements)**:
  - Background `#FFFFFF`.
  - Border: 1px solid `#D2DBD2`.
  - Shadow: `0 4px 16px rgba(22, 33, 26, 0.06), 0 2px 4px rgba(22, 33, 26, 0.04)`.
- **Level 3 (Floating Bottom Nav, Quick-Add FAB)**:
  - Navigation Pill Shadow: `0 8px 24px rgba(22, 33, 26, 0.08), 0 2px 6px rgba(22, 33, 26, 0.04)`.
  - Central Elevated Action Button (`#2F5233` or `#3D8A4E`): `0 8px 20px rgba(47, 82, 51, 0.35), 0 2px 6px rgba(47, 82, 51, 0.20)`.

## Shapes

The design language balances approachable curves with clinical containment:

- **Cards and Panels**: Enforce a radius of 16px to 18px (`1rem` to `1.125rem`). This softens dense diagnostic forms while containing technical charts cleanly.
- **Buttons and Inputs**: Fixed 12px (`0.75rem`) border radius, striking a balance between comfortable tap targets and technical form-factor stability.
- **Status Pills, Telemetry Badges, and Floating Island Nav**: Full pill styling (`rounded-full`, 9999px).
- **Outlined Icon Badges**: 10px to 12px squircle containers with matching border tones.

## Components

### 1. Cards
- Surface `#FFFFFF`, rounded 16px–18px, border 1px solid `#E3E8E3`.
- Internal padding: 16px (`space-md`).
- Header: Split row containing an icon badge + card title on the left, and a status pill or chevron on the right.
- Visual separation for nested statistics: Inner containers use `#F4F7F4` with rounded-12px corners.

### 2. Buttons
- **Primary Command**:
  - Background: `#2F5233` (default), `#244027` (pressed/hover).
  - Text: `#FFFFFF`, 14px bold (`title-md`), height: 48px. Rounded 12px.
- **Secondary / Action**:
  - Background: `#3D8A4E`, Text: `#FFFFFF`.
- **Outline / Operational**:
  - Background: `#FFFFFF`, Border: 1.5px solid `#E3E8E3`, Text: `#16211A`.
- **Destructive**:
  - Background: `#FDF0EF`, Border: 1px solid `#FADBD8`, Text: `#C0392B`.

### 3. Live Status Pill Badges
- Pill-shaped (`rounded-full`), height: 26px, padding: 4px 12px.
- Typography: `label-sm` with tabular numerals.
- Structure: Includes a leading 6px circular indicator dot.
- **Pulsing State**: Active / live monitoring elements display a CSS-animated pulsing outer ring (`opacity: 0.75` to `0`, scaling from `1` to `2.2`) matching the badge's status color.

### 4. Icon Badges
- Container: 36x36px or 40x40px, rounded 10px–12px.
- Tinted background matched to context: Light forest (`#F1F8F2`), warning tint (`#FEF8EC`), or slate tint (`#F4F7F4`).
- Border: 1px solid matching the tint’s base hue with 20% opacity. Icons: 20px SVG line-art with 1.75px stroke width.

### 5. Input Fields & Form Controls
- Height: 48px, background `#FFFFFF`, border: 1.5px solid `#E3E8E3`, rounded 12px.
- Focus state: Border transitions to `#3D8A4E` with an outer soft glow `0 0 0 3px rgba(61, 138, 78, 0.15)`.
- Numeric Steppers (for pest count & chemical ratios): Integrated `-` and `+` touch pads (44x44px minimum touch target) directly inside the field border.

### 6. Checkboxes & Radio Buttons
- Checkbox: 22x22px, rounded 6px. Checked state: Fill `#3D8A4E`, icon check in `#FFFFFF`.
- Radio: 22x22px, circular. Checked state: Border `#3D8A4E` with an inner solid circle of 10px `#2F5233`.

### 7. Segmented Distribution Bars
- Total height: 8px to 10px, rounded-full container with overflow hidden.
- Multi-segment tracking (e.g., Traps: Cleared / Action Required / Critical).
- Directly paired with inline legend micro-dots and percentage summaries.

### 8. Micro-Charts & Telemetry Sparks
- SVG sparklines rendered with stroke `#3D8A4E` and soft gradient fill beneath (`rgba(61, 138, 78, 0.12)` down to `transparent`).
- Target thresholds marked with subtle dashed horizontal rules in `#E3E8E3`.

### 9. Floating Bottom Navigation Bar
- Width: `calc(100% - 32px)`, elevated 16px above the home indicator.
- Height: 68px. Rounded-full (`9999px`) pill.
- Background: `#FFFFFF` with 95% opacity and `backdrop-blur(12px)`.
- Border: 1px solid `#E3E8E3`.
- Center Action Button: Elevated 56x56px circular button (`#2F5233`) protruding 14px above the bar perimeter, housing a crisp 24px plus/scan icon, designed for quick visit logging and QR station scanning.