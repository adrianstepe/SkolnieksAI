# Build Component

Create a new React component for SkolnieksAI following project conventions.

## Instructions

1. Read `CLAUDE.md` for code style rules
2. Ask: component name, location (`components/ui/` or `components/chat/`), and props
3. Create the component with:
   - TypeScript strict (no `any`)
   - Named export
   - Tailwind only
   - Server Component by default; `'use client'` only when state/effects needed
   - All user-facing text in Latvian
4. Create colocated `.test.tsx` with at least 2 test cases
5. If `'use client'`, add error boundary wrapper
6. Run `npm run lint` to verify

## Rules

- Check existing components for patterns first
- Latvian for all labels, placeholders, aria-labels
- Mobile-first (students use phones)
- Accessible: ARIA attributes, keyboard nav
