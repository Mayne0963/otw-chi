# OTW UI Design System (Premium Minimal)

## Direction
- Premium minimal: large type, calm surfaces, restrained accents, and high contrast.
- Brand palette preserved: OTW black, gold, and red as primary accents.
- Visual rhythm: 4px spacing base, generous vertical breathing room.

## Typography
- Display: Fraunces (`--font-display`) for headings and hero text.
- Body: Manrope (`--font-sans`) for UI text and long-form copy.
- Scale: fluid type sizes via `clamp()` for h1-h4 to keep hierarchy consistent across breakpoints.

## Color Tokens
Core tokens live in `styles/globals.css`:
- Background: `--background` (near-black), `--surface-1/2/3` for layered panels.
- Text: `--foreground`, `--muted-foreground`.
- Brand: `--primary` (red), `--secondary` (gold).
- State: `--destructive`, `--ring`, `--border`, `--input`.

## Spacing System
Base unit = 4px:
- `--space-1` (4px) through `--space-10` (64px)
- Layout utilities (`.otw-container`, `.otw-section`) align to this scale.

## Breakpoints (Mobile-First)
Defined in `tailwind.config.ts`:
- `xs`: 320px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1440px

## Components
- Buttons: `default` (gold), `secondary`, `outline`, `ghost`, `destructive`.
- Inputs/Selects/Textareas: unified surface color, border, and focus ring behavior.
- Cards: consistent radius, shadow tokens, and hover elevation.

## Interactions
- 300ms transitions for hover/focus states.
- Smooth scrolling with reduced-motion fallback.
- Loading indicators via `Button` `isLoading` prop.

## Accessibility
- Contrast tuned to meet WCAG 2.1 AA.
- `focus-visible` rings on all interactive elements.
- `prefers-reduced-motion` supported in global styles.

## Performance Notes
- Fonts loaded with `display: swap` to avoid render blocking.
- Background effects are CSS-only (no large images).
- Animation fallbacks for reduced motion.
