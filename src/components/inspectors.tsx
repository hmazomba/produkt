"use client";

import { useEffect, useState } from "react";
import { validateMapping, type FieldMapping, type GraphDocument, type GraphEdge, type GraphNode } from "@/domain/graph";

interface NodeInspectorProps {
  node: GraphNode;
  onRename: (id: string, label: string) => void;
  onDetail: (id: string, detail: string) => void;
  onComponent: (id: string, component: "form" | "action" | "list") => void;
  onFields: (id: string, fields: NonNullable<GraphNode["data"]["fields"]>) => boolean;
  onDelete: () => void;
}

function formatFields(node: GraphNode): string {
  return (node.data.fields ?? []).map((field) => `${field.name} | ${field.type} | ${field.example ?? ""}`).join("\n");
}

export function NodeInspector({ node, onRename, onDetail, onComponent, onFields, onDelete }: NodeInspectorProps) {
  const [fieldsDraft, setFieldsDraft] = useState(() => formatFields(node));
  const [fieldError, setFieldError] = useState("");
  const [label, setLabel] = useState(node.data.label);
  const formattedFields = formatFields(node);
  useEffect(() => {
    setFieldsDraft(formattedFields);
    setFieldError("");
  }, [node.id, formattedFields]);
  useEffect(() => setLabel(node.data.label), [node.id, node.data.label]);

  const applyFields = () => {
    if (fieldsDraft === formattedFields) return;
    const fields = fieldsDraft.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
      const [name = "", type = "", ...exampleParts] = line.split("|");
      const example = exampleParts.join("|").trim();
      return { name: name.trim(), type: type.trim(), ...(example ? { example } : {}) };
    });
    const invalid = fields.find((field) => !/^[\w-]{1,64}$/.test(field.name) || !field.type);
    if (invalid) {
      setFieldError("Use one field per line: name | type | example. Field names use letters, numbers, _ or -.");
      return;
    }
    if (onFields(node.id, fields)) setFieldError("");
  };

  return (
    <section className="inspector-section" aria-label="Selected node details">
      <div className="inspector-heading"><span className="eyebrow">SELECTED NODE</span><button className="text-action" onClick={onDelete}>Delete</button></div>
      <label className="field-label" htmlFor="node-label">Label</label>
      <input id="node-label" className="inspector-input" value={label} maxLength={200} onChange={(event) => setLabel(event.target.value)}
        onBlur={() => { if (label !== node.data.label) onRename(node.id, label); }} />
      {node.data.kind === "ui" && node.data.component === "action" && <>
        <label className="field-label inspector-field-label" htmlFor="node-action-label">Button text</label>
        <input id="node-action-label" className="inspector-input" value={node.data.detail ?? ""} maxLength={200} onChange={(event) => onDetail(node.id, event.target.value)} />
      </>}
      {!(node.data.kind === "ui" && node.data.component === "action") && <>
      <label className="field-label inspector-field-label" htmlFor="node-detail">Description</label>
      <input id="node-detail" className="inspector-input" value={node.data.detail ?? ""} maxLength={500} onChange={(event) => onDetail(node.id, event.target.value)} />
      </>}
      {node.data.kind === "ui" && <>
        <label className="field-label inspector-field-label" htmlFor="wireframe-component">Wireframe type</label>
        <select id="wireframe-component" className="inspector-input" value={node.data.component ?? "form"} onChange={(event) => onComponent(node.id, event.target.value as "form" | "action" | "list")}>
          <option value="form">Form</option><option value="action">Action / button</option><option value="list">List</option>
        </select>
      </>}
      <label className="field-label inspector-field-label" htmlFor="node-fields">{node.data.kind === "ui" ? "Fields and example values" : "Data fields"}</label>
      <textarea id="node-fields" className="inspector-fields" value={fieldsDraft} onChange={(event) => setFieldsDraft(event.target.value)} onBlur={applyFields} aria-invalid={Boolean(fieldError)} aria-describedby={fieldError ? "field-error" : "field-help"} placeholder="email | Email | maya@studio.co" />
      <p id={fieldError ? "field-error" : "field-help"} className={fieldError ? "field-error" : "field-help"} aria-live="polite">{fieldError || "One field per line · name | type | example"}</p>
      <div className="inspector-meta"><span>Type</span><code>{node.data.kind}</code><span>ID</span><code>{node.id}</code></div>
    </section>
  );
}

export function ConnectionInspector({ edge, document, onRename, onMappings, onDelete }: {
  edge: GraphEdge; document: GraphDocument;
  onRename: (id: string, label: string) => void;
  onMappings: (id: string, mappings: FieldMapping[]) => boolean;
  onDelete: () => void;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState("");
  const sourceFields = document.nodes.find((node) => node.id === edge.source)?.data.fields ?? [];
  const targetFields = document.nodes.find((node) => node.id === edge.target)?.data.fields ?? [];
  const mappings = edge.data?.mappings ?? [];
  const addMapping = () => {
    const mapping = { from, to };
    const conflict = mappings.some((item) => item.to === to) ? "This destination field already has a mapping." : validateMapping(document, edge, mapping);
    setError(conflict ?? "");
    if (!conflict && onMappings(edge.id, [...mappings, mapping])) {
      setFrom("");
      setTo("");
    }
  };
  return (
    <section className="inspector-section" aria-label="Selected connection details">
      <div className="inspector-heading"><span className="eyebrow">SELECTED CONNECTION</span><button className="text-action" onClick={onDelete}>Delete</button></div>
      <label className="field-label" htmlFor="edge-label">Mapping label</label>
      <input id="edge-label" className="inspector-input" maxLength={200} value={typeof edge.label === "string" ? edge.label : ""} onChange={(event) => onRename(edge.id, event.target.value)} placeholder="e.g. writes order" />
      <div className="connection-route"><code>{edge.source}{edge.sourceHandle ? `.${edge.sourceHandle}` : ""}</code><span aria-hidden="true">→</span><code>{edge.target}{edge.targetHandle ? `.${edge.targetHandle}` : ""}</code></div>
      <div className="mapping-editor">
        <h4>Field mappings</h4>
        {mappings.map((mapping) => <div className="mapping-row" key={mapping.to}>
          <code>{mapping.from} → {mapping.to}</code>
          <button type="button" className="text-action" aria-label={`Remove mapping to ${mapping.to}`} onClick={() => onMappings(edge.id, mappings.filter((item) => item.to !== mapping.to))}>Remove</button>
        </div>)}
        {sourceFields.length && targetFields.length ? <>
          <label className="field-label" htmlFor="mapping-from">Source field</label>
          <select id="mapping-from" className="inspector-input" value={from} onChange={(event) => { setFrom(event.target.value); setError(""); }}>
            <option value="">Choose a field</option>
            {sourceFields.map((field) => <option key={field.name} value={field.name}>{field.name} · {field.type}</option>)}
          </select>
          <label className="field-label" htmlFor="mapping-to">Destination field</label>
          <select id="mapping-to" className="inspector-input" value={to} onChange={(event) => { setTo(event.target.value); setError(""); }}>
            <option value="">Choose a field</option>
            {targetFields.map((field) => <option key={field.name} value={field.name}>{field.name} · {field.type}</option>)}
          </select>
          <button type="button" className="tool-button mapping-add" disabled={!from || !to} onClick={addMapping}>Add mapping</button>
          {error && <p role="alert" className="field-error">{error}</p>}
        </> : <p className="field-help">Add fields to both nodes to map values between them.</p>}
      </div>
    </section>
  );
}
