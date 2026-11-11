# produkt — Product Requirements Document

**Status:** Initial product definition  
**Working concept:** FlowStitch (also considered: CanvasCraft, DiagramVerse)  
**Product name:** produkt

## 1. Product summary

produkt is a dark, infinite-canvas engineering workspace for sketching software architecture, connecting it to interface and data concepts, and explaining behavior through a simulated flow. Users can author a graph in a compact text DSL or ask an AI co-architect to create and revise it. The same graph appears as editable visual nodes, with links that can be explored in a storyboard without running a real service.

## 2. Problem and opportunity

Architecture discussions often split diagrams, code snippets, UI sketches, and example payloads across separate tools. That makes it hard to see how an interface relates to a service, where data moves, or how a proposed change affects a flow. produkt brings those artifacts into one workspace and keeps the written and visual graph synchronized.

## 3. Users and primary jobs

- **Software architects and engineers:** quickly express, review, and revise service and data relationships.
- **Product designers and product managers:** connect interface mockups to the services and data they depend on.
- **Technical collaborators:** use a reproducible storyboard to explain a proposed request or event flow.

Primary job: “Help me turn an architecture idea into a shared, editable visual model and show how a sample event moves through it.”

## 4. Product principles

1. Text and canvas are two views of one model, not competing copies.
2. AI proposes changes; the user can inspect and edit them.
3. Storyboard simulation is safe, local, and clearly distinguished from real execution.
4. Dense information remains readable through hierarchy, routing, and progressive disclosure.
5. Keyboard and screen-reader access are part of the canvas interaction model.

## 5. Core experience

### Workspace entry

Open a workspace into a dark engineering workbench with a left panel and a large canvas. The left panel has **Code** and **Chat** tabs; the canvas shows a subtle grid and the current graph. A bottom storyboard controller is available without obscuring the canvas.

### Author in the DSL

Users type a Mermaid-like graph DSL. After a 150 ms debounce, valid input is parsed and laid out, then rendered as editable canvas nodes and edges. The first release supports named nodes, node kinds, directed connections, and optional labels. Exact grammar and serialization rules are defined in DESIGN.md. Invalid input displays an inline diagnostic and keeps the last valid graph visible.

### Co-create with chat

Users can switch to Chat and issue `/stitch` followed by an architecture request. The assistant streams a proposed graph or edit. The user can apply it to the workspace, then continue editing in either view. The UI must distinguish a pending proposal from applied graph state. Chat is an assistant for drafting and revising diagrams, not an autonomous system operator.

### Connect UI and data concepts

Users can add Architecture Service, Data Schema, and UI Wireframe nodes. Wireframe nodes represent lightweight mock components such as forms, buttons, and lists. Users can connect an input or action to an architecture/data endpoint to describe intended mappings. The first release supports editable labels and sample mock values, not a production design tool or a live Figma integration.

### Tell a flow with Storyboard

Users select a trigger and sample payload in the bottom controller. Starting the storyboard advances the payload along connected edges, highlighting active nodes and showing the mapped mock state at each stop. Users can pause, step, reset, and inspect the payload. This simulation is local and never invokes a real backend.

## 6. Functional requirements

### Canvas and graph

- Provide pan, zoom, fit-to-view, selection, node movement, edge creation, and deletion.
- Support three node families: Architecture Service, Data Schema, and UI Wireframe.
- Provide automatic layout using Dagre when parsing or explicitly requested. Layout should reduce overlap and edge crossings; it cannot promise that crossings are eliminated for every graph.
- Provide a readable fallback edge style when preferred routing is unavailable.
- Maintain usable interaction for graphs of 500 or more nodes through canvas visibility/rendering optimizations.

### DSL and state synchronization

- Keep DSL text, graph nodes, and graph edges synchronized through a single Zustand-backed workspace state.
- Parse after 150 ms of inactivity. Do not replace the last valid graph when the current text has errors.
- Serialize supported canvas edits back into the DSL while preserving stable node IDs and supported metadata.
- Surface parse errors with line/column where available and an accessible association to the editor.

### Chat

- Support streaming assistant responses and the `/stitch` command.
- Provide an explicit apply action for graph proposals.
- Keep chat history in workspace client state. Do not expose model/provider credentials to the browser.
- Show useful loading, error, and retry states.

### Storyboard

- Allow a sample payload to be associated with a trigger node.
- Visualize the current node/edge and payload progression with shape, text, and color cues.
- Support start, pause, step, reset, and payload inspection.
- Use deterministic local mock rules; never execute user-authored code or contact a production endpoint.

### Accessibility and resilience

- Give the DSL editor an accessible name and instructions; expose diagnostics to assistive technology.
- Provide keyboard-accessible canvas pan/zoom, selection, and node/edge navigation, with visible shortcut help.
- Preserve readable focus indicators and adequate contrast across the dark palette.
- Retain a usable last-valid canvas during DSL parse failures, chat failures, and unsupported node data.

## 7. MVP scope

**Included:** single-workspace client state; DSL-to-graph and graph-to-DSL synchronization; Dagre auto-layout; three custom node families; manual canvas edits; streaming `/stitch` chat proposals; local storyboard simulation; keyboard-accessible core controls; responsive panel sizing.

**Not included in MVP:** real backend execution, production API testing, multi-user collaboration, cloud persistence/version history, authentication, billing, import/export integrations, full design editing, or a live Figma connection.

## 8. Success measures

- A new user can create a small service graph in the DSL and see it on canvas without a page reload.
- A canvas edit is reflected in the DSL and remains stable after a subsequent parse.
- Invalid DSL leaves the last valid canvas intact and identifies the error.
- A `/stitch` response can be reviewed and explicitly applied as a graph proposal.
- A sample storyboard can be started, paused, stepped, inspected, and reset without a backend call.
- Core canvas actions can be reached and understood using keyboard and screen reader controls.
- A 500-node graph remains navigable with visibility optimizations enabled.

## 9. Risks and product decisions

- **DSL round-trip fidelity:** define a constrained grammar and stable IDs; reject or preserve unknown constructs rather than silently dropping them.
- **Graph readability:** automatic layout is a starting point. Users retain manual positioning, and edge routing degrades gracefully.
- **AI variability:** treat output as a validated proposal; never apply unvalidated model output directly to graph state.
- **Large graphs:** use React Flow rendering/visibility options and avoid recomputing layout during ordinary node dragging.
- **Scope:** collaboration and persistence are deliberately deferred so the first release can prove the integrated authoring and simulation loop.

## 10. MVP acceptance criteria

1. The initial workspace presents code/chat on the left, canvas on the right, and storyboard controls at the bottom.
2. A valid DSL graph renders as custom nodes and directed edges; editing either view updates the shared model.
3. Parsing is debounced by 150 ms and syntax failures preserve the last valid rendered graph.
4. Dagre layout runs on request or a valid graph update and produces a readable arrangement; edge fallback remains visible for unsupported routes.
5. `/stitch` streams a response and graph changes require user review and an explicit apply action.
6. Storyboard controls simulate a payload through connected nodes locally and can pause, step, inspect, and reset.
7. Keyboard navigation, canvas pan/zoom shortcuts, editor labeling, and visible focus are available.
8. The 500-node target is addressed with canvas visibility/rendering optimizations rather than eager custom rendering of every off-screen node.
