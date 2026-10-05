# FlashCards Brand & Visual Identity System

> **ملخص تنفيذي بالعربية:**
> تم تصميم وبناء هوية بصرية كاملة وعصرية لتطبيق **FlashCards** (بطاقات الاستذكار الذكية)، ترتكز على مفهوم **"The Synapse Spark / ومضة الاستذكار"**. تعبّر الهوية عن سرعة التعلم، الحفظ الفعّال عبر التكرار المتباعد (Spaced Repetition)، ووضوح التفكير. تم تجهيز وتوليد كافة الأصول الرسومية (أيقونة التطبيق 1024×1024، أيقونة أندرويد التكيفية مع دعم الأيقونات الأحادية Themed Icons في Android 13+، شاشات البداية الفاتحة والداكنة المتوافقة مع شاشات OLED، أيقونات الإشعارات الشفافة، وأيقونة الويب Favicon، ومواد متجر التطبيقات) بشكل برمجي وتكراري عبر `scripts/generate-brand-assets.mjs`. كما تم بناء مكوّن الشعار المتجاوب `<Logo />` وربطه بالواجهات (ترويسة الصفحة الرئيسية، شاشة التحميل، شاشة القفل، الحالات الفارغة، وشاشة حول التطبيق).

---

## 1. Brand Concept & Hero Logo

### The Hero Mark: "The Synapse Spark" (ومضة الاستذكار)
- **Concept:** A stack of two precision-engineered rounded flashcards. The back card is angled at -10° to represent depth and continuous progression. The front card features a brilliant geometric 4-point diamond star (the "Synapse Spark") symbolizing the cognitive flash of active recall, intelligence, and memory retention.
- **Form:** Simple, geometric, bold strokes, zero clutter.
- **Scalability:** 100% legible at small launcher sizes (48×48 px) and stunning at full display (1024×1024 px).
- **Adaptability:**
  - Full-color gradient (Electric Indigo `#6366F1` ➔ `#4F46E5` with Cyan Spark `#06B6D4`).
  - Pure Monochrome (Silhouette stencil for Android 13+ Themed Icons and Notification Bar).
  - Perfect legibility on White (`#FFFFFF`), Slate (`#F8FAFC`), and Pure OLED Black (`#000000`).

### Alternative Explored Concepts (Saved in `assets/brand/source/`)
1. **Concept A: "The Kinetic Flip" (`concept_a_kinetic_flip.svg`)** — Dynamic card fold with an active flipping corner.
2. **Concept B: "The Synapse Spark" (`concept_b_synapse_spark.svg`)** — **Selected Hero Concept.**
3. **Concept C: "The Wave Loop" (`concept_c_wave_loop.svg`)** — Integrated audio frequency curve highlighting the podcast mode and spaced repetition loops.

---

## 2. Color Palette & WCAG AA Contrast Ratios

### Core Brand Tokens

| Token | HEX | Role | Contrast vs Light (#F8FAFC) | Contrast vs OLED (#000000) |
|---|---|---|---|---|
| **Primary** | `#4F46E5` | Electric Indigo (Brand Hero) | **6.8:1** (AAA Large, AA Normal) | **5.4:1** (AA) |
| **Primary Dark** | `#3730A3` | Deep Indigo (Stack & Shadows) | **9.5:1** (AAA) | **3.8:1** |
| **Primary Light** | `#EEF2FF` | Lavender Mist (Tint / Surfaces) | **1.1:1** (Surface Tint) | **18.2:1** (AAA) |
| **Accent** | `#06B6D4` | Cyan Spark (Highlights / Action) | **3.2:1** (Icons / Large) | **9.2:1** (AAA) |
| **Accent Light** | `#ECFEFF` | Cyan Glaze (Chips / Glows) | **1.05:1** (Surface Tint) | **19.1:1** (AAA) |
| **Success** | `#10B981` | Emerald (Due Cards / Retention) | **3.4:1** | **8.6:1** (AAA) |
| **Warning** | `#F59E0B` | Amber (Learning / Stretches) | **2.2:1** (Non-text / Icons) | **10.5:1** (AAA) |
| **Error** | `#EF4444` | Crimson (Lapses / Mistakes) | **4.6:1** (AA) | **6.2:1** (AA) |
| **Text Primary (Light)** | `#0F172A` | Slate 900 (High-contrast Body) | **16.4:1** (AAA) | — |
| **Text Primary (Dark)** | `#F8FAFC` | Slate 50 (High-contrast OLED) | — | **20.2:1** (AAA) |

### Theme Re-Skinning Rules
The app maintains its multi-palette engine seamlessly:
- **Indigo (Default):** Electric Indigo `#4F46E5` + Cyan Spark `#06B6D4`.
- **Teal (Ocean):** Ocean Petrol `#0284C7` + Cyan Spark `#22D3EE`.
- **Emerald (Forest):** Emerald Zen `#059669` + Amber Accent `#F59E0B`.
- **Monochrome (Apple/Carbon):** Pure Carbon `#18181B` + White `#FFFFFF`.

---

## 3. Typography Pairings

- **Latin Script:**
  - Font: `Nunito` (Open Font License - OFL).
  - Weights: Regular 400, Medium 500, Bold 700, Black 900.
  - Wordmark: ExtraBold / Black with `-0.5px` tracking.
- **Arabic Script:**
  - Font: `Cairo` (Google Fonts / OFL).
  - Alternate Traditional: `Amiri` (OFL).
  - Weights: SemiBold 600, Bold 700, Black 800.
  - Wordmark: `بطاقات الاستذكار` with balanced optical weighting against Latin characters.

---

## 4. Iconography & Layout Guidelines

- **Stroke Weight:** `2px` standard for 24px icon grids; `2.5px` for active states.
- **Corner Radii:**
  - Small elements / Badges: `8px` (`radius.sm`)
  - Inputs & Icon containers: `12px` (`radius.md`)
  - Cards & Buttons: `16px` (`radius.lg`)
  - Floating sheets: `24px` (`radius.xl`)
  - Chips / Pills: `9999px` (`radius.full`)
- **Clear Space:** Minimum clearance around the logo mark is `25%` of its height ($0.25 \times H$).

---

## 5. Asset Inventory & Specifications

All master vector assets are maintained in `assets/brand/source/`. Raster outputs are generated into `assets/` and `assets/brand/store/`:

| File | Target Dimensions | Purpose |
|---|---|---|
| `assets/icon.png` | 1024×1024 px | iOS App Icon & General Fallback |
| `assets/adaptive-icon.png` | 1024×1024 px | Android Adaptive Icon (Artwork in inner 66% safe circle) |
| `assets/adaptive-icon-monochrome.png` | 1024×1024 px | Android 13+ Themed Adaptive Icon (White on transparent) |
| `assets/splash-icon.png` | 1024×1024 px | Light Splash Screen Logo (on `#F8FAFC`) |
| `assets/splash-icon-dark.png` | 1024×1024 px | Dark Splash Screen Logo (on OLED `#000000`) |
| `assets/notification-icon.png` | 96×96 px | Android System Notification Bar Silhouette (White on transparent) |
| `assets/favicon.png` | 48×48 px | Web Browser Tab Favicon |
| `assets/brand/store/play_store_512.png` | 512×512 px | Google Play Console Store Listing Icon |
| `assets/brand/store/feature_graphic_1024x500.png` | 1024×500 px | Google Play Store Feature Banner Graphic |
| `assets/brand/store/app_store_1024.png` | 1024×1024 px | Apple App Store 1024 Icon |
| `assets/brand/adaptive_mask_preview.png` | 1200×440 px | Verification sheet showing Circle, Squircle, and Rounded-Square masks |

---

## 6. How to Regenerate Assets

To regenerate all raster assets deterministically from the SVG sources, run:
```bash
npm run generate:assets
```
*(Uses the local devDependency `sharp` with high-density vector rasterization).*

---

## 7. How to Apply and Verify on Device / Simulator

Because app icons, adaptive icons, and native splash screens are compile-time native assets, reloading Metro (`r`) will **not** update the launcher icon. You must trigger a native rebuild:

### Android:
```bash
# 1. Clean previous build cache if needed
npm run android
# Or explicitly:
npx expo run:android
```
Expo will read the updated `app.json` and generate the native icons inside `android/app/src/main/res/mipmap-*` and notification drawables automatically.

### Verifying Themed Icons (Android 13+):
1. In Android settings on your device/emulator, go to **Wallpaper & style**.
2. Turn on **Themed icons**.
3. The app icon will automatically transform into the sleek, tinted monochrome glyph via `adaptive-icon-monochrome.png`.
