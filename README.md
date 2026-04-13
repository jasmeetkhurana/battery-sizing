# Battery Opportunity Intake Studio

A professional multi-step web application for capturing commercial and technical inputs for C&I (Commercial & Industrial) battery energy storage opportunities in India. Generates a polished, downloadable PDF report with all collected data and an embedded 24-hour load curve chart.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Production Build

```bash
npm run build
npm run preview
```

## Architecture

| Module | Path | Purpose |
|--------|------|---------|
| **Types** | `src/types/index.ts` | All TypeScript interfaces, enums, constants |
| **Store** | `src/store/useFormStore.ts` | Zustand store with `localStorage` persistence |
| **Validators** | `src/utils/validators.ts` | Per-step validation logic |
| **Chart** | `src/utils/chartRenderer.ts` | Canvas-based chart renderer (interactive + export) |
| **PDF** | `src/utils/pdfGenerator.ts` | jsPDF-based A4 PDF generator |
| **Constants** | `src/utils/constants.ts` | Indian states, load presets |
| **Components** | `src/components/` | Reusable UI: Stepper, FormField, StepNav, ErrorSummary |
| **Steps** | `src/steps/` | Step 0–4 form components |

## Features

### Multi-Step Workflow
1. **Company & Site Profile** — Company info, premises type, location, contact
2. **Use Cases** — Multi-select grid with 10 predefined + Other
3. **Hourly Load Profile** — Interactive 24-hour chart + CSV bulk input + presets
4. **Existing Supply Stack** — DISCOM, Diesel Genset (repeatable), Other Sources (repeatable)
5. **Review & Submit** — Full summary, consent, PDF generation

### Draft Persistence
- Auto-saves to `localStorage` on every field change via Zustand `persist` middleware
- Survives page reload, browser close/reopen
- Manual "Reset Draft" button to clear all data

### Interactive Load Profile Chart
- **Canvas-based** line chart with 24 data points (H00–H23)
- **Click** any point to select it
- **Drag vertically** to adjust only the selected hour — deterministic, no accidental movement
- **Arrow keys**: Left/Right to navigate hours, Up/Down to adjust kW (±10, hold Shift for ±50)
- **Inline number inputs** below the chart for each hour
- **CSV Bulk Input**: paste 24 comma-separated values
- **Presets**: Flat, Day peak, Night peak
- **Y-axis**: Automatically scales based on sanctioned/peak load or data max

### PDF Generation
Uses **jsPDF** + **jspdf-autotable** to create professional A4 portrait reports:
- Header with title, company/site name, timestamp
- All form sections with clear typography
- Hourly load table (4-column layout)
- Embedded PNG chart image from Canvas
- DISCOM, diesel genset, and other source tables
- Declaration/consent status
- Page numbering footer
- Filename: `battery-intake-{site}-{YYYYMMDD-HHmm}.pdf`

No server required — PDF is generated entirely client-side.

### Validation
- Required field checks on each step
- Phone: 10-15 digits with optional country code
- Email: standard format validation
- Load profile: exactly 24 non-negative values, at least one non-zero
- Use cases: at least one selected
- Consent required on final step
- Optional sections (Diesel, Other Sources) can be marked "Not relevant" to skip validation

## Configuring Enums / Locations

- **Premises types**: `src/types/index.ts` → `PREMISES_TYPES`
- **Use case options**: `src/types/index.ts` → `USE_CASE_OPTIONS`
- **Source types**: `src/types/index.ts` → `SOURCE_TYPES`
- **Indian states**: `src/utils/constants.ts` → `INDIAN_STATES`
- **Load presets**: `src/utils/constants.ts` → `LOAD_PRESETS`

## Dependencies

| Package | Purpose |
|---------|---------|
| React 19 | UI framework |
| Zustand | Lightweight state management with persistence |
| jsPDF | Client-side PDF generation |
| jspdf-autotable | Table rendering in PDFs |
| Lucide React | Icon library |

## Example Payload JSON

See `example-payload.json` in the project root for a complete sample of the data structure generated on submit.

## Test Checklist

- [ ] Step 1: Fill all required fields → Continue works
- [ ] Step 1: Leave required field empty → Error shown, blocked
- [ ] Step 1: Invalid phone/email → Format error shown
- [ ] Step 1: Select "Other" premises → Extra field appears and validates
- [ ] Step 2: Select multiple use cases → At least one required
- [ ] Step 2: Select "Other" → Text field appears and validates
- [ ] Step 3: Click chart point → Point highlights, hour editor shows
- [ ] Step 3: Drag point vertically → Only that hour changes
- [ ] Step 3: Arrow keys → Navigate hours and adjust values
- [ ] Step 3: Enter CSV (24 values) → Chart updates correctly
- [ ] Step 3: Enter CSV (wrong count) → Error shown
- [ ] Step 3: Apply preset → All 24 values update, chart redraws
- [ ] Step 3: Set sanctioned load → Y-axis adjusts to include it
- [ ] Step 4: Fill DISCOM → Required fields validate
- [ ] Step 4: Mark diesel "Not relevant" → Section collapses, no validation
- [ ] Step 4: Add multiple gensets → Each validates independently
- [ ] Step 4: Mark other sources "Not relevant" → Section collapses
- [ ] Step 5: Review all sections → Data displayed correctly
- [ ] Step 5: Click section header → Goes back to that step
- [ ] Step 5: Submit without consent → Error shown
- [ ] Step 5: Submit with consent → PDF downloads
- [ ] PDF: All 5 sections present
- [ ] PDF: Chart image embedded
- [ ] PDF: Hourly table renders correctly
- [ ] PDF: Diesel/Other tables or "Not relevant" shown correctly
- [ ] PDF: Page breaks work, no overlap
- [ ] Draft: Fill form, reload page → Data persists
- [ ] Draft: Click "Reset Draft" → All data cleared
- [ ] Responsive: Check on narrow viewport → Layout adapts

## Known Limitations

1. **No backend** — Data stays in browser localStorage only
2. **No district dropdown** — District is a free-text input (no comprehensive dataset bundled)
3. **No multi-language** — English only
4. **Chart touch support** — Basic; no pinch-zoom on mobile
5. **PDF font** — Uses Helvetica (jsPDF built-in); no Devanagari script support

## Phase 2 Recommendations

1. **API integration** — POST JSON payload to backend on submit
2. **User authentication** — Login, saved drafts per user
3. **District auto-complete** — Load district list per selected state
4. **Tariff calculator** — Auto-fetch DISCOM tariff rates
5. **Multi-language** — Hindi and regional language support
6. **Dark mode** — Theme toggle
7. **Export options** — Email PDF, share link
8. **Version history** — Track form revisions
9. **Admin dashboard** — View all submissions
10. **Mobile-optimized chart** — Touch gestures, responsive sizing
