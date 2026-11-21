# produkt

produkt is a local-first workspace for shaping a software system as text, a graph, and a deterministic storyboard. **FlowStitch** is the working concept name.

## Run locally

```sh
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The graph and DSL are stored in this browser's local storage. Cloud persistence is out of scope.

## Tests

Run the one-shot unit and component test suite with `npm test`. Use `npm run test:watch` during development.

To enable `/stitch`, copy `.env.example` to `.env.local`, set `OPENAI_API_KEY`, and restart the server. `OPENAI_MODEL` can select another model supported by the OpenAI adapter. The server returns a clear configuration error when no key is present; secrets are never sent to the browser.

## What is implemented

- A dark, desktop-first workspace with a starter checkout graph.
- A small native DSL with service, schema, and UI node declarations. It is Mermaid-inspired, not Mermaid or PlantUML compatible.
- Debounced source parsing, line diagnostics, a last-valid-graph fallback, stable authored IDs, and graph-to-source serialization.
- Keyboard-first canvas navigation, connection inspection, and a focus action that jumps from a parse diagnostic to its source location.
- An editable React Flow canvas, Dagre auto-layout, node inspector, and explicit node controls.
- Edge routing is handled separately from Dagre layout; cycles, reverse-direction links, self-loops, and parallel links use a visibly marked fallback route.
- A local deterministic storyboard with play, pause, step, reset, and sample-payload inspection. It makes no backend calls and executes no supplied code.
- A streaming `/stitch` co-architect route with validated additive graph proposals, explicit preview/apply, retry, and cancellation. Chat requires a server-side OpenAI API key.
- Editable form, action/button, and list wireframes, plus named connection mappings and example fields.

Choose **Checkout form** as the storyboard trigger and press **Play**. The order service uses its declared mock status to update **Order confirmation** from **Awaiting order** to **Confirmed** and display the sample email. Open **Payload** to inspect each step. To follow the data instead, use **Step** and choose **writes → Order record** at the order service.

## Share a workspace

Open **Workspace files** next to the produkt logo and choose **Export current workspace**. The downloaded `.produkt.json` file contains the DSL, graph mappings, node positions, and any source draft. Share it with someone who has produkt. They can choose **Import workspace**, review the preview, and select **Replace workspace** to open it. Chat and storyboard playback are local to the open session.

produkt keeps your storyboard trigger and sample JSON when you reload. To share a replay setup, select a trigger, enter valid sample JSON, and check **Include storyboard trigger and sample JSON** before exporting. The recipient can inspect the sample in the import preview and press **Play** after import. Playback starts from the trigger with a fresh trace.

## Starter DSL

```text
service API [label="API Gateway"]
schema Order [label="Order"]
ui Checkout [label="Checkout Form"]
field Checkout.email [type="Email", example="maya@studio.co"]
field API.customerEmail [type="Email"]
field Order.id [type="UUID"]
Checkout.submit -> API.createOrder [id="checkout-submit", label="POST /orders"]
map "checkout-submit" email -> customerEmail
API.createOrder -> Order [label="writes"]
```

Blank lines and `#` comments are ignored. Node and port IDs use letters, numbers, `_`, and `-`. Quote connection IDs, labels, and field types. Use `field` and `meta` for wireframe and schema data, and `port input API.createOrder` to declare a named port before connecting it. A `map` references a connection ID and copies a source field to one destination field of the same declared type. If a mapped service field is missing from the payload, the storyboard uses its declared example text as a mock output and reports it in the trace. A link with no mappings passes the payload through and reports that condition during playback. Canvas positions stay in the local workspace.

## Product brief

See [PRD.md](PRD.md) for scope and acceptance criteria, and [DESIGN.md](DESIGN.md) for visual tokens and interaction guidance.
