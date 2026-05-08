---
name: lazyweb-design-research
description: Research real product UI and landing-page references with Lazyweb MCP or fallback web/browser sources, then turn evidence into implementation-ready design direction. Use when Codex needs design inspiration, competitive UI research, LP structure guidance, UI improvement recommendations, or reference-backed frontend planning before building or revising a website, app screen, SaaS dashboard, mobile flow, CTA, pricing section, onboarding, checkout, or form.
---

# Lazyweb Design Research

## Overview

Use this skill to make visual and UX decisions from observed product references rather than generic model taste. Prefer Lazyweb MCP when available; otherwise gather reference evidence with available browser/search tools and clearly label the fallback.

## Workflow

1. Define the design question before searching.
   - Product/category: SaaS, ecommerce, mobile app, creator tool, marketplace, etc.
   - Surface: LP, dashboard, onboarding, pricing, checkout, settings, form, empty state, etc.
   - Goal: conversion, trust, clarity, activation, retention, speed of implementation.
   - Audience and constraints: Japanese/English market, B2B/B2C, brand tone, existing stack.

2. Check tool availability.
   - If Lazyweb MCP or a Lazyweb connector/tool is available, use it first.
   - If the Codex Chrome plugin/direct Chrome access is available, use it for public site inspection, tab-based comparison, screenshots, and parallel background reference checks without taking over the user's browser session.
   - If unavailable, use web search, image search, the in-app browser, user-provided screenshots, or existing design files.
   - Do not claim Lazyweb was used when only fallback sources were used.

3. Gather references.
   - Prefer 5-8 real product screens for a normal task.
   - For quick direction, collect 3-5 references.
   - For major redesigns, collect 8-12 references across direct competitors, adjacent products, and best-in-class patterns.
   - Save or cite enough evidence that another agent can verify the recommendation.

4. Extract patterns, not pixels.
   - Identify information architecture, hierarchy, CTA placement, section order, trust signals, pricing mechanics, navigation, form friction, visual density, and responsive behavior.
   - Avoid copying proprietary layout, imagery, copy, logos, or distinctive brand elements.
   - Use references to justify direction, then create an original implementation.

5. Convert research into build guidance.
   - Provide a concise design brief before implementation.
   - Include section order, visual hierarchy, component list, content priorities, responsive notes, and risks.
   - When building frontend UI, align with the repository's existing design system and the global frontend guidance.

## Output Format

For research-only requests, return:

```markdown
## Design Direction
- Goal:
- Audience:
- Recommended pattern:

## Reference Evidence
| Reference | Surface | Useful pattern | What to avoid |
|---|---|---|---|

## Implementation Guidance
- Structure:
- Visual style:
- CTA strategy:
- Components:
- Mobile notes:

## Risks
- Rights/mimicry:
- Accessibility:
- Conversion assumptions:
```

For build requests, add:

```markdown
## Build Plan
- Files/components to change:
- Assets needed:
- Verification:
```

## Lazyweb Usage Guidance

When Lazyweb is connected, ask for specific patterns rather than broad taste:

- "Find 6 SaaS pricing pages with strong annual/monthly toggle patterns."
- "Find mobile onboarding flows for language-learning or habit apps."
- "Find B2B dashboard empty states that encourage first action."
- "Compare checkout trust signals across consumer subscription apps."

If Lazyweb returns screenshots, keep them as references and cite or summarize them. If it returns local files, mention their paths when they are relevant to implementation.

## Fallback Sources

Use fallback sources when Lazyweb is not configured or fails:

- Public pages inspected through the Codex Chrome plugin/direct Chrome access
- Official product websites and public app pages
- Search/image search results for specific screen types
- User-provided screenshots or competitor URLs
- Browser screenshots from public pages
- Existing repository UI, design tokens, Storybook, or component library

Clearly label fallback output as "Lazyweb unavailable; used fallback sources."

## Safety And Quality

- Treat all third-party UI as reference material, not a template to clone.
- Do not reproduce brand assets, proprietary copy, or distinctive trade dress unless the user owns or supplied them.
- Check accessibility basics: contrast, keyboard reachability, focus states, readable type sizes, text overflow, and mobile layout.
- For LPs, prefer clear offer, proof, CTA, FAQ, pricing, and objection handling over decorative complexity.
- For operational tools and SaaS dashboards, prefer dense, calm, scan-friendly layouts over marketing-style hero sections.
