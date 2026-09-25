# Cja's Tools — Build Plan

**171 tools · 47 working days · Sat 26 Sep 2026 → Tue 29 Dec 2026**

Two things get built from one set of files:

- **Website** — `https://chami123jano.github.io/cjas-tools` (free, no download)
- **Desktop app** — `Cja's Tools.exe` on GitHub Releases (free, works offline)

Work one day, skip the next. Every batch ends with both published.

---

## Phase 0 — Setup and first working build

| Day | Date | Task | Done |
|-----|------|------|:----:|
| 1 | Sat 26 Sep | Install Rust, create project, window opens | [ ] |
| 2 | Mon 28 Sep | Sidebar, search box, page switching + 3 tools | [ ] |
| 3 | Wed 30 Sep | 5 more tools, build .exe, switch on website, **publish v0.1** | [ ] |

Starter 8: percentage calculator, word counter, case converter, unit converter,
password generator, QR code generator, JSON formatter, PAYE tax calculator.

## Phase 1 — Easy wins

| Batch | Days | Dates | Content | Version | Total |
|-------|------|-------|---------|---------|-------|
| 1 | 4–6 | 2, 4, 6 Oct | Calculators + converters | v0.2 | 23 |
| 2 | 7–9 | 8, 10, 12 Oct | Sri Lanka tools + text tools | v0.3 | 39 |
| 3 | 10–12 | 14, 16, 18 Oct | Money | v0.4 | 54 |
| 4 | 13–15 | 20, 22, 24 Oct | Developer tools + security | v0.5 | 70 |
| 5 | 16–18 | 26, 28, 30 Oct | Developer tools 2 + SEO + misc | v0.6 | 85 |

## Phase 2 — Tools that save data

| Batch | Days | Dates | Content | Version | Total |
|-------|------|-------|---------|---------|-------|
| 6 | 19–21 | 1, 3, 5 Nov | Time tools + generators | v0.7 | 100 |
| 7 | 22–23 | 7, 9 Nov | Generators 2 + world tools | v0.8 | 112 |

## Phase 3 — Images and PDFs

| Batch | Days | Dates | Content | Version | Total |
|-------|------|-------|---------|---------|-------|
| 8 | 24–26 | 11, 13, 15 Nov | Images part 1 | v0.9 | 123 |
| 9 | 27–29 | 17, 19, 21 Nov | Images part 2 | v0.10 | 133 |
| 10 | 30–32 | 23, 25, 27 Nov | PDF part 1 | v0.11 | 141 |
| 11 | 33–35 | 29 Nov, 1, 3 Dec | PDF part 2 | v0.12 | 149 |

## Phase 4 — Audio and video

| Batch | Days | Dates | Content | Version | Total |
|-------|------|-------|---------|---------|-------|
| 12 | 36–38 | 5, 7, 9 Dec | Audio | v0.13 | 158 |
| 13 | 39–41 | 11, 13, 15 Dec | Video part 1 (FFmpeg added) | v0.14 | 165 |
| 14 | 42–44 | 17, 19, 21 Dec | Video part 2 | v0.15 | 171 |

Day 39 (11 Dec) is the heavy download day — FFmpeg is ~32 MB and the .exe
grows from ~10 MB to ~45 MB.

## Phase 5 — Finish

| Day | Date | Task | Done |
|-----|------|------|:----:|
| 45 | Wed 23 Dec | Icon, dark mode, About page | [ ] |
| 46 | Sun 27 Dec | Installer, README, screenshots, tool index for search engines | [ ] |
| 47 | Tue 29 Dec | Test all 171 tools, fix bugs, **publish v1.0** | [ ] |

Spare catch-up days: Thu 31 Dec, Sat 2 Jan.

---

## Milestones

- **30 Sep** — working app + live website, 8 tools
- **18 Oct** — 54 tools
- **30 Oct** — 85 tools, halfway
- **3 Dec** — 149 tools, all but audio and video
- **29 Dec** — v1.0, all 171 tools

## Rules for this project

1. The repository stays **public** — that is what makes Pages and the build
   robot free.
2. **No API keys in the code, ever.** Currency and exchange-rate tools must use
   free sources that need no key.
3. On the website, FFmpeg loads from a public CDN so it never counts against
   GitHub's traffic limit. The .exe bundles its own copy so it stays offline.
4. Every batch ships. Never leave a half-finished app sitting on the machine.

## Known limitations

- The .exe is unsigned, so Windows shows *"Windows protected your PC"* on first
  run. Users click **More info → Run anyway**. A signing certificate costs about
  LKR 60,000/year and is not worth it. The website is the answer for anyone who
  does not want to download.
- Currency, exchange rate and bank rate tools need internet. Everything else
  works fully offline.
- US-only tools (ZIP codes, FIPS, congressional districts, state abbreviations,
  etc.) were deliberately dropped — 15 tools, not useful here.
