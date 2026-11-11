# produkt — Product Requirements Document

**Product:** produkt
**Concept name:** FlowStitch (preferred); alternatives explored: CanvasCraft, DiagramVerse
**Document status:** Product brief for MVP definition
**Audience:** Product, design, and engineering

## Executive summary

produkt is a visual system-design workspace that brings together three ways of thinking: a diagramming language, a spatial canvas, and a conversational co-architect. A user describes architecture in text or chat, sees it arranged as a readable graph, then places lightweight interface sketches beside it and connects their controls to data and services. A storyboard carries sample payloads through that graph so a team can reason about an experience without integrating or running a backend.

The product takes inspiration from PlantUML’s expressiveness, Mermaid’s cleaner modern diagrams, Miro’s open-ended spatial canvas, Stitch-style conversational design, and Figma’s approachable interface sketching. Its distinctive job is to connect those artifacts in one model rather than reproduce each product in full.

## The problem

Today, a system idea often moves between a diagram language, a manually arranged whiteboard, a chat thread, and UI mockups. PlantUML can express complex systems but its output can feel dense or dated. Mermaid is quick to author and often reads more cleanly, but it is not an open spatial workspace for placing interface concepts beside architecture. Miro gives teams room to think but requires substantial manual drawing. Figma can make interface concepts tangible, but detailed design work is unnecessary when the question is only how inputs map to system data and what a sample flow looks like.

This fragmentation makes it difficult to answer: “What does this interface action call, what data does it send, and what happens next?” produkt makes that relationship visible and discussable early.

## Vision and product promise

**Vision:** a shared visual workbench where people can move from architecture idea to connected interface storyboard in minutes.

**Promise:** describe or discuss a system, arrange it as a legible graph, connect a rough interface to it, and trace a sample event safely—without hand-drawing every connector or building a working integration.

## Target users and jobs

### Primary users

- **Engineers and software architects** shaping services, data boundaries, and event/request flows.
- **Product designers** exploring UI structure and system dependencies before high-fidelity design.
- **Product managers and technical leads** communicating a proposed experience to engineering and design partners.

### Jobs to be done

1. When I have an architecture idea, let me express it in text or conversation and get a diagram I can edit.
2. When architecture becomes dense, help me keep the diagram readable and let me adjust its spatial arrangement.
3. When I sketch an interface concept, let me connect its actions and fields to architecture endpoints without building a full Figma prototype.
4. When I need to explain a flow, let me trace a sample payload through the graph without calling real services.

## Product principles

1. **One model, multiple authoring surfaces.** DSL, chat proposals, and canvas edits should converge on a validated graph document.
2. **Readable by default, editable by choice.** Auto-layout and routing reduce manual cleanup; users retain control over positions and connections.
3. **AI is a co-author.** It proposes, explains, and revises. The user reviews and applies graph changes.
4. **Sketch the system boundary.** UI cards communicate structure and data mappings, not pixel-perfect visual design.
5. **Simulation is explicitly simulated.** Storyboard data is local and cannot be mistaken for a live integration test.
6. **Complexity is progressive.** Large graphs and schemas remain navigable through grouping, collapse, and inspection rather than tiny unreadable labels.

## Product scope and boundaries

### In the MVP

- A desktop-first, infinite graph canvas with an adjacent Code/Chat panel and a bottom storyboard controller.
- A small typed diagram DSL and bi-directional graph synchronization.
- Architecture Service, Data Schema, and UI Wireframe node families.
- Dagre-based node layout and clean edge rendering with routing fallbacks.
- `/stitch` conversational drafting with streaming responses and explicit proposal application.
- Local sample-payload simulation with play, pause, step, inspect, and reset.
- Local workspace state using Zustand; persistence can be added after the core interaction is validated.

### Explicitly out of scope for MVP

- Live backend calls, API integration testing, code execution, or deployment.
- Multi-user presence, shared editing, comments, or conflict resolution.
- Cloud workspace persistence, accounts, billing, and version history.
- Figma import/export or a full-fidelity UI design editor.
- Support for arbitrary PlantUML/Mermaid syntax or a promise of crossing-free layouts for every graph.

## Core user experience

### Entry and orientation

Opening produkt presents a working canvas immediately. The Code/Chat panel sits on the left; the interactive canvas takes the remaining space. A compact top toolbar exposes workspace name, auto-layout, fit-to-view, and shortcut help. The bottom storyboard bar is visible and compact. A useful starter graph or an explicit empty-state prompt should show how services, schemas, UI cards, and links fit together.

### Author architecture in text

The user enters a deliberately constrained Mermaid-like DSL. Valid changes are parsed after 150 ms of inactivity, validated, then reflected in the canvas. Parse errors are shown at their source location while the last valid graph remains rendered. Text and graph edits share stable node/edge identity; a canvas edit serializes back to text without silently losing supported metadata.

### Co-design with conversation

The user opens Chat and enters `/stitch` plus an intent, such as “Add a checkout flow that writes an order and emits a confirmation event.” The assistant streams an explanation and a typed graph proposal. The proposal is previewable, validated, and explicitly applied. Follow-up instructions can refine the current proposal or applied graph. The assistant must state uncertainty when the requested change is ambiguous and ask a focused follow-up inside the product where needed.

### Sketch an interface and connect it

The user adds a UI Wireframe card (form, button/action, or list) from a small palette. They can name fields/actions, set example values, and draw connections from them to schema fields, service inputs, or outputs. A mapping is a named relationship, not executable transformation code. The canvas shows enough mapping information to understand intent while keeping the node legible; details are inspectable on selection.

### Storyboard a sample flow

The user picks a trigger and supplies a JSON-like sample payload. Starting the storyboard advances a deterministic mock event through reachable links. The active node and edge are highlighted, the payload is inspectable at each step, and mock UI state updates from declared mappings. Users can pause, step, reset, or change the payload. Cycles, branches, and missing mappings must be surfaced as simulation conditions, not hidden or treated as real runtime behavior.

## Functional requirements

### Graph model and canvas

- Render an infinite pannable/zoomable canvas using `@xyflow/react`.
- Support Architecture Service, Data Schema, and UI Wireframe node types with typed handles.
- Allow add, select, move, connect, edit, and delete operations; support fit-to-view and explicit auto-layout.
- Use `@dagrejs/dagre` for node positioning. Treat edge routing as a separate rendering decision; Dagre does not itself guarantee non-overlapping edges.
- Prefer readable routes and spacing. If a route conflicts, loops, or is unsupported, render a visible fallback and preserve edge identity/editability.
- For graphs of 500+ nodes, use React Flow visibility options, bounded selectors, and avoid expensive whole-graph recalculation during pointer movement. Define measurable performance targets before implementation profiling.

### DSL and synchronization

- Maintain DSL source, validated graph, source diagnostics, and synchronization status in the workspace store.
- Parse after 150 ms debounce. Only valid parse results replace the last valid graph.
- Serialize supported canvas changes and metadata back to DSL while preserving stable identifiers.
- Prevent update loops by distinguishing source edits from graph-derived serialization and by tracking document revisions.
- Surface diagnostics with line/column, keyboard focus path, and an accessible announcement.

### Chat co-architect

- Provide a streaming chat interface invoked through `/stitch`.
- Keep assistant history in local workspace state for the current session.
- Return graph proposals as schema-validated structured data alongside a human-readable rationale.
- Preview changes and require explicit apply; never trust model output as valid graph data until validated.
- Keep provider credentials server-side and use a server route for model requests.
- Handle rate limits, network/model errors, cancellation, and retry without damaging the current graph.

### Wireframes and mappings

- Provide a small palette of form, action/button, and list wireframe elements.
- Support editable labels, field/action names, example values, and typed connections.
- Show mapping direction and destination clearly; surface missing or incompatible endpoints.
- Do not imply pixel-level fidelity, real integration, or executable data transformations.

### Storyboard simulation

- Start only from a chosen trigger and a valid sample payload.
- Advance according to graph connections and declared mock mappings using deterministic local rules.
- Support start/pause, single-step, reset, and current payload inspection.
- Show branch selection, cycles, unmapped fields, and terminal nodes explicitly.
- Make no network requests and execute no user or AI supplied code.

### Accessibility and resilience

- Label the DSL editor and chat composer; expose diagnostic and streaming status accessibly.
- Provide keyboard shortcuts for pan, zoom, fit-to-view, node navigation, and edge inspection; avoid hijacking editor typing.
- Ensure nodes, handles, menus, and storyboard controls have keyboard paths, accessible names, and visible focus.
- Communicate selection, error, and playback state through text/icon/shape as well as color.
- Preserve the last valid canvas during parser or chat failures; support usable fallback edges and unsupported node data.

## Non-functional requirements

- **Responsiveness:** DSL-to-canvas update begins within 150 ms after typing stops, excluding layout/render time.
- **Scale:** remain navigable at 500 nodes; benchmark target devices before setting hard frame-rate budgets.
- **Safety:** no backend execution in storyboard; no client exposure of model credentials; validate all DSL and AI graph input.
- **Maintainability:** separate parser, document model, layout, canvas presentation, AI transport, and simulation logic behind typed interfaces.
- **Responsive use:** desktop is the primary authoring experience; compact view switches between Canvas, Code, and Chat without losing state.

## Success criteria

### MVP validation outcomes

- A first-time user can create a small architecture in DSL and understand how to edit it visually.
- A user can make a canvas change and see it reflected in DSL without ID churn or lost supported data.
- A user can create a wireframe, connect an action to a system endpoint, and explain the mapping to a teammate.
- A user can request an architecture change in chat, inspect it, and apply it without overwriting unrelated graph content.
- A user can simulate a sample flow and tell which steps are mock behavior.
- A 500-node document remains navigable without forcing a full layout on every drag.

### Product measures to instrument after MVP

- Time from opening workspace to first valid graph.
- DSL parse success and correction rate.
- Percentage of AI graph proposals accepted, edited, or discarded.
- Percentage of graphs that include at least one UI-to-data mapping.
- Storyboard completion, reset, and branch-inspection rates.
- User-reported diagram readability on small, medium, and large graphs.

These are measures to collect, not claims about current performance or adoption.

## Assumptions and open product decisions

- **Project naming:** repository/product name is `produkt`; FlowStitch remains the concept name and preferred outward-facing candidate until branding is decided.
- **First-run content:** seed an editable sample architecture rather than presenting a blank canvas; validate this with onboarding feedback.
- **DSL compatibility:** define a native minimal DSL inspired by Mermaid’s readability; do not claim drop-in Mermaid or PlantUML compatibility in MVP.
- **Workspace persistence:** start with in-memory session state; decide local storage/export before inviting users to author important documents.
- **Chat provider:** use a provider-neutral Vercel AI SDK integration; choose an actual provider/model during implementation based on availability, cost, privacy, and latency.
- **Large-graph target:** “500+ nodes” is a navigability target, not a guarantee of a particular frame rate until measured.

## Technical guardrails

- Framework: Next.js 15+ App Router and TypeScript.
- Styling: Tailwind CSS v4+ with semantic CSS custom properties.
- Components: Radix UI primitives and shadcn/ui patterns where appropriate.
- Canvas: `@xyflow/react`; layout: `@dagrejs/dagre`.
- State: Zustand for workspace and transient interaction state, with derived state kept separate from authored graph content.
- AI: Vercel AI SDK (`ai`) for streaming and structured output. Include `@langchain/core` only if a concrete message/model abstraction is needed; it is not automatically required alongside the AI SDK.

## References informing technical boundaries

- React Flow documents layout engines as external integrations and separates layout from edge-routing options: [Layouting overview](https://reactflow.dev/learn/layouting/layouting).
- Next.js App Router supports server route handlers for request/response endpoints: [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers).
- Vercel AI SDK supports streaming and structured output, useful for separating chat text from validated graph proposals: [AI SDK](https://vercel.com/docs/ai-sdk).
