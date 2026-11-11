# produkt — Product and interface design

**Concept:** FlowStitch — a hybrid diagram language, spatial architecture canvas, conversational co-architect, and lightweight UI/data storyboard.
**Design direction:** Dark-mode engineering workbench / tactical minimalism.
**Primary use:** working application screen, desktop first.

## 1. Art direction

The interface should feel like a live system map: precise, calm, and information-rich. Its visual identity comes from the product’s own materials—the monospaced diagram source, aligned graph topology, named ports, and moving storyboard signal. Avoid generic dashboard cards, ornamental gradients, glass effects, and decorative icon tiles. Use the canvas as the dominant surface; panels are tools around it.

The experience joins three familiar mental models without copying their entire products:

- **Diagram languages:** compact, versionable intent in text.
- **Spatial whiteboards:** freely positioned objects and relationships.
- **UI design tools:** tangible but deliberately low-fidelity components.

## 2. Visual tokens

### Primitive colors

| Token | Value | Role |
|---|---|---|
| `--color-space` | `#090D16` | Deep-space app/canvas ground |
| `--color-slate-panel` | `#131B2E` | Node and panel surface |
| `--color-slate-raised` | `#19243A` | Raised/hovered surface |
| `--color-border` | `#26334B` | Fine separators and outlines |
| `--color-indigo` | `#6366F1` | Primary action and selection |
| `--color-indigo-flow` | `#818CF8` | Active flow and focused edge |
| `--color-emerald` | `#10B981` | Successful simulation signal |
| `--color-edge` | `#475569` | Default connector |
| `--color-text` | `#E2E8F0` | Primary text |
| `--color-muted` | `#94A3B8` | Secondary text |
| `--color-danger` | `#F87171` | Invalid input and destructive state |

### Semantic tokens

Map primitives to semantic CSS custom properties: `--background`, `--surface`, `--surface-raised`, `--border`, `--text-primary`, `--text-secondary`, `--action-primary`, `--flow-active`, `--signal-success`, `--edge-default`, and `--status-error`. Components consume semantic tokens; do not scatter raw hex values through component styles.

### Typography

- Inter for interface labels, controls, help, chat prose, and node titles.
- JetBrains Mono for DSL, identifiers, port names where compactness matters, schemas, and payload inspection.
- Keep labels readable at normal zoom. Zooming the canvas scales graph content, not the surrounding editor and controls.
- Use weight and spacing for hierarchy before adding more colors. Avoid all-uppercase micro-labels as the default.

### Geometry and texture

- 4 px base spacing; common increments 8, 12, 16, 24, 32 px.
- `rounded-md` / 6 px corners for controls, panels, and nodes; avoid excessive pill forms.
- Thin, crisp borders and subtle elevation. Use shadow only for floating menus or drag previews.
- Low-contrast grid dots/lines on the canvas; fade the grid behind dense areas and keep it subordinate to edges.
- Prefer large quiet fields of color and a small number of useful separators to stacks of nested cards.

## 3. Workspace composition

```text
┌───────────────────────────────────────────────────────────────┐
│ produkt / workspace      Undo   Layout   Fit   Shortcuts      │
├───────────────────┬───────────────────────────────────────────┤
│ Code | Chat       │                                           │
│                   │                                           │
│ DSL editor or     │           Graph canvas                    │
│ co-architect      │   services · schemas · UI cards            │
│                   │                                           │
├───────────────────┴───────────────────────────────────────────┤
│ Storyboard   Trigger   Payload       Play  Step  Reset         │
└───────────────────────────────────────────────────────────────┘
```

The initial dual view should make the core proposition obvious: source and conversation on the left; their spatial result on the right. Do not force the user to open a separate “diagram” page. Keep the storyboard controller anchored at the bottom, compact when idle and expandable for payload details.

On small screens, switch between Canvas, Code, and Chat views instead of squeezing all three into columns. Keep graph and editor state unchanged when switching. The storyboard controller may collapse to a single trigger/status row with a dedicated expand action.

## 4. Information architecture and key screens

### Workspace / Canvas

The main work surface. Toolbar actions: workspace label, undo/redo when implemented, auto-layout, fit view, add node, and keyboard help. Canvas controls should not duplicate every command already available by keyboard.

### Code tab

Monospaced editor with line numbers, minimal syntax color, diagnostics in context, and a small parse status. Show the last successful sync revision/time when the visible canvas is stale. Keep editor input responsive while parsing is debounced.

### Chat tab

Conversation history, composer with `/stitch` command hint, stream status, and retry/cancel states. New graph output is a proposal object with a concise summary and preview controls, separate from regular explanatory prose. Include explicit **Apply proposal** and **Discard** actions.

### Node inspector

Selecting a node opens a contextual inspector or inline detail region, not a large permanent sidebar that steals canvas width. It edits service details, schema fields, wireframe fields/actions, mock values, or mappings according to node type.

### Storyboard mode

The bottom controller chooses the trigger, edits/loads a sample payload, and controls play/pause, step, reset, and inspect. A step list or payload inspector explains the current simulated state. Avoid theatrical animation; the signal should make causality legible.

## 5. Node, port, and edge language

### Architecture Service

Surface: slate panel with a strong title, optional short technology/role line, and input/output ports. A service’s kind should be readable even without its icon. Use compact metadata and allow details in the inspector.

### Data Schema

Surface: schema title and a concise field preview (`id: UUID`, `total: Decimal`). Show a field count and collapse/expand control when more fields exist. Use monospace for field names and types, sans serif for descriptions.

### UI Wireframe

Surface: a recognizable low-fidelity form, action/button, or list. Use actual field/action names and example values so the card teaches the intended interaction. Avoid polished fake screenshots or styling controls that imply a full design editor.

### Typed ports and mappings

Ports have names, directions, and compatible data kinds. When creating a connection, indicate the target and mapping; when incompatible, explain why and allow a deliberate override only if supported. Selection and keyboard focus increase handle visibility. Provide a non-drag connection path for keyboard users.

### Edges and routing

Default edges are `#475569`; selected edges use indigo; active storyboard edges use `#818CF8` with an emerald directional marker or label. Route style should favor legibility and predictable attachment points. Layout (node coordinates) and routing (edge path) are separate systems. Dagre supplies node layout; it is not a crossing-free edge router. Choose React Flow edge types/custom routing based on observed cases, preserve a visible fallback, and keep labels from colliding with nodes where possible.

## 6. DSL and graph document

The native MVP DSL is intentionally small and readable; it is inspired by diagram-as-text tools but is not a promise of Mermaid or PlantUML compatibility.

```text
service API [label="API Gateway"]
schema Order [label="Order"]
ui Checkout [label="Checkout Form"]
Checkout.submit -> API.createOrder [label="POST /orders"]
API.createOrder -> Order [label="writes"]
```

Rules for the first grammar:

- Node declarations use `service`, `schema`, or `ui`; IDs are stable and unique.
- Connections identify source and destination, optionally including named ports, followed by an optional label.
- Quoted labels support escaped quotes; blank lines and `#` comments are ignored.
- Parsing returns a document plus source diagnostics; it never executes content.
- Identifiers and endpoints must resolve. Invalid source must not partially replace the current valid graph.
- Wireframe field/action details and mock values need an explicit representation. Prefer extending the grammar with structured declarations or a documented metadata block; do not keep invisible metadata that gets lost on round-trip.

Graph document separates authored data (IDs, kinds, labels, ports, mappings) from derived layout coordinates and transient UI state (selection, viewport, playback). Use revision/source-origin metadata to prevent DSL↔canvas update loops.

## 7. Interaction and state transitions

### DSL sync

`typing → 150 ms idle → parse/validate → valid: commit graph revision → layout if needed → render`

`typing → parse/validate → invalid: keep last valid graph → show diagnostic → mark canvas as previous valid revision`

Canvas edits update authored graph data, then serialize supported changes to DSL with stable IDs. Moving a node changes layout coordinates without rewriting DSL unless position persistence becomes a documented DSL feature. This avoids noisy source changes after simple arrangement.

### AI proposal

`request → stream explanation/proposal → validate schema/references → preview diff → apply or discard`

The proposal should show nodes/edges added, changed, and removed before application. Applying merges only the proposed delta and must not silently discard unrelated user changes made while the response was streaming.

### Storyboard

`choose trigger → validate payload → ready → play/step → show active edge/node and resulting mock state → pause/reset/complete`

Simulation is a deterministic traversal over declared links and mock mappings. Branches require an explicit rule or a user-selected path; cycles require a visible stop/iteration rule. Missing mapping and terminal conditions are inspectable states.

## 8. Front-end architecture

- **Next.js App Router:** server-render the application shell where useful; put graph interaction in client components. Use a route handler as the AI transport boundary.
- **Workspace store (Zustand):** authored graph, source text/revision, chat history, proposal, and mock simulation. Separate derived coordinates/viewport and transient interaction state where appropriate.
- **DSL package/module:** parser, validator, formatter, source map/diagnostics, and schema for AI graph proposals. Pure functions with no React dependency.
- **Layout adapter:** Dagre input/output conversion; invoke on valid topology changes or explicit layout, not on each pointer move.
- **Canvas adapter:** React Flow node/edge types, typed connection validation, keyboard behavior, and rendering/visibility optimization.
- **AI route:** Vercel AI SDK streaming and structured graph output; validate server response and validate again before client application. Provider secrets stay server-side. Use `@langchain/core` only if its specific abstractions are needed; avoid overlapping libraries without an architectural reason.
- **Storyboard engine:** deterministic pure traversal/reducer over the graph and sample values. It has no network or code-execution capability.

React Flow’s own guidance treats layout as integration with external engines; Next.js route handlers provide an App Router server boundary; Vercel AI SDK supports streaming and structured output. See the technical references in [PRD.md](PRD.md).

## 9. Accessibility and resilience

- Persistent accessible labels for editor and chat; diagnostics associated with source lines and announced without moving focus unexpectedly.
- Keyboard equivalents for pan, zoom, fit, node/edge navigation, connection creation, and storyboard controls. Shortcuts are discoverable and do not override text editing.
- Focusable graph items have names including type, title, and relevant port/edge context. Provide a list/tree navigation mode when spatial navigation alone is insufficient.
- State uses contrast, text, icon/shape, and position cues; color is supplementary.
- Respect reduced motion and browser zoom. Keep targets comfortably operable.
- Parse failures, unsupported edges, chat transport failures, and invalid proposals preserve the last known valid state and provide a recovery action.

## 10. Performance and scale

The product target is navigability for 500+ nodes, not an unverified frame-rate claim. Use React Flow visibility/rendering features, memoized custom nodes, narrow Zustand selectors, and deferred layout. Avoid re-parsing or full layout during drag. Establish a representative benchmark graph and supported hardware before setting latency/frame budgets. Large schemas and chat histories should be collapsed or paginated/virtualized at their own boundaries.

## 11. Visual quality review checklist

- Does the first screen clearly show text/chat, graph, and storyboard as one workbench?
- Does the authored graph remain the visual focus instead of panels and toolbar chrome?
- Are node types identifiable by labels and structure, not just color?
- Are edges easy to follow at fit-to-view and close zoom levels? Are fallback cases still legible?
- Does the wireframe look intentionally low fidelity but contain meaningful labels and data?
- Can a user distinguish suggested, applied, invalid, and simulated state immediately?
- Does the interface remain information-rich without reducing text to tiny labels or filling the screen with cards?
- Are keyboard focus, reduced motion, narrow screens, and high zoom usable?
