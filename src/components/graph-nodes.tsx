"use client";

import { memo, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Braces, FormInput, Server } from "lucide-react";
import type { GraphNode, GraphNodeData } from "@/domain/graph";
import { useSimulation } from "@/state/simulation";

const symbols = { service: Server, schema: Braces, ui: FormInput };

export const GraphNodeCard = memo(function GraphNodeCard({ id, data, selected }: NodeProps<GraphNode>) {
  const Icon = symbols[data.kind];
  const fields = data.fields ?? [];
  const isFlowActive = useSimulation((state) => state.activeNodeId === id);
  const values = useSimulation((state) => state.uiValues.get(id));
  const [expanded, setExpanded] = useState(false);
  const previewValue = (field: { name: string; type: string; example?: string }) => {
    const value = values && Object.hasOwn(values, field.name) ? values[field.name] : field.example ?? field.type;
    return typeof value === "string" ? value : JSON.stringify(value);
  };

  return (
    <article className={`graph-node graph-node--${data.kind}${selected ? " is-selected" : ""}${isFlowActive ? " is-flow-active" : ""}`} aria-label={`${data.kind}: ${data.label}`}>
      <Handle type="target" position={Position.Left} id="in" aria-label={`Connect input to ${data.label}`} />
      {data.targetPorts?.filter((port) => port !== "in").map((port, index) => <Handle key={`target-${port}`} type="target" position={Position.Left} id={port} style={{ top: `${58 + index * 16}%` }} aria-label={`Connect ${port} input to ${data.label}`} />)}
      <div className="node-heading">
        <span className={`node-mark node-mark--${data.kind}`} aria-hidden="true"><Icon size={15} strokeWidth={1.8} /></span>
        <div className="node-title-wrap">
          <span className="node-kind">{data.kind === "ui" ? "Wireframe" : data.kind === "schema" ? "Data schema" : "Service"}</span>
          <h3>{data.label}</h3>
        </div>
        <code className="node-id">{id}</code>
      </div>
      {data.kind === "ui" ? (
        <div className={`wireframe-preview wireframe-preview--${data.component ?? "form"}`}>
          {data.component === "action" ? (
            <><span className="wireframe-action">{data.detail || data.label}<span aria-hidden="true"> →</span></span>
              {values && fields.filter((field) => Object.hasOwn(values, field.name)).slice(0, 3).map((field) => <div className="wireframe-field" key={field.name}><span>{field.name}</span><code>{previewValue(field)}</code></div>)}</>
          ) : data.component === "list" ? (
            (fields.length ? fields : [{ name: "First item", type: "Preview", example: "Sample row" }]).slice(0, 3).map((field) => <div className="wireframe-list-row" key={field.name}><span>{field.name}</span><code>{previewValue(field)}</code></div>)
          ) : (
            <>
              {fields.slice(0, 3).map((field) => <div className="wireframe-field" key={field.name}><span>{field.name}</span><code>{previewValue(field)}</code></div>)}
              <span className="wireframe-submit">Continue <span aria-hidden="true">→</span></span>
            </>
          )}
        </div>
      ) : data.kind === "schema" ? (
        <div className="node-fields">
          {fields.slice(0, expanded ? undefined : 4).map((field) => <div className="field-row" key={field.name}><code>{field.name}</code><span>{field.type}</span></div>)}
          {fields.length > 4 && <button type="button" className="nodrag text-action fields-toggle" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? "Collapse fields" : `Show all ${fields.length} fields`}</button>}
          {!fields.length && <div className="node-note">{data.detail ?? "Schema fields"}</div>}
        </div>
      ) : (
        <div className="service-meta"><span>{data.detail ?? "Internal service"}</span></div>
      )}
      {data.kind !== "schema" && <Handle type="source" position={Position.Right} id="out" aria-label={`Connect output from ${data.label}`} />}
      {data.sourcePorts?.filter((port) => port !== "out").map((port, index) => <Handle key={`source-${port}`} type="source" position={Position.Right} id={port} style={{ top: `${58 + index * 16}%` }} aria-label={`Connect ${port} output from ${data.label}`} />)}
      {isFlowActive && <span className="flow-node-status">Active in storyboard</span>}
    </article>
  );
});

export const nodeTypes = { service: GraphNodeCard, schema: GraphNodeCard, ui: GraphNodeCard };

export function graphNodeData(node: GraphNode): GraphNodeData {
  return node.data;
}
