"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, Pause, Play, RotateCcw, StepForward, Workflow } from "lucide-react";
import type { GraphDocument } from "@/domain/graph";
import { defaultBranch } from "@/domain/simulation";
import { useSimulation } from "@/state/simulation";
import { useWorkspace } from "@/state/workspace";

export const Storyboard = memo(function Storyboard({ document }: { document: GraphDocument }) {
  const state = useSimulation();
  const updateSetup = useWorkspace((workspace) => workspace.updateStoryboardSetup);
  const { advance, running } = state;
  const [expanded, setExpanded] = useState(false);
  const [inspectedStep, setInspectedStep] = useState<number | null>(null);
  const [setupSaved, setSetupSaved] = useState(true);
  const nodesById = useMemo(() => new Map(document.nodes.map((node) => [node.id, node])), [document.nodes]);
  const triggers = useMemo(() => document.nodes.filter((node) => node.data.kind !== "schema"), [document.nodes]);
  const trigger = triggers.find((node) => node.id === state.triggerNodeId);
  const edges = state.finished ? [] : document.edges.filter((edge) => edge.source === state.activeNodeId);
  const defaultEdge = defaultBranch(edges, state.visitedNodeIds);
  const inspected = state.trace[inspectedStep ?? state.trace.length - 1];
  const canAdvance = Boolean(trigger) && !state.payloadError && !state.finished;

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      if (useSimulation.getState().running) advance(document, true);
    }, 1150);
    return () => window.clearInterval(timer);
  }, [advance, document, running]);

  return (
    <footer className={`storyboard${expanded ? " is-expanded" : ""}`} aria-label="Local storyboard simulator">
      <div className="storyboard-head">
        <div className="storyboard-title"><span className="storyboard-symbol"><Workflow size={16} /></span><div><strong>Storyboard</strong><span>Local simulation</span></div></div>
        <div className="simulation-state">
          <label className="trigger-label" htmlFor="simulation-trigger">Trigger</label>
          <select id="simulation-trigger" value={trigger?.id ?? ""} onChange={(event) => {
            setInspectedStep(null);
            setSetupSaved(updateSetup({ triggerNodeId: event.target.value || null }));
          }}>
            <option value="">Choose a trigger</option>
            {triggers.map((node) => <option key={node.id} value={node.id}>{node.data.label}</option>)}
          </select>
        </div>
        <div className="storyboard-message" role="status">
          {state.activeNodeId && <strong>Step {state.step} · </strong>}{state.message}
        </div>
        <div className="storyboard-controls">
          <button className="story-control" onClick={() => { setInspectedStep(null); state.reset(); }} aria-label="Reset storyboard"><RotateCcw size={15} /><span>Reset</span></button>
          <button className="story-control" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-controls="storyboard-details" aria-label="Inspect sample and trace"><ArrowDownToLine size={15} /><span>Payload</span></button>
          <button className="step-button" disabled={!running && !canAdvance} onClick={() => running ? state.setRunning(false) : state.activeNodeId ? state.setRunning(true) : advance(document, true)} aria-label={running ? "Pause storyboard" : "Play storyboard"}>
            {running ? <Pause size={14} /> : <Play size={14} />}<span>{running ? "Pause" : "Play"}</span>
          </button>
          <button className="story-control step-only" disabled={!canAdvance} onClick={() => advance(document)} aria-label="Advance storyboard one step"><StepForward size={15} /><span>Step</span></button>
        </div>
      </div>
      {!setupSaved && <p className="storyboard-branch" role="status">Browser storage could not save this setup. It is available for this session.</p>}
      {edges.length > 1 && <div className="storyboard-branch">
        <label htmlFor="storyboard-branch">Next branch</label>
        <select id="storyboard-branch" value={state.branchEdgeId ?? defaultEdge?.id ?? ""} onChange={(event) => state.chooseBranch(event.target.value)}>
          {edges.map((edge) => <option key={edge.id} value={edge.id}>{edge.label ? `${edge.label} → ` : ""}{nodesById.get(edge.target)?.data.label ?? edge.target}{edge.id === defaultEdge?.id ? " (default)" : ""}</option>)}
        </select>
      </div>}
      <div id="storyboard-details" hidden={!expanded}>
        {expanded && <div className="payload-body">
          <div className="payload-input">
            <label htmlFor="sample-payload">Sample JSON</label>
            <textarea id="sample-payload" value={state.payloadDraft} onChange={(event) => {
              setInspectedStep(null);
              setSetupSaved(updateSetup({ payloadDraft: event.target.value }));
            }} spellCheck={false}
              aria-invalid={Boolean(state.payloadError)} aria-describedby={state.payloadError ? "payload-error" : undefined} />
            {state.payloadError && <p id="payload-error" className="field-error" role="status">{state.payloadError}</p>}
          </div>
          {inspected && <div className="payload-trace">
            <label htmlFor="inspect-step">Inspect payload by step</label>
            <select id="inspect-step" value={inspectedStep !== null && state.trace[inspectedStep] ? inspectedStep : ""} onChange={(event) => setInspectedStep(event.target.value === "" ? null : Number(event.target.value))}>
              <option value="">Current step</option>
              {state.trace.map((step, index) => <option key={index} value={index}>{index} · {nodesById.get(step.nodeId)?.data.label ?? step.nodeId}</option>)}
            </select>
            <pre aria-label="Payload at inspected step">{JSON.stringify(inspected.payload, null, 2)}</pre>
            <p>{inspected.message}</p>
          </div>}
        </div>}
      </div>
    </footer>
  );
});
