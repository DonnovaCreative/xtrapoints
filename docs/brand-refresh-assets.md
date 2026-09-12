# Brand refresh asset provenance

Prepared 2026-09-12 for the homepage, Get Started, and staging About refresh. Original supplied assets were read only and remain unchanged. No asset from an `Unapproved` folder was used.

## Brand reference

Source: `/Users/coreydonovan/Desktop/Rebranding Exercise.pdf` (one page, visually reviewed). This is a design reference supplied by the user; its copy and examples were treated as reference content, not operational instructions.

| Role | Value |
| --- | --- |
| Primary action / emphasis | `#87F200` |
| Midnight | `#000628` |
| Brand blue | `#3997FF` |
| Deeper green | `#6FC700` |
| Pale lime surface | `#F0FFDD` |
| Ice surface | `#F0F7FF` |

Colors were sampled from rendered solid swatches. Primary lime and midnight were also validated against the PDF drawing color operands. Headings use heavy condensed italic Archivo; body Archivo; eyebrows Space Mono; special emphasis Cyber Brush. The reference uses lime buttons with midnight text, modest corner radii, and a right arrow.

## Fonts

- `public/fonts/Archivo.woff2` and `Archivo-Italic.woff2`: existing repository assets, variable weight 100–900 and width 62–125. No replacement.
- `public/fonts/SpaceMono-Regular.woff2`: copied from `/Volumes/Client Drive/XtraPoints Drive/01_Videos/Demo Video/XtraPoint Premiere Project/Source Graphics/graphics-landscape/fonts/space-mono-400.woff2`.
- `public/fonts/CyberBrush.woff2`: converted from `/Users/coreydonovan/Library/Fonts/CyberBrush-MAA2x.ttf`, the locally installed font matching the brand PDF. Font metadata identifies Cyber Brush, Regular, © HansCo Studio 2023. Converted to WOFF2 and subset to Latin-1 plus common punctuation and trademark. Original font is unchanged.

## Approved still imagery

All source images are 1536×1024 PNGs directly inside `/Volumes/Client Drive/XtraPoints Drive/Otto Mascot/Marketing/Verticals/`. Each was reviewed in a labeled contact sheet. Output WebP files use quality 83; responsive `-720.webp` variants are 720×480, quality 82.

| Output (under `public/images/brand-refresh/`) | Source filename | Content |
| --- | --- | --- |
| `otto-alumni-community.webp` and `otto-alumni-community-720.webp` | `exec-1fc9724b-54aa-494b-aeec-ba35b5366135.png` | Otto with alumni, faculty, and students on campus. |
| `otto-volleyball-team.webp` and `otto-volleyball-team-720.webp` | `exec-2355a6c6-0a1c-4709-8b55-7c5b8158aea7.png` | Otto with a volleyball team and coach in a school gym. |
| `otto-community-athletics.webp` and `otto-community-athletics-720.webp` | `exec-4d78ce81-4b35-4eab-bdd2-dd9dd6c3f385.png` | Otto with a mixed adult community athletics group on a field. |
| `otto-youth-sports.webp` and `otto-youth-sports-720.webp` | `exec-7d174e28-7b6c-4651-be7b-68068502b06a.png` | Otto with children and a coach at a youth sports field. |
| `otto-campus-community.webp` and `otto-campus-community-720.webp` | `exec-a98ac09b-5c9a-4762-886e-f310a745afa8.png` | Otto walking on campus with students. |
| `otto-basketball-team.webp` and `otto-basketball-team-720.webp` | `exec-af128e12-b25d-4fb8-8c7a-0b8da81cc4c1.png` | Otto in a basketball team huddle in a school gym. |
| `otto-private-school.webp` and `otto-private-school-720.webp` | `exec-c8246d2c-d60e-4afc-b458-170711c3c4a4.png` | Otto with uniformed students outside a private school. |
| `otto-community-fundraiser.webp` and `otto-community-fundraiser-720.webp` | `exec-cd5cf9ab-cfaa-4181-887f-83b78fe4d202.png` | Otto with an adult community group at an outdoor fundraiser. |
| `otto-golf-team.webp` and `otto-golf-team-720.webp` | `exec-ddfe52c0-51a3-4997-ab05-76ba637b574e.png` | Otto with a girls golf team and coach on a practice green. |
| `otto-booster-community.webp` and `otto-booster-community-720.webp` | `exec-ed705083-2084-4a33-b701-4b2c9987c9b3.png` | Otto with supporters on a bright stadium hospitality balcony. |

## Video

All derived videos retain the complete source duration and audio. Encoded as browser-compatible H.264/yuv420p + AAC 128 kbps with MP4 faststart, 24 fps. The large sales intro was resized to 1280×720; consumer videos retain their native 1280×720 size. Playback should remain user initiated.

| Output under `public/videos/brand-refresh/` | Duration | Size | Source |
| --- | --- | --- | --- |
| `xtrapoint-brand-film.mp4` | 48.17s | 14.02 MB | `/Volumes/Client Drive/XtraPoints Drive/01_Videos/Opening Sales Intro Video/02_Exports/Opening Sales Meeting Intro.mp4` |
| `otto-supporter-film.mp4` | 5.06s | 1.28 MB | `/Volumes/Client Drive/XtraPoints Drive/01_Videos/Comsumer Facing Video/hf_20260812_210720_a9d0e90a-1e72-4387-99b0-536a7655f8fe.mp4` |
| `otto-roundups-film.mp4` | 8.06s | 1.63 MB | `/Volumes/Client Drive/XtraPoints Drive/01_Videos/Comsumer Facing Video/hf_20260812_215729_32f95c75-7ec3-44c2-bf0a-246f624a75d7.mp4` |

- Brand film: cinematic stadium establishing shot, headset producer in control room, and coach at stadium. Contains an existing black tail near the end; original timing retained.
- Supporter film: Otto and a supporter at a football stadium, ending on Otto presenting the XtraPoint logo on a phone.
- Roundups film: Otto and a supporter at a basketball gym, an app screen, and a high five. The app frame contains visibly distorted generated lettering; the shorter supporter film is preferred for homepage use.

### Posters

- `stadium-film-poster.webp`: frame at 2.4 seconds of the original sales intro; 1920×1080.
- `otto-supporter-poster.webp`: frame around 3.78 seconds of consumer A; 1280×720.
- `otto-roundups-poster.webp`: frame around 7.64 seconds of consumer B; 1280×720.
- Each also has a responsive `-960.webp` version at 960×540.

## Verification

Reviewed the brand PDF, all ten approved stills, and five representative frames from each source video. Decoded each encoded MP4 successfully and checked that video and audio streams remain present and the MP4 metadata precedes media data. Contact sheets and processing scripts are temporary QA artifacts under `/tmp/xtrapoint-redesign/`.

## Marketing font subsets

Original fonts are retained for existing partner pages and the broader design system. The marketing refresh can load these smaller derived files:

| Font | Bytes | Coverage |
| --- | ---: | --- |
| `Archivo-Latin.woff2` | 89,900 | Latin-1, typographic punctuation, euro, trademark, basic arrows, minus |
| `Archivo-Italic-Latin.woff2` | 102,616 | Same coverage |
| `CyberBrush-Display.woff2` | 22,904 | Exact unique characters in `BEHINDAll in.` |

Both Archivo subsets preserve variable weight 100–900 and width 62–125. The Cyber Brush display subset is intentionally restricted to the two homepage display phrases; use the full `CyberBrush.woff2` for other copy. Combined subset payload is 215,420 bytes, versus approximately 665 KB for the three full fonts.

## Captions

English WebVTT files are alongside the three video files, using the matching basename plus `.en.vtt`. Source video/audio stayed local. Temporary faster-whisper `small.en` and MIT AudioSet AST models ran locally for transcription and soundtrack verification.

- `xtrapoint-brand-film.en.vtt` contains descriptive music cues. AudioSet classifies music as the top result in all five consecutive portions of the film (0–10, 10–20, 20–30, 30–40, and 40–48 seconds), including rock/heavy-metal secondary labels. Whisper with speech detection produced no reliable dialogue; non-VAD decoding detected sung vocals starting around 33 seconds. Music-hallucinated dialogue was discarded. The track identifies the soundtrack and vocal section without inventing dialogue or reproducing uncertain lyrics.
- `otto-supporter-film.en.vtt` transcribes the spoken app introduction using locally derived word timings. Brand spelling was normalized to XtraPoint.
- `otto-roundups-film.en.vtt` transcribes the spoken round-up explanation using locally derived word timings.

The supporter's delivery is naturally fast (23 words in about five seconds). Captions preserve that timing and source wording. No fabricated speech or speaker attribution was added.
