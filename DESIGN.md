# produkt — Design and interaction system

## Product feel

produkt should feel like a focused engineering workbench: precise, quiet, information-dense, and easy to scan. Use the requested Dark-Mode Engineering Workbench direction. Avoid decorative gradients, glass effects, and motion that does not communicate state. Let graph structure and typography carry the visual hierarchy.

## Design tokens

| Token | Value | Use |
|---|---|---|
| `--background` | `#090D16` | App and canvas base |
| `--surface` | `#131B2E` | Panels, nodes, popovers |
| `--surface-raised` | `#19243A` | Hovered/raised controls and selected node interiors |
| `--border` | `#26334B` | Fine panel and node borders |
| `--text` | `#E2E8F0` | Primary text |
| `--text-muted` | `#94A3B8` | Secondary text and metadata |
| `--accent` | `#6366F1` | Primary actions, selection, focus |
| `--accent-active` | `#818CF8` | Active flow and selected edge |
| `--signal` | `#10B981` | Successful/active simulation signal |
| `--edge` | `#475569` | Default graph edge |
| `--danger` | `#F87171` | Errors and destructive actions |

Set the default color scheme to dark. Check text and focus contrast against actual component backgrounds; do not rely on color alone to communicate state.

### Type

- **Inter** for interface text, labels, navigation, and explanatory content.
- **JetBrains Mono** for DSL, node IDs, payload previews, and mapped values.
- Use a clear compact hierarchy: 12 px metadata, 13–14 px controls and body copy, 16–18 px section titles, and 20–24 px workspace title. Keep code at a comfortable readable size and do not shrink it to fit.

### Shape, spacing, and canvas texture

- Use a 4 px base spacing rhythm, with 8/12/16/24 px common gaps.
- Use `rounded-md` (6 px) for panels, controls, and node cards; reserve pill shapes for compact status tags.
- Use 1 px crisp borders. Shadows should be restrained and indicate elevation only.
- The canvas has a low-contrast grid overlay over `--background`; keep it subtle behind edges and labels.

## Workspace layout

```text
┌────────────────────┬─────────────────────────────────────┐
│ Code | Chat        │                                     │
│ DSL editor or      │       Infinite graph canvas         │
│ co-architect       │                                     │
├────────────────────┴─────────────────────────────────────┤
│ Storyboard: trigger · payload · play · step · reset       │
└──────────────────────────────────────────────────────────┘
```

- Desktop starts with a resizable left authoring panel and a flexible canvas occupying the remaining width.
- At narrow widths, authoring and canvas become switchable views; keep storyboard controls reachable and avoid compressing the canvas into an unusable strip.
- Keep primary workspace actions in a compact top toolbar: workspace title, undo/redo when supported, auto-layout, fit view, and keyboard shortcut help.
- Persist panel sizing only if workspace persistence is later introduced; initial state can be session-local.

## Component patterns

### Authoring panel

Use accessible tabs for **Code** and **Chat**. Code uses a monospaced editor with line numbers, syntax highlighting, and inline parse diagnostics. The editor has a persistent accessible label and concise shortcut/help text. Chat uses distinct user/assistant messages, a streaming indicator, a composer, and a clear `/stitch` affordance. Graph proposals have a review summary and explicit **Apply to canvas** action.

### Architecture Service node

Slate surface with a compact service icon, name, optional technology/detail line, and typed connection handles. Show input and output ports with text labels or accessible descriptions. Selected nodes use an indigo border/focus ring; simulated activity also uses a signal marker and textual state.

### Data Schema node

Slate surface with a data/schema glyph, schema name, and a short field preview. Render field names and types in JetBrains Mono. Keep long schemas collapsible and show a count or expansion affordance.

### UI Wireframe node

Represent a small form, button, or list as a low-fidelity wireframe card. Inputs and actions have named connection handles. Show mock values and data mappings in a compact inspectable panel, not as decorative UI chrome.

### Edges and routing

Use muted slate for ordinary connections and indigo for selection. Use indigo plus emerald signal cues during storyboard playback. Prefer simple orthogonal/step-like routes when they improve legibility and use a visible fallback route when needed. Dagre arranges graph nodes; it does not guarantee edge-crossing elimination, so preserve manual adjustment and avoid promising crossing-free output.

### Storyboard controller

Anchor a compact control strip along the bottom edge. It includes trigger selection, editable sample payload, play/pause, step, reset, and a concise current-step label. During playback, visually mark the active node and edge and provide a payload inspector. Respect reduced-motion preferences; transitions should communicate progression and remain brief.

## Interaction and states

- Canvas supports drag-to-pan, wheel/pinch zoom, fit-to-view, selection, keyboard movement where practical, and visible keyboard shortcut help.
- Provide clear idle, hover, selected, focused, running, success, parse-error, chat-loading, and chat-error states.
- Keep the last valid graph visible while the DSL has an error. Mark the stale canvas state and link the diagnostic to the editor location.
- Show a pending assistant graph proposal separately from applied state. Applying one should be undoable when undo is implemented.
- Canvas node/edge state and DSL text share one normalized Zustand workspace model. Derived layout coordinates and transient selection/playback state should be separated from authored graph content.

## DSL and graph model

Use a deliberately small, line-oriented grammar for the first release:

```text
service API [label="API Gateway"]
schema Order [label="Order"]
ui Checkout [label="Checkout Form"]
API -> Order [label="creates"]
Checkout -> API [label="submit"]
```

Node kinds are `service`, `schema`, and `ui`. Identifiers are stable, unique tokens; labels and edge labels are optional quoted strings. Blank lines and `#` comments are ignored. Invalid lines produce a line/column diagnostic. Do not infer executable behavior from this syntax.

Represent parsed content as a validated graph document containing nodes, edges, and supported metadata. Keep stable IDs across parse/serialize cycles. UI mappings and sample values are structured metadata. If metadata cannot be represented in the textual grammar, retain it in the graph document and clearly define its serialization behavior instead of silently discarding it.

## State and rendering architecture

- **Zustand workspace store:** authored graph, DSL source, active editor tab, conversation history, pending AI proposal, and storyboard mock data/state.
- **DSL module:** parser, validator, formatter/serializer, and source diagnostics. Debounce parse requests by 150 ms; only commit a graph when the source parses successfully.
- **Layout module:** Dagre layout receives validated nodes/edges and returns positions. Do not rerun on each pointer move; expose explicit auto-layout and use it after DSL graph changes where appropriate.
- **Canvas layer:** React Flow renders custom node types and supports pan/zoom, selection, and edge editing. Use visibility/rendering options for off-screen content and profile custom node cost at the 500-node target.
- **Chat layer:** Vercel AI SDK handles streaming through a server route. Validate proposed graph data before showing an apply action; keep credentials server-side.
- **Storyboard module:** deterministic local reducer advances a mock payload over graph connections. No real network calls or code execution.

## Accessibility

- Label the editor, chat composer, canvas controls, node controls, and storyboard actions.
- Provide keyboard shortcuts for pan/zoom, fit-to-view, and navigation; ensure shortcuts do not steal text-editor keystrokes.
- Ensure canvas elements can receive focus and have accessible names that include node type and label. Provide a keyboard path to inspect connected edges and nodes.
- Use visible focus indicators, status text, and icons/shapes in addition to color.
- Announce parse diagnostics and storyboard step changes through a restrained live region.
- Honor reduced-motion preferences and preserve browser zoom.

## Responsive behavior

At wide sizes, keep the editor/chat panel and canvas side by side. At compact sizes, provide a clear Canvas/Code/Chat view switcher and retain the same graph state. Keep the storyboard bar collapsible if vertical space is limited. Controls should remain usable with touch targets of at least 40 px where practical.
