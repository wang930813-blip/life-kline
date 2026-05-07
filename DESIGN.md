# DESIGN.md - Oriental Classical Visual System

## Essence

The interface should feel 清雅神秘: quiet, airy, and classical, as if a digital destiny chart has been written onto fresh 宣纸. The mood is 仙气飘渺 rather than theatrical. Use restrained ornament, generous breathing room, soft ink edges, and slow motion.

## Palette

- 青黛 `#123c43`: primary ink, navigation text, structural borders.
- 深青 `#0b2529`: deepest emphasis and night-ink panels.
- 朱砂红 `#a8322a`: primary action, active state, seal marks, small accents.
- 米色 `#f4ead2`: page canvas and parchment controls.
- 宣纸白 `#fbf7ea`: elevated surfaces and modals.
- 竹青 `#5f7356`: secondary accents and bamboo borders.
- 淡墨 `#6f675a`: body copy and secondary labels.
- 金砂 `#c8a45d`: rare highlight lines.

## Texture

Every major page should sit over a layered 宣纸纹理: warm beige base, faint paper fibers, diluted ink wash, and distant 山水 silhouettes. Decorative 祥云 should be present but subtle, never blocking text or controls.

## Typography

Headings use 行书-style local fonts when available: `STXingkai`, `华文行楷`, `KaiTi`, serif fallback. Body text uses 楷书-style local fonts: `KaiTi`, `STKaiti`, `Noto Serif SC`, serif fallback. Keep text legible and avoid overly thin weights.

## Layout

Desktop keeps a calm three-column structure. The left navigation is a vertical scroll panel. The center content is a rice-paper reading surface. The right sidebar uses lighter parchment with ink dividers. Mobile becomes a single scrollable paper sheet with a fixed bottom scroll-strip navigation.

## Components

Buttons and dialogs should resemble soft scroll paper: horizontal cap shadows, cinnabar emphasis, ink-colored text, and a light pressed state. Cards use bamboo-slip borders or double ink borders. Inputs should feel like brush-written form fields on paper, with muted ink outlines and cinnabar focus rings.

## Motion

Page load: a slow 卷轴展开 animation. Decorative clouds: gentle drifting. Button click: 墨点扩散 ripple. Respect reduced-motion preferences.
