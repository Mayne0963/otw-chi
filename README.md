This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Style Guide

- **Theme**: Premium minimal, dark-first OTW brand theme via CSS variables in `styles/globals.css`.
- **Core tokens**: `background`, `foreground`, `primary` (OTW red), `secondary` (OTW gold), `border`, `ring`, `surface-1/2/3`.
- **Typography**: Display = Fraunces, body = Manrope (set in `app/layout.tsx`).
- **Spacing**: 4px base unit (`--space-1` to `--space-10`).
- **Interactive palette**: Use `secondary` (gold) for primary CTAs; reserve `primary` (red) for critical or destructive actions.
- **Motion**: Use `duration-300` with `transition-colors`/`transition-opacity`; respect `prefers-reduced-motion`.
- **Accessibility**: Maintain clear focus states (`focus-visible:ring-2` + `ring`) and strong contrast.
- **Reference**: Full design system notes live in `docs/ui-design-system.md`.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to load Fraunces and Manrope for display and body typography.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
