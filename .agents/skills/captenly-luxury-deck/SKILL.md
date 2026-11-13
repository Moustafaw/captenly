---
name: captenly-luxury-deck
description: >-
  Formats and exports Captenly bilingual (Arabic RTL + English LTR) strategic PDF
  presentations to a luxury executive aesthetic compliant with CAPTENLY Brand
  Identity Guidelines while preserving Cover, Index, and verbatim source content.
---

# Captenly Luxury Deck Formatting Skill

Use this skill whenever redesigning, reformatting, or exporting a Captenly strategy deck (PDF) to match the official **Captenly Brand Identity Guidelines**.

## 1. Non-Negotiable Preservation Rules

1. **Preserve Cover & Index Byte-for-Byte**: Copy Page 1 (Cover) and Page 2 (Contents / Index) directly from the source PDF using `pdf-lib` (`copyPages`) so slide numbers, branding, and layout remain 100% untouched.
2. **Preserve Original Content Verbatim**: Never paraphrase, summarize, drop, or invent body text, numbers, evidence tags (`FACT`, `REC`, `INF`, `UNV`), product state badges (`LIVE AT MVP`, `PLANNED 1B/2`, `PROPOSED`), or slide page numbering (`03`–`38`).
3. **Fix PDF Font-Extraction Ligature Swaps**: When extracting Arabic text from legacy PDFs, normalize PDF CMap glyph-order reversals (`األ` → `الأ`, `اإل` → `الإ`, `اآل` → `الآ`, `عىل` → `على`, `إىل` → `إلى`, `أعىل` → `أعلى`, reversed `لا` → `ال`, and `لأ`/`لإ` reversals) and verify every token against visual page renders.
4. **Remove Redundant Sub-Headers Under Slide Titles**: Eliminate duplicate lime/colored sub-header strips (`<h2>` banners) placed directly beneath the main slide title header. Retain only authentic metadata (pillar names, weights, priorities, or lead-in narrative context).

## 2. Captenly Brand Design Tokens

From `CAPTENLY_Brand_Guidelines.pdf` (Pages 11–14):

- **Canvas & Surfaces**:
  - Alabaster Canvas: `#F4F5F2`
  - Elevated Card White: `#FFFFFF`
  - Dark Slate Surface: `#2C3437`
  - Deep Carbon Contrast: `#1A1F21`
- **Accents**:
  - Kinetic Volt Lime (Dark-BG Accent / 3px Edge Strips / Dot Marks ONLY — never body text on light surfaces): `#B0FE09`
  - Deep Olive Lime (Light-BG Readable Lime Accent): `#3F6212`
  - Soft Lime Tint (Light Badge Fill): `#ECFCCB`
  - Official Gradient: `linear-gradient(135deg, #1A1F21 0%, #2C3437 45%, #3F6212 82%, #B0FE09 100%)`
- **Color Ratio Discipline**: Balance Alabaster/White editorial slides with Dark Slate/Deep Carbon luxury anchor slides (`50% Dark Slate`, `15% Deep Carbon`, `15% Volt Lime`, `8% Deep Olive`, `12% White & Alabaster`).
- **Typography**:
  - Arabic RTL (`dir="rtl"`): `Cairo` (`400`, `600`, `700`, `800`, `900`)
  - Latin LTR (`dir="ltr"` / numerals / tags): `Inter` (`400`, `500`, `600`, `700`, `800`)
- **Slide Dimensions**: Exact 16:9 widescreen `960pt × 540pt` (`13.3333in × 7.5in` / `1280px × 720px` at 96dpi).

## 3. Luxury Anti-Cramping Layout Patterns

- **Single Editorial Header**: Eyebrow (`SECTION XX • ...`) + short `28px × 3px` Volt/Olive dash + crisp Slide Title + subtle corner `CAPTENLY®` brand mark. Never stack heavy dark rounded boxes above a redundant sub-header strip.
- **Content-Matched Layouts**:
  - *Strategic Principles / Matrices*: Clean horizontal architectural rows with oversized index numerals (`01`–`07`), generous vertical padding, and pill tags.
  - *Two-Column Comparisons / Anti-Patterns*: Individual micro-cards per point instead of dense bullet walls inside grey rectangles.
  - *Single-Concept / Pillar Detail Slides*: Bento grid (Dark Slate Hero Card + modular metadata & boundary cards) filling the 16:9 canvas harmoniously.
  - *3-Step / 3-Wave / 3-Tier Content*: Three tall vertical architectural columns with top `3px` accent borders.
  - *Anchor / Closing Framework Slides*: Dark Slate (`#2C3437`) canvas with Deep Carbon (`#1A1F21`) cards and Volt Lime (`#B0FE09`) highlights.

## 4. Export & Verification Pipeline

1. Serve the local HTML deck + local WOFF2 `Cairo`/`Inter` fonts over `127.0.0.1` HTTP to avoid file-origin font blocking.
2. Render Slides 03–38 via Headless Chrome CDP (`Page.printToPDF` with `paperWidth: 13.333333333`, `paperHeight: 7.5`, zero margins, `printBackground: true`, `preferCSSPageSize: true`).
3. Stitch untouched Pages 1–2 from the source PDF with redesigned Pages 3–38 using `pdf-lib`.
4. Render page previews to PNG and visually inspect dense slides, dark slides, and closing slides to confirm zero text clipping, zero overflow, and crisp Arabic+English bidi alignment.
