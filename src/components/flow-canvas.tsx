"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  applyEdgeChanges,
  Background,
  BackgroundVariant,
  Controls,
  getNodesBounds,
  getViewportForBounds,
  type EdgeTypes,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useNodesState,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import { Cable, Check, CircleAlert, Code2, Focus, Layers3, Plus, Sparkles, Workflow } from "lucide-react";
import { connectionError as getConnectionError, type GraphEdge, type GraphNode } from "@/domain/graph";
import { layoutGraph, NODE_HEIGHT, NODE_WIDTH } from "@/domain/layout";
import { routeGraphEdges } from "@/domain/edge-routing";
import { useWorkspace } from "@/state/workspace";
import { useSimulation } from "@/state/simulation";
import { nodeTypes } from "@/components/graph-nodes";
import { RoutedFallbackEdge } from "@/components/routed-edge";
import { ChatPanel } from "@/components/panels";
import { ConnectionInspector, NodeInspector } from "@/components/inspectors";
import { NodeTypePicker } from "@/components/node-type-picker";
import { Storyboard } from "@/components/storyboard";
import { WorkspaceFiles } from "@/components/workspace-files";

type PanelTab = "canvas" | "code" | "chat";
const edgeTypes: EdgeTypes = { "produkt-fallback": RoutedFallbackEdge };
const minimapNodeColor = (node: GraphNode) => node.type === "ui" ? "#4d6486" : node.type === "schema" ? "#5e7b78" : "#6672a6";
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 1.5;

function FlowCanvasInner() {
  const source = useWorkspace((state) => state.source);
  const document = useWorkspace((state) => state.document);
  const sourceRevision = useWorkspace((state) => state.sourceRevision);
  const workspaceGeneration = useWorkspace((state) => state.workspaceGeneration);
  const syncStatus = useWorkspace((state) => state.syncStatus);
  const graphError = useWorkspace((state) => state.graphError);
  const diagnostics = useWorkspace((state) => state.diagnostics);
  const selectedNodeId = useWorkspace((state) => state.selectedNodeId);
  const selectedEdgeId = useWorkspace((state) => state.selectedEdgeId);
  const activeEdgeId = useSimulation((state) => state.activeEdgeId);
  const setSource = useWorkspace((state) => state.setSource);
  const commitSource = useWorkspace((state) => state.commitSource);
  const discardDraft = useWorkspace((state) => state.discardDraft);
  const setDocument = useWorkspace((state) => state.setDocument);
  const addNode = useWorkspace((state) => state.addNode);
  const connectNodes = useWorkspace((state) => state.connectNodes);
  const selectNode = useWorkspace((state) => state.selectNode);
  const renameNode = useWorkspace((state) => state.renameNode);
  const updateNodeDetail = useWorkspace((state) => state.updateNodeDetail);
  const updateNodeComponent = useWorkspace((state) => state.updateNodeComponent);
  const updateNodeFields = useWorkspace((state) => state.updateNodeFields);
  const selectEdge = useWorkspace((state) => state.selectEdge);
  const renameEdge = useWorkspace((state) => state.renameEdge);
  const updateEdgeMappings = useWorkspace((state) => state.updateEdgeMappings);
  const [tab, setTab] = useState<PanelTab>("canvas");
  const [hydrated, setHydrated] = useState(false);
  const panelTab = tab === "chat" ? "chat" : "code";
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  const [connectionSource, setConnectionSource] = useState("Checkout");
  const [connectionTarget, setConnectionTarget] = useState("API");
  const [connectionSourcePort, setConnectionSourcePort] = useState("out");
  const [connectionTargetPort, setConnectionTargetPort] = useState("in");
  const [connectionLabel, setConnectionLabel] = useState("");
  const [connectionError, setConnectionError] = useState("");
  const [flowNodes, setFlowNodes, onFlowNodesChange] = useNodesState<GraphNode>(document.nodes);
  const lastCommitted = useRef({ nodes: document.nodes, workspaceGeneration });
  const flow = useReactFlow();
  const windowCanvas = useRef<HTMLElement>(null);
  const fitWhenCanvasOpens = useRef(false);
  const fittedWorkspace = useRef(-1);
  const selectedNode = document.nodes.find((node) => node.id === selectedNodeId);
  const selectedEdge = document.edges.find((edge) => edge.id === selectedEdgeId);
  useEffect(() => {
    let mounted = true;
    const finish = () => {
      if (!mounted) return;
      useSimulation.getState().configure(useWorkspace.getState().storyboardSetup);
      setHydrated(true);
    };
    Promise.resolve(useWorkspace.persist?.rehydrate()).then(finish, finish);
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    const previous = lastCommitted.current;
    lastCommitted.current = { nodes: document.nodes, workspaceGeneration };
    if (previous.workspaceGeneration !== workspaceGeneration) {
      setFlowNodes(document.nodes);
      return;
    }
    const committedById = new Map(previous.nodes.map((node) => [node.id, node]));
    setFlowNodes((current) => {
      const currentById = new Map(current.map((node) => [node.id, node]));
      return document.nodes.map((node) => {
        const previous = currentById.get(node.id);
        if (!previous) return node;
        if (committedById.get(node.id) === node) return previous;
        return { ...node, selected: previous.selected, measured: previous.measured };
      });
    });
  }, [document.nodes, setFlowNodes, workspaceGeneration]);
  useEffect(() => {
    if (!hydrated || fittedWorkspace.current === workspaceGeneration) return;
    const canvas = windowCanvas.current?.querySelector(".react-flow");
    if (!canvas?.clientWidth || !canvas.clientHeight) return;
    fittedWorkspace.current = workspaceGeneration;
    if (workspaceGeneration > 0) setTab("canvas");
    const nodes = document.nodes.map((node) => ({ ...node, width: NODE_WIDTH, height: NODE_HEIGHT }));
    const viewport = nodes.length
      ? getViewportForBounds(getNodesBounds(nodes), canvas.clientWidth, canvas.clientHeight, MIN_ZOOM, MAX_ZOOM, 0.22)
      : { x: 0, y: 0, zoom: 1 };
    void flow.setViewport(viewport);
  }, [document.nodes, flow, hydrated, workspaceGeneration]);
  const nodeCounts = useMemo(() => ({ services: document.nodes.filter((node) => node.data.kind === "service").length, schemas: document.nodes.filter((node) => node.data.kind === "schema").length, screens: document.nodes.filter((node) => node.data.kind === "ui").length }), [document.nodes]);

  useEffect(() => {
    if (syncStatus !== "pending") return;
    const timeout = window.setTimeout(() => commitSource(sourceRevision), 150);
    return () => window.clearTimeout(timeout);
  }, [sourceRevision, syncStatus, commitSource]);

  const focusFirstDiagnostic = () => {
    const diagnostic = diagnostics[0];
    const editor = window.document.getElementById("dsl-editor");
    if (!diagnostic || !(editor instanceof HTMLTextAreaElement)) return;
    const lineStart = source.split("\n").slice(0, diagnostic.line - 1).reduce((total, line) => total + line.length + 1, 0);
    const position = Math.min(lineStart + Math.max(0, diagnostic.column - 1), source.length);
    editor.focus();
    editor.setSelectionRange(position, Math.min(position + 1, source.length));
  };

  const handleNodesChange = useCallback((changes: NodeChange<GraphNode>[]) => {
    onFlowNodesChange(changes);
    const moved = new Map<string, GraphNode["position"]>();
    for (const change of changes) {
      if (change.type === "position" && change.dragging === false && change.position) moved.set(change.id, change.position);
    }
    if (!moved.size) return;
    const current = useWorkspace.getState().document;
    const nodes = current.nodes.map((node) => {
      const position = moved.get(node.id);
      return position ? { ...node, position } : node;
    });
    setDocument({ ...current, nodes }, false);
  }, [onFlowNodesChange, setDocument]);

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;
    const edge: GraphEdge = { ...connection, id: `edge-${crypto.randomUUID()}`, type: "smoothstep", label: "" };
    if (connectNodes(edge)) selectEdge(edge.id);
  }, [connectNodes, selectEdge]);

  const handleCreateConnection = () => {
    const sourceNode = document.nodes.find((node) => node.id === connectionSource);
    const targetNode = document.nodes.find((node) => node.id === connectionTarget);
    if (!sourceNode || !targetNode) { setConnectionError("Choose nodes that still exist in the graph."); return; }
    const error = getConnectionError(sourceNode, targetNode);
    if (error) { setConnectionError(error); return; }
    const edge: GraphEdge = { id: `edge-${crypto.randomUUID()}`, source: sourceNode.id, target: targetNode.id, sourceHandle: connectionSourcePort, targetHandle: connectionTargetPort, type: "smoothstep", label: connectionLabel.trim() };
    if (!connectNodes(edge)) { setConnectionError(useWorkspace.getState().graphError); return; }
    selectEdge(edge.id);
    setTab("code");
    setConnectionError("");
    setConnectionLabel("");
    setShowConnectionDialog(false);
  };

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    if (!changes.some((change) => change.type === "remove")) return;
    const edges = applyEdgeChanges(changes, document.edges);
    setDocument({ ...document, edges });
  }, [document, setDocument]);

  const handleLayout = () => {
    const laidOut = layoutGraph(document);
    setDocument(laidOut, false);
  };
  const handleFit = useCallback(() => {
    if (windowCanvas.current && getComputedStyle(windowCanvas.current).visibility === "hidden") {
      fitWhenCanvasOpens.current = true;
      setTab("canvas");
      return;
    }
    void flow.fitView({ padding: 0.22, duration: 250 });
  }, [flow]);
  useEffect(() => {
    if (tab !== "canvas" || !fitWhenCanvasOpens.current) return;
    fitWhenCanvasOpens.current = false;
    const frame = requestAnimationFrame(() => { void flow.fitView({ padding: 0.22, duration: 250 }); });
    return () => cancelAnimationFrame(frame);
  }, [flow, tab]);
  const focusNode = useCallback((id: string) => {
    const node = document.nodes.find((item) => item.id === id);
    if (!node) return;
    setFlowNodes((current) => current.map((item) => ({ ...item, selected: item.id === id })));
    selectNode(id);
    selectEdge(null);
    const selector = `.react-flow__node[data-id="${CSS.escape(id)}"]`;
    const focus = () => {
      if (useWorkspace.getState().selectedNodeId === id) window.document.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true });
    };
    focus();
    void flow.setCenter(node.position.x + (node.measured?.width ?? NODE_WIDTH) / 2, node.position.y + (node.measured?.height ?? NODE_HEIGHT) / 2, { duration: 180, zoom: flow.getZoom() })
      .then(() => requestAnimationFrame(focus));
  }, [document.nodes, flow, selectEdge, selectNode, setFlowNodes]);
  const focusEdge = useCallback((id: string) => {
    selectEdge(id);
    selectNode(null);
    setFlowNodes((current) => current.map((node) => ({ ...node, selected: false })));
    window.document.querySelector<HTMLElement>(`.react-flow__edge[data-id="${CSS.escape(id)}"]`)?.focus();
  }, [selectEdge, selectNode, setFlowNodes]);
  const handleDelete = useCallback(() => {
    if (!selectedNodeId) return;
    const next = { ...document, nodes: document.nodes.filter((node) => node.id !== selectedNodeId), edges: document.edges.filter((edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId) };
    if (setDocument(next)) selectNode(null);
  }, [selectedNodeId, document, setDocument, selectNode]);
  const handleDeleteEdge = useCallback(() => {
    if (!selectedEdgeId) return;
    if (setDocument({ ...document, edges: document.edges.filter((edge) => edge.id !== selectedEdgeId) })) selectEdge(null);
  }, [selectedEdgeId, document, setDocument, selectEdge]);
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const isTextEntry = target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      const canvasHasFocus = target instanceof HTMLElement && Boolean(target.closest(".react-flow"));
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && target instanceof HTMLElement && target.id === "dsl-editor") {
        event.preventDefault();
        commitSource(sourceRevision);
      }
      if (!isTextEntry && canvasHasFocus && event.altKey && event.key.startsWith("Arrow")) {
        event.preventDefault();
        const viewport = flow.getViewport();
        const distance = 80;
        const delta = event.key === "ArrowLeft" ? [distance, 0] : event.key === "ArrowRight" ? [-distance, 0] : event.key === "ArrowUp" ? [0, distance] : [0, -distance];
        flow.setViewport({ ...viewport, x: viewport.x + delta[0], y: viewport.y + delta[1] }, { duration: 100 });
      } else if (!isTextEntry && canvasHasFocus && (event.key === "f" || event.key === "F")) {
        event.preventDefault();
        handleFit();
      } else if (!isTextEntry && canvasHasFocus && (event.key === "+" || event.key === "=")) {
        event.preventDefault();
        flow.zoomIn({ duration: 100 });
      } else if (!isTextEntry && canvasHasFocus && event.key === "-") {
        event.preventDefault();
        flow.zoomOut({ duration: 100 });
      } else if (!isTextEntry && canvasHasFocus && (event.key === "n" || event.key === "N") && document.nodes.length) {
        event.preventDefault();
        const currentIndex = document.nodes.findIndex((node) => node.id === selectedNodeId);
        const direction = event.shiftKey ? -1 : 1;
        const nextIndex = currentIndex < 0 ? (direction > 0 ? 0 : document.nodes.length - 1) : (currentIndex + direction + document.nodes.length) % document.nodes.length;
        focusNode(document.nodes[nextIndex].id);
      } else if (!isTextEntry && canvasHasFocus && (event.key === "e" || event.key === "E") && document.edges.length) {
        event.preventDefault();
        const currentIndex = document.edges.findIndex((edge) => edge.id === selectedEdgeId);
        focusEdge(document.edges[(currentIndex + 1) % document.edges.length].id);
      }
      if (canvasHasFocus && !isTextEntry && (event.key === "Backspace" || event.key === "Delete") && selectedNodeId) {
        event.preventDefault();
        handleDelete();
      } else if (canvasHasFocus && !isTextEntry && (event.key === "Backspace" || event.key === "Delete") && selectedEdgeId) {
        event.preventDefault();
        handleDeleteEdge();
      }
      if (event.key === "Escape") {
        setShowShortcuts(false);
        setShowConnectionDialog(false);
      }
      if (!isTextEntry && event.key === "?" && !event.ctrlKey && !event.metaKey && !event.altKey) setShowShortcuts(true);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sourceRevision, commitSource, selectedNodeId, selectedEdgeId, document, flow, handleDelete, handleDeleteEdge, handleFit, focusNode, focusEdge]);
  const activeEdge = activeEdgeId;
  const routedEdges = useMemo(() => routeGraphEdges(document), [document]);
  const edges = useMemo(() => routedEdges.map((edge) => ({
    ...edge,
    selected: edge.id === selectedEdgeId,
    label: edge.label || undefined,
    style: { stroke: activeEdge === edge.id || edge.id === selectedEdgeId ? "var(--flow-active)" : "var(--edge-default)", strokeWidth: activeEdge === edge.id || edge.id === selectedEdgeId ? 2 : 1.5 },
    markerEnd: { type: "arrowclosed" as const, color: activeEdge === edge.id ? "var(--flow-active)" : "var(--edge-default)" },
    animated: activeEdge === edge.id,
    labelStyle: { fill: "var(--text-secondary)", fontSize: 11 },
    labelBgStyle: { fill: "var(--surface)", fillOpacity: 1 },
  })), [routedEdges, activeEdge, selectedEdgeId]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-group">
          <a className="brand" href="#workspace" aria-label="produkt workspace home">
            <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>
            <span className="brand-word">produkt</span>
          </a>
          <span className="brand-divider" aria-hidden="true" />
          <WorkspaceFiles />
        </div>
        <div className="topbar-meta"><span className="sync-status"><span className="status-dot" /> Local workspace</span><span className="topbar-separator" /><span className="graph-count">{document.nodes.length} nodes · {document.edges.length} links</span></div>
        <div className="toolbar-actions">
          <button className="tool-button" onClick={() => setShowShortcuts(true)} aria-label="Open keyboard shortcuts"><span className="shortcut-hint">?</span><span>Shortcuts</span></button>
          <button className="tool-button connect-tool" onClick={() => setShowConnectionDialog(true)} aria-label="Create connection without dragging"><Cable size={15} /><span>Connect</span></button>
          <button className="tool-button" onClick={handleFit} aria-label="Fit graph to view"><Focus size={15} /><span>Fit view</span></button>
          <button className="tool-button" onClick={handleLayout} aria-label="Automatically arrange nodes"><Workflow size={15} /><span>Auto layout</span></button>
          <div className="toolbar-divider" />
          <NodeTypePicker />
        </div>
      </header>

      <div className={`work-area compact-${tab}`} id="workspace">
        <nav className="compact-views" aria-label="Workspace view">
          <button type="button" aria-pressed={tab === "canvas"} onClick={() => setTab("canvas")}>Canvas</button>
          <button type="button" aria-pressed={tab === "code"} onClick={() => setTab("code")}>Code</button>
          <button type="button" aria-pressed={tab === "chat"} onClick={() => setTab("chat")}>Chat</button>
        </nav>
        {graphError && <p className="workspace-error" role="alert">{graphError}</p>}
        <aside className="source-panel" aria-label="Source and assistant panel">
          <div className="panel-tabs" role="tablist" aria-label="Workspace tools">
            <button id="tab-code" role="tab" aria-controls="panel-code" aria-selected={panelTab === "code"} className={`panel-tab${panelTab === "code" ? " is-active" : ""}`} onClick={() => setTab("code")}><Code2 size={14} /> Code</button>
            <button id="tab-chat" role="tab" aria-controls="panel-chat" aria-selected={panelTab === "chat"} className={`panel-tab${panelTab === "chat" ? " is-active" : ""}`} onClick={() => setTab("chat")}><Sparkles size={14} /> Chat</button>
          </div>
            <section id="panel-code" role="tabpanel" aria-labelledby="tab-code" className="code-pane" aria-label="Diagram source editor" hidden={panelTab !== "code"}>
              <div className="panel-section-heading"><div><span className="eyebrow">NATIVE DSL</span><span className="source-title">Architecture source</span></div><span className="language-badge">Flow DSL</span></div>
              <div className="editor-shell">
                <div className="line-numbers" aria-hidden="true">{source.split("\n").map((_, index) => <span key={index}>{String(index + 1).padStart(2, "0")}</span>)}</div>
                <label className="sr-only" htmlFor="dsl-editor">Architecture diagram source</label>
                <textarea id="dsl-editor" className="dsl-editor" spellCheck={false} value={source} onChange={(event) => setSource(event.target.value)} aria-describedby="dsl-status" aria-invalid={syncStatus === "invalid"} />
              </div>
              <div id="dsl-status" className={`parse-status${diagnostics.length ? " has-error" : ""}`} role="status" aria-live="polite">
                {diagnostics.length ? <><CircleAlert size={14} /><span>Line {diagnostics[0].line}, column {diagnostics[0].column}: {diagnostics[0].message} Canvas shows the last valid graph.</span><button className="diagnostic-focus" onClick={focusFirstDiagnostic}>Focus error</button></> : syncStatus === "pending" ? <span>Source changes pending</span> : <><Check size={14} /><span>Synced · changes apply after 150 ms</span></>}
                {syncStatus !== "synced" && <button className="diagnostic-focus" onClick={discardDraft}>Discard draft</button>}
              </div>
              <div className="source-hint"><span>⌘</span><span>+ Enter to apply</span><span className="hint-spacer" /><span className="hint-help">? for shortcuts</span></div>
              {selectedNode && <NodeInspector node={selectedNode} onRename={renameNode} onDetail={updateNodeDetail} onComponent={updateNodeComponent} onFields={updateNodeFields} onDelete={handleDelete} />}
              {selectedEdge && <ConnectionInspector key={selectedEdge.id} edge={selectedEdge} document={document} onRename={renameEdge} onMappings={updateEdgeMappings} onDelete={handleDeleteEdge} />}
              <div className="source-footer"><span className="mini-avatar">F</span><span>FlowStitch workspace</span><span className="footer-dots">···</span></div>
            </section>
          {hydrated && <ChatPanel key={workspaceGeneration} hidden={panelTab !== "chat"} />}
        </aside>

        <section ref={windowCanvas} className="canvas-region" aria-label="System architecture canvas">
          <div className="canvas-heading"><div><span className="eyebrow">WORKSPACE</span><h1>System map</h1><p>Shape the flow. Trace what happens next.</p></div><div className="canvas-counts"><span><i className="count-mark service-mark" />{nodeCounts.services} services</span><span><i className="count-mark schema-mark" />{nodeCounts.schemas} schema</span><span><i className="count-mark ui-mark" />{nodeCounts.screens} wireframe</span></div></div>
          <div className="canvas-frame">
            <div className="canvas-legend"><span><i className="legend-dot legend-ui" /> Interface</span><span><i className="legend-dot legend-service" /> Service</span><span><i className="legend-dot legend-schema" /> Data</span></div>
            <div className="canvas-quick-tools">
              <button title="Add service" aria-label="Add service node" onClick={() => addNode("service")}><Plus size={15} /></button>
              <button title="Add data schema" aria-label="Add schema node" onClick={() => addNode("schema")}><Layers3 size={15} /></button>
              <button title="Add wireframe" aria-label="Add wireframe node" onClick={() => addNode("ui")}><Code2 size={15} /></button>
            </div>
            <ReactFlow
              nodes={flowNodes}
              edges={edges}
              edgeTypes={edgeTypes}
              nodeTypes={nodeTypes}
              onNodesChange={handleNodesChange}
              onEdgesChange={handleEdgesChange}
              onConnect={onConnect}
              isValidConnection={(connection) => {
                return !getConnectionError(
                  document.nodes.find((node) => node.id === connection.source),
                  document.nodes.find((node) => node.id === connection.target),
                );
              }}
              onNodeClick={(_, node) => selectNode(node.id)}
              onEdgeClick={(_, edge) => selectEdge(edge.id)}
              onPaneClick={() => { selectNode(null); selectEdge(null); }}
              fitView
              fitViewOptions={{ padding: 0.22 }}
              minZoom={MIN_ZOOM}
              maxZoom={MAX_ZOOM}
              nodesConnectable
              nodesDraggable
              elementsSelectable
              onlyRenderVisibleElements
              nodesFocusable
              edgesFocusable
              deleteKeyCode={null}
              aria-label="Interactive system graph. Use the node list to inspect nodes or drag to reposition them."
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} color="var(--canvas-grid)" gap={24} size={1} />
              <Controls position="bottom-right" showInteractive={false} />
              <MiniMap position="bottom-left" pannable zoomable nodeColor={minimapNodeColor} maskColor="rgba(5, 8, 14, 0.72)" />
            </ReactFlow>
            <span className="sr-only" role="status" aria-live="polite">{selectedNode ? `Selected node ${selectedNode.data.label}, ${selectedNode.data.kind}.` : selectedEdge ? `Selected connection from ${selectedEdge.source} to ${selectedEdge.target}.` : "No graph item selected."}</span>
            <div className="canvas-attribution"><span className="canvas-scale">{Math.round(flow.getZoom() * 100)}%</span><span className="canvas-divider" /><button onClick={handleFit}>Fit to screen</button></div>
          </div>
          <div className="canvas-foot"><span><span className="keycap">Space</span> + drag to pan</span><span><span className="keycap">Ctrl</span> / <span className="keycap">⌘</span> + <span className="keycap">Enter</span> apply source</span>{(selectedNode || selectedEdge) && <button className="compact-inspect" onClick={() => setTab("code")}>Inspect selection</button>}<span className="foot-saved"><span className="status-dot" /> Saved in this browser</span></div>
        </section>
      </div>

      <Storyboard key={workspaceGeneration} document={document} />
      <Dialog.Root open={showShortcuts} onOpenChange={setShowShortcuts}><Dialog.Portal><Dialog.Overlay className="shortcut-overlay" /><Dialog.Content className="shortcut-dialog" aria-describedby="shortcuts-description"><div className="shortcut-dialog-head"><div><span className="eyebrow">QUICK REFERENCE</span><Dialog.Title className="shortcut-title" id="shortcuts-title">Keyboard shortcuts</Dialog.Title><Dialog.Description id="shortcuts-description" className="sr-only">Available canvas and source editor shortcuts.</Dialog.Description></div><Dialog.Close className="icon-button" aria-label="Close shortcuts">×</Dialog.Close></div><div className="shortcut-list"><div><span>Apply valid DSL</span><kbd>Ctrl / ⌘ Enter</kbd></div><div><span>Pan canvas</span><kbd>Space + drag</kbd></div><div><span>Pan while canvas focused</span><kbd>Alt + arrows</kbd></div><div><span>Zoom while canvas focused</span><kbd>+ / −</kbd></div><div><span>Fit graph to view</span><kbd>F</kbd></div><div><span>Next / previous node</span><kbd>N / Shift + N</kbd></div><div><span>Inspect next connection</span><kbd>E</kbd></div><div><span>Delete selected node or connection</span><kbd>Backspace</kbd></div></div><Dialog.Close className="dialog-done">Done</Dialog.Close></Dialog.Content></Dialog.Portal></Dialog.Root>
      <Dialog.Root open={showConnectionDialog} onOpenChange={(open) => { setShowConnectionDialog(open); if (!open) setConnectionError(""); }}><Dialog.Portal><Dialog.Overlay className="shortcut-overlay" /><Dialog.Content className="shortcut-dialog connect-dialog" aria-describedby="connect-description"><div className="shortcut-dialog-head"><div><span className="eyebrow">ACCESSIBLE CONNECTION</span><Dialog.Title className="shortcut-title">Connect graph nodes</Dialog.Title><Dialog.Description id="connect-description" className="connect-description">Create a named relationship without dragging between canvas handles.</Dialog.Description></div><Dialog.Close className="icon-button" aria-label="Close connection dialog">×</Dialog.Close></div><div className="connect-form"><label htmlFor="connection-source">From</label><select id="connection-source" value={connectionSource} onChange={(event) => { setConnectionSource(event.target.value); setConnectionSourcePort("out"); setConnectionError(""); }}><option value="">Choose a UI or service</option>{document.nodes.filter((node) => node.data.kind !== "schema").map((node) => <option key={node.id} value={node.id}>{node.data.label} · {node.id}</option>)}</select><label htmlFor="connection-source-port">Output</label><select id="connection-source-port" value={connectionSourcePort} onChange={(event) => setConnectionSourcePort(event.target.value)}>{["out", ...(document.nodes.find((node) => node.id === connectionSource)?.data.sourcePorts ?? [])].filter((port, index, ports) => ports.indexOf(port) === index).map((port) => <option key={port} value={port}>{port}</option>)}</select><label htmlFor="connection-target">To</label><select id="connection-target" value={connectionTarget} onChange={(event) => { setConnectionTarget(event.target.value); setConnectionTargetPort("in"); setConnectionError(""); }}><option value="">Choose a destination</option>{document.nodes.map((node) => <option key={node.id} value={node.id}>{node.data.label} · {node.id}</option>)}</select><label htmlFor="connection-target-port">Input</label><select id="connection-target-port" value={connectionTargetPort} onChange={(event) => setConnectionTargetPort(event.target.value)}>{["in", ...(document.nodes.find((node) => node.id === connectionTarget)?.data.targetPorts ?? [])].filter((port, index, ports) => ports.indexOf(port) === index).map((port) => <option key={port} value={port}>{port}</option>)}</select><label htmlFor="connection-label">Mapping label <span>Optional</span></label><input id="connection-label" value={connectionLabel} onChange={(event) => setConnectionLabel(event.target.value)} maxLength={200} placeholder="writes order" />{connectionError && <p className="connect-error" role="alert">{connectionError}</p>}<button className="dialog-done" onClick={handleCreateConnection}>Create connection</button></div></Dialog.Content></Dialog.Portal></Dialog.Root>
    </main>
  );
}

export function FlowCanvas() {
  return <ReactFlowProvider><FlowCanvasInner /></ReactFlowProvider>;
}
