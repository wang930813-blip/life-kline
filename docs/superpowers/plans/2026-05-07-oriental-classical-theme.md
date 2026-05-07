# Oriental Classical Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply a classical Chinese visual system across desktop and mobile without changing business behavior.

**Architecture:** Add one verification script, replace the root design guide, extend global tokens and CSS utilities, then lightly update the app shell and navigation surfaces to opt into the theme. Existing page components inherit most styling through CSS selectors and shared classes.

**Tech Stack:** React 19, Vite 5, Tailwind CSS, TypeScript, CSS custom properties, Node verification script.

---

### Task 1: Theme Verification

**Files:**
- Create: `scripts/verify-oriental-theme.js`
- Modify: `package.json`

- [ ] Add a Node script that reads `DESIGN.md`, `styles/design-tokens.css`, `index.css`, `components/layout/AppShell.tsx`, and `components/layout/MobileNav.tsx`.
- [ ] Assert that the files contain the required tokens and class names: `--color-qingdai`, `--color-cinnabar`, `paper-texture`, `scroll-unfurl`, `ink-ripple`, `scroll-panel`, and `bamboo-card`.
- [ ] Add `verify:oriental-theme` to `package.json`.
- [ ] Run `npm run verify:oriental-theme` before implementation and confirm it fails.

### Task 2: DESIGN.md and Global Theme

**Files:**
- Modify: `DESIGN.md`
- Modify: `styles/design-tokens.css`
- Modify: `index.css`

- [ ] Replace `DESIGN.md` with the Oriental Classical visual system.
- [ ] Add color, font, shadow, texture, and motion tokens to `styles/design-tokens.css`.
- [ ] Add global CSS utilities for paper texture, mountain wash, cloud drift, scroll panels, bamboo cards, and ink ripple.
- [ ] Respect `prefers-reduced-motion`.

### Task 3: Layout and Navigation Surfaces

**Files:**
- Modify: `components/layout/AppShell.tsx`
- Modify: `components/layout/LeftNav.tsx`
- Modify: `components/layout/MobileNav.tsx`
- Modify: `App.tsx`

- [ ] Apply the paper background and scroll-unfurl wrapper to desktop and mobile layouts.
- [ ] Convert the left nav surface to a parchment scroll.
- [ ] Convert mobile nav into a scroll strip with cinnabar active states.
- [ ] Convert the auth modal into a scroll panel with ink styling.
- [ ] Keep labels, routes, handlers, and fetch logic unchanged.

### Task 4: Verification

**Files:**
- Read only after implementation.

- [ ] Run `npm run verify:oriental-theme`.
- [ ] Run `npm run build`.
- [ ] Review `git diff --stat` and ensure changes are limited to theme/layout files and docs.
