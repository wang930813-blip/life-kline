# Oriental Classical Theme Design

## Goal

Use the root `DESIGN.md` as the visual source for a refined classical Chinese interface across desktop and mobile. The product should feel quiet, mysterious, and airy, with cyan-black ink, cinnabar red, warm rice paper, scroll surfaces, bamboo-slip card edges, drifting auspicious cloud motifs, and restrained ink animations.

## Visual System

The palette centers on:

- Qingdai ink: deep blue-green for primary surfaces, text emphasis, and navigation.
- Cinnabar: restrained red accents for primary actions, active states, and seals.
- Rice paper: warm beige page canvas and elevated surfaces.
- Ink gray: readable body text and dividers.

The global page background uses layered CSS gradients to simulate xuan paper fiber, distant mountain wash, and soft cloud movement. Typography uses local system Chinese fonts: headings prefer Xingkai-style fonts when available, while body text prefers Kaiti-style fonts with serif fallback.

## Layout

Desktop keeps the existing three-column app shell but changes the visual treatment:

- Left navigation becomes a parchment side scroll with bamboo-like top and bottom edges.
- Main content sits on a rice-paper canvas with soft ink borders instead of stark white panels.
- Right sidebar remains collapsible but uses paper and ink styling, with less modern gray chrome.

Mobile keeps the current single-column flow and bottom navigation:

- The page background remains parchment-like.
- The bottom navigation becomes a fixed scroll strip with cinnabar active states.
- Main content receives extra bottom padding for the decorated navigation bar.

## Components

Buttons and navigation items use a scroll-button style with cinnabar ink ripple on click. Modals use a scroll panel treatment with rolled cap shadows. Cards receive a bamboo-slip border treatment through global CSS selectors and reusable classes so existing pages become visually coherent without rewriting every card.

## Motion

On page load, the app shell uses a subtle scroll-unfurl animation. Decorative clouds drift slowly and remain non-interactive. Buttons get an ink-dot expansion effect on active/click states. Motion is disabled or reduced through `prefers-reduced-motion`.

## Implementation Boundary

The first pass focuses on global theme infrastructure plus the app shell, desktop sidebar, mobile nav, and auth modal. Business logic, data fetching, routing, and user-facing workflows remain unchanged.

## Verification

Verification should include:

- A theme verification script that checks the expected theme tokens, classes, and DESIGN.md language exist.
- `npm run build` to ensure React and TypeScript still compile.
