# Canvas performance notes

## Current safeguards

- React Flow renders visible elements only (`onlyRenderVisibleElements`).
- Node dragging updates React Flow's local node state. The workspace saves positions at drag stop, and arrangement does not rewrite DSL.
- Dagre runs only when the user invokes Auto layout.
- Edge route analysis is memoized against committed graph nodes and edges. Selection and simulation styling do not rerun cycle detection.
- Workspace state is read through focused Zustand selectors; canvas positions are kept separate from authored DSL content.

## 500-node measurement

An exploratory browser run used Windows, Edge/Chromium 154, eight reported logical processors, a 1440 × 900 viewport, and the Next.js development server. The graph contained 500 services, 499 links between consecutive services, and 48 longer links. At 25% zoom after Fit view, React Flow mounted 39 node cards. Pointer drag moved a node 41 screen pixels and persisted the new position. Wheel zoom and space-drag pan both moved the viewport.

Across the drag, zoom, and pan sequence, 79 animation frame intervals had a 267 ms 95th percentile and a 333 ms maximum. This confirms the interactions worked in that run and records observable stalls. Repeat on target hardware with a production build before setting a frame-rate or latency budget.
