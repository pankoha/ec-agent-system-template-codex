---
name: pox-analysis
description: Analyze positioning with Points of X by identifying POD, POP, and POF from competitor evidence and translating it into the user's product concept, offer design, LP strategy, Amazon image structure, brand messaging, SNS/content angles, niche selection, or "why choose us" recommendations. Supports both 1-to-1 competitor comparison and aggregated competitor-review analysis for product concept design.
---

# POX Analysis

## Overview

Use this skill to find a defensible market position by translating market evidence into the user's own product concept. POX means Points of X and is composed of POD, POP, and POF.

There are two valid modes:

- 1-to-1 comparison mode: compare the user's offer with one competitor when the user asks for direct positioning against a named competitor.
- Competitor-review synthesis mode: combine multiple competitor reviews or competitor products into one competitor-side POX, then translate it into the user's POP, POD, POF, and winning product concept. Use this mode when the user provides multiple review files, review summaries, Amazon reviews, Rakuten reviews, competitor complaints, or asks for product concept design.

## Core Definitions

- POD: Points of Difference. Differences that become a credible reason to choose the user's offer.
- POP: Points of Parity. Similarities or category must-haves that customers expect before considering the offer.
- POF: Points of Failure. Reasons customers reject an offer or points that make a competitor win and the user's offer lose.

POX is not just a broad feature matrix. The correct unit depends on the user's intent. If the user wants direct competitive positioning, run one POX analysis per competitor. If the user wants product concept design from competitor reviews, aggregate the competitor evidence into category-level POP/POD/POF first, then convert it into the user's concept. If the intended mode is unclear, ask the user which output they want before analyzing.

## Competitive POX Translation Rules

When using competitor POX analysis to design the user's offer, image structure, LP, or positioning, do not copy all competitor points directly. Translate them as follows:

- Competitor POP: incorporate these into the user's offer or communication because they are category minimum requirements. Missing them can become a reason not to choose the user's offer.
- Competitor POD: selectively adopt only the parts that match the user's brand, product reality, and winnable position. Discard or weaken competitor PODs when they require head-on competition in areas where the user is unlikely to win, such as brand fame, legacy authority, lowest price, or scale.
- Competitor POF: identify the needs hidden inside what competitors intentionally discard, under-serve, or treat as weak. If customer demand exists there, convert that unmet need into the user's POD. Do not treat every competitor POF as something the user should also discard.

Example:

- If competitors avoid lowest-price competition, do not automatically make the user's offer cheap. Instead, check whether customers are really asking for lower price or for better everyday value, ingredient transparency, smaller commitment, or purchase confidence.
- If competitors pursue a very sweet dessert-like flavor and reviews show "too sweet" dissatisfaction, the user's POD can be "gentle sweetness" or "clean aftertaste" rather than stronger sweetness.
- If competitors rely on famous brand or heritage, the user's POD can be "chosen by ingredient fit and taste preference" rather than trying to imitate heritage.

Practical rule:

1. Bring competitor POP into the user's baseline.
2. Partially discard competitor POD where it is not winnable or not aligned.
3. Mine competitor POF for unmet customer needs.
4. Turn only the needs with evidence into the user's POD.
5. Keep unsupported, risky, or legally sensitive claims out of the final messaging.

## Mode Selection Rules

Choose the workflow from the user's request, not from a fixed template.

Use 1-to-1 comparison mode when:

- The user names one competitor and asks for direct comparison.
- The output goal is "why choose us over competitor X", sales battlecards, comparison LP, or competitive messaging.
- The user asks for separate analysis per competitor.

Use competitor-review synthesis mode when:

- The user provides multiple competitor review files or review exports.
- The user asks to divide reviews into good points and bad points, then perform POX.
- The goal is a sellable product concept, Amazon product image direction, LP concept, offer design, or new product planning.
- The user wants to identify what to incorporate, what to discard, and what unmet needs can become the user's POD.

Ask a clarifying question before proceeding when:

- It is unclear which product is the user's product.
- It is unclear whether the provided review files are competitors, the user's product, or a mix.
- It is unclear whether the user wants separate competitor-by-competitor POX or one synthesized category POX.
- The output destination matters but is unspecified, such as Amazon images, LP copy, product formulation, package design, or ad angles.

## Workflow A: 1-to-1 Comparison

1. Define the comparison pair.
   - User offer: product, service, LP, creator offer, SaaS, shop, course, agency package, etc.
   - Competitor: exactly one named competitor or comparable alternative.
   - Customer segment: who is deciding and in what buying context.
   - Decision goal: positioning, LP copy, pricing, feature design, SNS angles, niche selection, or product roadmap.

2. Gather evidence.
   - Use the user's materials first: LP, offer doc, screenshots, pricing, features, reviews, sales notes.
   - Use public competitor evidence: LP, pricing, reviews, social posts, product pages, FAQs, case studies.
   - Use `lazyweb-design-research` for UI/LP evidence when design references matter.
   - Use `sns-research` when social proof, creator positioning, or content angles matter.
   - Clearly distinguish observed facts from assumptions.

3. Fill POP first.
   - Identify the minimum category expectations the user must satisfy.
   - Examples: price transparency, delivery speed, refund policy, mobile support, security, credibility, support, testimonials.
   - POP rarely wins alone, but missing POP can lose immediately.

4. Fill POD second.
   - Identify differences that the target customer actually values.
   - Prefer specific, provable, and hard-to-copy differences.
   - Avoid calling every difference a POD. A difference that customers do not care about is not a strong POD.

5. Fill POF third.
   - Identify rejection triggers, anxieties, and disqualifiers.
   - Include competitor strengths that expose the user's weakness.
   - Include category-level failures such as too expensive, too slow, unclear outcome, weak proof, complex onboarding, or low trust.

6. Translate analysis into action.
   - LP: hero promise, section order, proof, FAQ, CTA, pricing explanation, objection handling.
   - Product: must-have fixes, feature priorities, packaging, guarantee, onboarding.
   - Content/SNS: hooks, comparison posts, proof posts, founder story, objection-led posts.
   - Sales: talk track, qualification questions, proposal emphasis.
   - Amazon/EC images: convert competitor POP into minimum-condition images, competitor POF with real demand into differentiation images, and competitor POD into selective reference points only when winnable.

## Workflow B: Competitor-Review Synthesis For Product Concept Design

Use this workflow when the input is competitor reviews and the desired output is the user's differentiated product concept.

1. Confirm the analysis frame.
   - Competitor evidence: review files, competitor ASINs, product pages, screenshots, or review summaries.
   - User product: existing product, planned product, or "to be designed from the market gap".
   - Target customer: who is buying and what situation they are buying for.
   - Output destination: product concept, Amazon main/sub images, A+ content, LP, package, ad copy, or offer design.
   - If any of these are unclear and cannot be reasonably inferred, ask the user before continuing.

2. Extract competitor review themes.
   - Summarize each competitor's good points and bad points before POX.
   - Use counts, rating distribution, repeated review language, and representative evidence where available.
   - Separate observed review facts from interpretation.
   - Do not treat every review equally if volume differs greatly; mention when one product has much more evidence than another.

3. Build one competitor-side POX from the review themes.
   - Competitor POP: category minimum conditions customers expect because many satisfactory reviews mention them or negative reviews complain when they are missing.
   - Competitor POD: reasons competitors are chosen, such as taste, price, capacity, authenticity, convenience, proof, design, or brand trust.
   - Competitor POF: competitor weaknesses, discarded attributes, unmet needs, anxieties, complaints, or underserved customer segments.

4. Translate competitor POX into the user's design rules.
   - Competitor POP -> user's POP: incorporate these as minimum conditions. Missing them creates rejection.
   - Competitor POD -> selective reference: adopt only the parts the user can credibly win or match. Discard areas where the user cannot win, such as lowest price, oldest heritage, largest volume, or famous brand authority.
   - Competitor POF -> unmet needs: check whether complaints reveal real customer demand. If yes, convert the need into the user's POD. If no, discard it.
   - Competitor POF -> user's POF: identify what the user's product must avoid, such as confusing preparation, weak proof, bad aftertaste, packaging anxiety, or unsupported claims.

5. Decide the user's sellable concept.
   - Define the category acceptance line: what the product must be recognized as.
   - Define the differentiation axis: what the product should own.
   - Define the discard line: what the product should not try to win.
   - Produce a concise concept statement that connects target customer, unmet need, product benefit, and proof direction.

6. Convert the concept into execution.
   - Amazon/EC images: minimum-condition images for POP, differentiation images for POD, objection-handling images for POF.
   - LP: hero promise, problem framing, proof order, FAQ, comparison logic, and CTA.
   - Product: formulation/spec priorities, package size, flavor/taste direction, included accessories, instructions, guarantee, or bundling.
   - Content/SNS: hooks based on unmet needs, comparison posts, proof posts, usage scenes, and objection-led posts.

## Competitor-Review Synthesis Output Format

```markdown
## Scope
- Goal:
- Competitor evidence:
- User product status:
- Target customer:
- Output destination:
- Unclear points / assumptions:

## Competitor Review Summary
| Competitor | Review volume | Good points (top 5) | Bad points (top 5) | Evidence strength |
|---|---:|---|---|---|
|  |  |  |  |  |

## Integrated Competitor POX
| Type | Competitor-side finding | Evidence | Customer meaning | User-side translation |
|---|---|---|---|---|
| POP |  |  | Minimum condition | Incorporate into user's baseline |
| POD |  |  | Competitor winning reason | Reference only if winnable |
| POF |  |  | Unmet need or rejection trigger | Convert to user's POD, avoid as user's POF, or discard |

## User Brand POX
| Type | User-side decision | Why | Execution |
|---|---|---|---|
| POP |  |  |  |
| POD |  |  |  |
| POF |  |  |  |

## Winning Product Concept
- Target:
- Category:
- Core unmet need:
- Differentiation:
- Discarded battles:
- Concept statement:

## Execution Directions
1.
2.
3.

## Confidence And Gaps
- Strong evidence:
- Assumptions:
- Questions for user:
- Research needed:
```

## 1-to-1 Comparison Output Format

```markdown
## POX Scope
- User offer:
- Competitor:
- Target customer:
- Decision context:
- Evidence used:

## POX Table
| Type | Point | Evidence | Customer meaning | Action |
|---|---|---|---|---|
| POP |  |  |  |  |
| POD |  |  |  |  |
| POF |  |  |  |  |

## Positioning
- Category we must be accepted in:
- Difference we should own:
- Failure points to avoid:
- One-sentence positioning:

## LP / Content / Product Actions
1.
2.
3.

## Confidence And Gaps
- Strong evidence:
- Assumptions:
- Research needed:
```

## Quality Rules

- Keep the analysis customer-centered, not company-centered.
- Treat "unique" as insufficient unless it creates customer value.
- Do not overstate differentiation when the evidence is weak.
- If POP is missing, recommend fixing POP before amplifying POD.
- If POF is severe, address it directly in product, offer, FAQ, guarantee, or proof.
- For new products, treat POF as what not to build, not only what currently fails.
- When analyzing competitors, do not classify competitor POF as "discard" by default for the user. First check whether there is an unmet customer need inside it.
- When converting competitor POF into the user's POD, clearly separate the discarded attribute from the customer need being adopted.
- Do not turn competitor POF into risky claims such as unsupported health benefits, unverified additive-free claims, unproven superiority, or direct comparative advertising without evidence.
- Do not force a 1-to-1 POX table when the user is asking for concept design from multiple competitor reviews.
- Do not assume the first file or first product is the user's product unless the user says so or the file names clearly indicate it.
- If the user's desired output is ambiguous, ask a concise clarifying question instead of producing the wrong structure.
- For competitor-review synthesis, always show the translation from competitor POP/POD/POF to user POP/POD/POF. The translation is the main value, not the competitor summary itself.
- Treat competitor good points and bad points as raw material. Good points do not automatically become the user's POD; bad points do not automatically become attributes to discard.

## Common Mistakes

- Comparing against a whole market instead of one competitor.
- Using 1-to-1 comparison mode when the user requested synthesis from multiple competitor reviews.
- Listing features instead of buying reasons.
- Calling basic category requirements POD.
- Ignoring POF because it is uncomfortable.
- Copying competitor POD directly into the user's concept even when it is not winnable.
- Treating competitor POF only as something to avoid instead of checking for an unmet need that can become the user's POD.
- Creating differentiation that breaks POP and makes the offer feel strange or untrustworthy.
