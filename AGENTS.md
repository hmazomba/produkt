# produkt — Agent guidance

## Project intent

produkt is an interactive visual workspace for designing and explaining software systems. Its first release combines a text DSL, a conversational architecture assistant, a React Flow canvas, lightweight UI/data mockups, and a simulated storyboard. Treat the PRD and design system as the source of truth:

- [PRD.md](PRD.md) defines users, scope, behavior, and acceptance criteria.
- [DESIGN.md](DESIGN.md) defines the visual language, interaction patterns, and front-end architecture.

## Technical constraints

- Use Next.js 15 or later with the App Router and TypeScript.
- Use Tailwind CSS v4 or later and CSS custom properties for the design tokens.
- Use Radix UI primitives (shadcn/ui where useful) for accessible interface controls.
- Use `@xyflow/react` for the canvas and graph interaction, and `@dagrejs/dagre` for automatic graph layout.
- Use Zustand as the client-side source of truth for graph, DSL, chat, and mock simulation state.
- Use the Vercel AI SDK (`ai`) for streaming chat transport and `@langchain/core` only where its message/model abstractions are needed. Keep provider secrets server-side.
- Use JetBrains Mono for code and mapped data; use Inter for interface text.

## Implementation guidance

- Keep graph parsing, graph layout, Zustand state, custom node rendering, chat transport, and storyboard simulation in separate modules with typed boundaries.
- Treat the DSL as untrusted input. Parse it into a validated intermediate graph before updating canvas state. Never execute DSL text or simulated payloads as code.
- Preserve user-authored DSL during edits. Canvas edits must serialize back to DSL without dropping unsupported or unmodified constructs.
- Debounce DSL parsing by 150 ms. A parse error must retain the last valid graph and show an actionable editor diagnostic.
- Keep storyboard execution local and deterministic; it must not call or execute a user's backend.
- Keep the canvas usable with keyboard controls and assistive technology. Include accessible names, visible focus, and non-color simulation status cues.
- Support large canvases through React Flow visibility/rendering options and avoid expensive full-graph work on each pointer update.
- Prefer small, focused components and pure functions for parsing, validation, layout, and simulation.
- Follow existing repository conventions when they exist. Document any deliberate deviation in the relevant design/decision document.

## Completion expectations

- Meet the acceptance criteria in [PRD.md](PRD.md) for any delivered feature.
- Do not claim that Dagre guarantees zero edge crossings. Use layout and routing choices to reduce crossings, and provide a readable fallback when routing cannot avoid them.
- Do not add tests or run test suites unless the user requests testing or verification.
