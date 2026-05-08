---
name: sns-research
description: Research public social media and video signals with free-first data sources, then turn findings into competitor analysis, trend summaries, content ideas, hooks, scripts, and LP or campaign insights. Use when Codex needs SNS research for YouTube, Threads, X/Twitter, Instagram, TikTok, creator strategy, social listening, niche validation, viral format analysis, or recurring social performance reports, especially when the user wants free or low-cost sources before paid tools.
---

# SNS Research

## Overview

Use this skill to collect public social signals without defaulting to paid tools. It prioritizes official or free-tier sources, keeps platform rules in view, and turns noisy social data into useful content, campaign, and product direction.

## Source Priority

1. Official APIs with free quota.
   - YouTube Data API for YouTube channels, videos, playlists, comments, search, and statistics.
   - Platform-native analytics only when the user has provided access or exported data.

2. Free-tier MCP or data tools.
   - Bright Data MCP free tier for public web pages, search, and light public social extraction.
   - Apify free plan for small, bounded scraper runs when an appropriate Actor exists.
   - Algrow or Metricool only when the user has an account/subscription and explicitly wants those services.

3. Public web and browser research.
   - Use the Codex Chrome plugin/direct Chrome access when available for public post/profile/video inspection, side-by-side tabs, screenshots, and lightweight background checks.
   - Search results, public profiles, public posts, YouTube pages, creator websites, newsletters, and media coverage.
   - Use browser screenshots or page extraction when structured APIs are unavailable.

4. User-provided exports.
   - CSV/XLSX exports from YouTube Studio, Instagram Insights, Metricool, Buffer, Hootsuite, or similar tools.
   - If analyzing spreadsheet files, use the spreadsheet skill as the execution layer and this skill for research framing.

## Workflow

1. Scope the research.
   - Platform(s): YouTube, Threads, X/Twitter, Instagram, TikTok, LinkedIn, etc.
   - Niche and language/market.
   - Output: competitor map, trend report, content calendar, hooks, scripts, LP angles, or recurring report.
   - Time window and sample size.

2. Choose the cheapest reliable source.
   - Use YouTube Data API first for YouTube.
   - Use Codex Chrome plugin/direct Chrome access for light public-page verification when it is available and less costly than scraping/API calls.
   - Use Bright Data MCP or public web fallback for Threads/X/Instagram when official access is not available.
   - Use Apify only for small, bounded jobs and set strict result limits.
   - Do not use paid tools or actions that may incur cost unless the user asks or approves.

3. Collect only necessary public data.
   - Competitor identity, follower/subscriber counts when visible, posting cadence, post/video URLs, titles, captions, hashtags, engagement counts, timestamps, thumbnails, transcripts, comments, and format patterns.
   - Avoid private, logged-in-only, personal, sensitive, or unnecessary user-level data.

4. Normalize and analyze.
   - Compare engagement per post/video, posting frequency, topic clusters, hook patterns, content format, CTA, audience objections, and repeatable angles.
   - Mark thin or biased samples clearly.
   - Separate observed facts from interpretation.

5. Convert findings into action.
   - Recommend content angles, hooks, titles, thumbnail directions, posting experiments, LP claims, FAQ objections, lead magnets, or campaign tests.
   - Prefer 3-5 practical next actions over large generic lists.

## Output Format

```markdown
## Scope
- Platform:
- Niche:
- Time window:
- Source used:

## Findings
| Signal | Evidence | Interpretation | Confidence |
|---|---|---|---|

## Competitors Or Examples
| Account/channel | Why relevant | Pattern to learn | Caveat |
|---|---|---|---|

## Recommended Actions
1.
2.
3.

## Content Ideas
| Idea | Hook | Format | Source signal |
|---|---|---|---|

## Limits
- Data gaps:
- Platform/API limits:
- Compliance notes:
```

## Free-First Guardrails

- Ask before using any tool likely to spend credits beyond free quota.
- Set explicit result limits before scraping: usually 20-100 items for research, 5-20 accounts/channels for competitor analysis.
- Prefer sampling over exhaustive collection.
- Cache or reuse prior exports when available.
- Include links or IDs for traceability, but avoid collecting personal data that is not needed.

## Platform Notes

- YouTube: official API is preferred. Search calls can consume quota quickly; use channel/video/list endpoints when IDs are known.
- Threads/X/Instagram: treat public web extraction as best-effort. Expect blocking, missing metrics, layout changes, and incomplete history.
- TikTok: public web extraction can be unstable; keep samples small and verify manually when decisions matter.
- LinkedIn: be extra cautious. Prefer user-provided exports or public company pages.

## Compliance

- Use only public data or user-authorized exports.
- Do not bypass paywalls, private accounts, login walls, or access controls.
- Do not automate spam, engagement manipulation, mass following, or unsolicited outreach.
- For commercial reports, include source limits and do not overstate precision.
