# Ambassador content assets

Prepared 2026-09-14 for the XtraPoint homepage ambassador gallery.

## Source and selection

User-supplied source: `/Volumes/Client Drive/XtraPoints Drive/07_Graphics/Ambassador UGC Mocks/Approved/`. All 32 PNGs were reviewed visually in two labeled contact sheets. Only files from this explicit Approved directory were used. Source images remain unchanged.

The selected 24 images show varied campus, dorm, sports, café, apparel, and streaming contexts. These are illustrative ambassador content mockups. The interface does not identify them as real testimonials, invent participant identities, or add social engagement counts. People are described only through the visible scene.

## Optimized outputs

All selected originals are 941×1672. Each is resized proportionally to 600×1066 WebP at quality 84, and 320×569 WebP at quality 80. Embedded phone screens and full portrait compositions are retained, without cropping. The smaller files serve the wall; full-size files are available for denser displays and the expanded viewer. Total of both sets: 2,286,452 bytes.

| Source PNG | WebP under `public/images/ambassadors/` | 600px bytes | 320px bytes |
| --- | --- | ---: | ---: |
| `01-man-campus.png` | `01-man-campus.webp` / `01-man-campus-320.webp` | 76,128 | 25,538 |
| `02-woman-dorm.png` | `02-woman-dorm.webp` / `02-woman-dorm-320.webp` | 74,812 | 20,388 |
| `03-man-court.png` | `03-man-court.webp` / `03-man-court-320.webp` | 84,990 | 25,830 |
| `05-man-dorm.png` | `05-man-dorm.webp` / `05-man-dorm-320.webp` | 60,280 | 18,284 |
| `06-woman-student-center.png` | `06-woman-student-center.webp` / `06-woman-student-center-320.webp` | 66,774 | 20,966 |
| `08-woman-room.png` | `08-woman-room.webp` / `08-woman-room-320.webp` | 65,470 | 18,068 |
| `10-woman-track.png` | `10-woman-track.webp` / `10-woman-track-320.webp` | 62,518 | 21,648 |
| `11-coffee-campus-walk.png` | `11-coffee-campus-walk.webp` / `11-coffee-campus-walk-320.webp` | 108,176 | 36,434 |
| `12-basketball-seated.png` | `12-basketball-seated.webp` / `12-basketball-seated-320.webp` | 114,290 | 36,456 |
| `13-cafeteria-lunch.png` | `13-cafeteria-lunch.webp` / `13-cafeteria-lunch-320.webp` | 69,776 | 24,252 |
| `14-football-sideline.png` | `14-football-sideline.webp` / `14-football-sideline-320.webp` | 68,896 | 22,698 |
| `15-stadium-bleachers.png` | `15-stadium-bleachers.webp` / `15-stadium-bleachers-320.webp` | 82,540 | 26,500 |
| `17-gym-courtside.png` | `17-gym-courtside.webp` / `17-gym-courtside-320.webp` | 66,042 | 23,734 |
| `18-library-steps.png` | `18-library-steps.webp` / `18-library-steps-320.webp` | 74,910 | 25,348 |
| `19-campus-crosswalk.png` | `19-campus-crosswalk.webp` / `19-campus-crosswalk-320.webp` | 111,828 | 36,610 |
| `20-stadium-concourse.png` | `20-stadium-concourse.webp` / `20-stadium-concourse-320.webp` | 71,166 | 23,990 |
| `21-morning-kitchen-self-recording.png` | `21-morning-kitchen-self-recording.webp` / `21-morning-kitchen-self-recording-320.webp` | 72,008 | 22,856 |
| `22-bedroom-streamer-hoodie.png` | `22-bedroom-streamer-hoodie.webp` / `22-bedroom-streamer-hoodie-320.webp` | 47,650 | 18,488 |
| `23-dorm-jersey-unpacking.png` | `23-dorm-jersey-unpacking.webp` / `23-dorm-jersey-unpacking-320.webp` | 69,958 | 23,410 |
| `24-campus-walking-selfie.png` | `24-campus-walking-selfie.webp` / `24-campus-walking-selfie-320.webp` | 73,598 | 26,070 |
| `25-late-night-streamer.png` | `25-late-night-streamer.webp` / `25-late-night-streamer-320.webp` | 41,634 | 15,474 |
| `26-stadium-seat-selfie.png` | `26-stadium-seat-selfie.webp` / `26-stadium-seat-selfie-320.webp` | 53,988 | 19,228 |
| `27-bedroom-flag-show.png` | `27-bedroom-flag-show.webp` / `27-bedroom-flag-show-320.webp` | 39,856 | 13,586 |
| `30-desk-streamer-cap.png` | `30-desk-streamer-cap.webp` / `30-desk-streamer-cap-320.webp` | 62,034 | 21,274 |

## Interaction implementation

`src/components/marketing/AmbassadorWall.tsx` imports `src/styles/ambassador-wall.css`. Use `<AmbassadorWall client:visible />` inside the homepage section. No additional dependency was installed.

The [React Bits Drift Wall reference](https://reactbits.dev/components/drift-wall) and its [primary TypeScript source](https://github.com/DavidHDev/react-bits/blob/main/src/ts-default/Components/DriftWall/DriftWall.tsx) were inspected for the alternating-column drift concept. This implementation uses CSS transforms with repeated groups rather than a per-frame React or JavaScript animation loop.

- Five columns at container widths of 1200px or more, four at 960–1199px, three at 600–959px, and two below 600px. Each column has a distinct start offset and 228–282 second cycle; adjacent columns alternate direction. Container queries preserve the same breakpoints before hydration and without JavaScript.
- The visual viewport clips at its outer edges with a soft fade. Individual images preserve their full aspect ratio.
- Motion pauses on hover, focus, loss of viewport visibility, hidden document, or open gallery. Explicit Play overrides the current hover/focus until the next interaction, so focus can remain on the control.
- Reduced-motion preferences show a static scrollable gallery with every unique image keyboard accessible. Before hydration or without JavaScript, original image links and the static gallery remain available.
- Repeated animated copies are hidden from assistive technology. The View all 24 examples control opens the same complete image set through a native modal dialog with visible Previous/Next controls, left/right keyboard navigation, Escape, and focus return.
- Enlarged images use the same 600px full-size source, with no crop. All mockup descriptions are grounded in visible content.

## Verification

An isolated browser fixture verified normal motion, hover pause, explicit Play with retained focus, gallery opening, arrow-key navigation, Escape/focus return, offscreen pause, two-column mobile layout, no horizontal overflow, and the static reduced-motion gallery. No runtime errors occurred. Desktop, mobile, dialog, and reduced-motion screenshots were visually reviewed. Contact sheets, manifests, and browser QA files are in `/tmp/xtrapoint-ambassadors/`; they are not production assets.
