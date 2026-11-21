"use client";

import { memo, useEffect, useMemo, useState, type FormEvent } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ArrowUpRight, Check, LockKeyhole, MessageSquareText, RotateCcw, Sparkles, Square, TriangleAlert } from "lucide-react";
import { applyGraphProposal, GraphProposalSchema, type GraphProposal } from "@/domain/proposal";
import { useWorkspace } from "@/state/workspace";

function textFromMessage(message: { parts: unknown[] }): string {
  return message.parts.map((rawPart) => {
    const part = rawPart as { type?: string; text?: string };
    return part.type === "text" ? part.text ?? "" : "";
  }).join("");
}

function proposalFromMessagePart(rawPart: unknown): GraphProposal | null {
  const part = rawPart as { type?: string; state?: string; output?: unknown };
  if (part.type !== "tool-proposeGraph" || part.state !== "output-available") return null;
  const parsed = GraphProposalSchema.safeParse(part.output);
  return parsed.success ? parsed.data : null;
}

function ProposalCard({ proposal, onRefine }: { proposal: GraphProposal; onRefine: () => void }) {
  const document = useWorkspace((state) => state.document);
  const applyProposal = useWorkspace((state) => state.applyProposal);
  const [errors, setErrors] = useState<string[]>([]);
  const [applied, setApplied] = useState(false);
  const [discarded, setDiscarded] = useState(false);
  const syncStatus = useWorkspace((state) => state.syncStatus);
  const preview = useMemo(() => applyGraphProposal(document, proposal), [document, proposal]);
  const count = proposal.nodes.length + proposal.edges.length;

  if (discarded) return <p role="status">Proposal discarded</p>;
  return (
    <section className="proposal-card" aria-label="Graph proposal preview">
      <div className="proposal-card-head"><span className="proposal-mark"><Sparkles size={13} /></span><div><strong>Graph proposal</strong><span>Review before applying</span></div><span className="proposal-count">+{count}</span></div>
      <p>{proposal.rationale}</p>
      <div className="proposal-changes">
        {proposal.nodes.map((node) => <div key={node.id}><span className="proposal-add">+</span><span>{node.kind}</span><code>{node.id}</code><span className="proposal-label">{node.label}</span></div>)}
        {proposal.edges.map((edge, index) => <div key={`${edge.source}-${edge.target}-${index}`}><span className="proposal-add">+</span><span>link</span><code>{edge.source}{edge.sourcePort && `.${edge.sourcePort}`} → {edge.target}{edge.targetPort && `.${edge.targetPort}`}</code><span className="proposal-label">{edge.label || "unlabelled"}{edge.mappings?.length ? ` · ${edge.mappings.map(({ from, to }) => `${from} → ${to}`).join(", ")}` : ""}</span></div>)}
      </div>
      {applied ? <p role="status">Proposal applied</p> : <>
        {(errors.length > 0 || preview.errors.length > 0) && <div className="proposal-errors" role="alert"><TriangleAlert size={13} /><span>{[...new Set([...preview.errors, ...errors])].join(" ")}</span></div>}
        {syncStatus !== "synced" && <p>Apply or discard the source draft before applying this proposal.</p>}
        <div className="proposal-actions">
          <button className="apply-proposal" disabled={!preview.document || syncStatus !== "synced"} onClick={() => { const result = applyProposal(proposal); setErrors(result); setApplied(!result.length); }}><Check size={14} /> Apply proposal</button>
          <button type="button" className="text-action" onClick={onRefine}>Refine</button>
          <button type="button" className="text-action" onClick={() => setDiscarded(true)}>Discard</button>
        </div>
      </>}
    </section>
  );
}

export const ChatPanel = memo(function ChatPanel({ hidden = false }: { hidden?: boolean }) {
  const document = useWorkspace((state) => state.document);
  const chatMessages = useWorkspace((state) => state.chatMessages);
  const [workspaceGeneration] = useState(() => useWorkspace.getState().workspaceGeneration);
  const transport = useMemo(() => new DefaultChatTransport({
    api: "/api/chat",
    credentials: "same-origin",
    prepareSendMessagesRequest: ({ messages }) => {
      const recent = messages.slice(-40);
      if (recent[0]?.role === "assistant") recent.shift();
      return { body: { messages: recent, currentGraph: useWorkspace.getState().document } };
    },
  }), []);
  const { messages, sendMessage, status, stop, regenerate, error } = useChat({
    id: "produkt-co-architect",
    messages: chatMessages,
    transport,
    onFinish: ({ messages: finishedMessages }) => {
      const workspace = useWorkspace.getState();
      if (workspace.workspaceGeneration === workspaceGeneration) workspace.setChatMessages(finishedMessages);
    },
  });
  useEffect(() => () => { void stop(); }, [stop]);
  const [input, setInput] = useState("");
  const [lastSent, setLastSent] = useState("");
  const isBusy = status === "submitted" || status === "streaming";

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isBusy) return;
    setLastSent(trimmed);
    sendMessage({ text: trimmed });
    setInput("");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    send(input);
  };

  return (
    <section id="panel-chat" role="tabpanel" aria-labelledby="tab-chat" className={`chat-pane${hidden ? " is-hidden" : ""}`} aria-label="Co-architect chat" aria-hidden={hidden}>
      <div className="panel-section-heading"><div><span className="eyebrow">CO-ARCHITECT</span><span className="source-title">Shape it together</span></div><span className={`soon-indicator${isBusy ? " is-streaming" : ""}`}><span />{isBusy ? "Thinking" : "Server-side"}</span></div>
      {messages.length === 0 ? (
        <div className="chat-empty">
          <div className="chat-mark"><MessageSquareText size={20} strokeWidth={1.6} /></div>
          <h2>Talk through a system idea.</h2>
          <p>Ask questions about the current graph, or start with <code>/stitch</code> to draft an architecture change.</p>
          <div className="chat-privacy"><LockKeyhole size={14} /><span>Messages go through the server to your configured OpenAI model. The API key stays server-side.</span></div>
        </div>
      ) : (
        <div className="chat-history" aria-label="Conversation">
          {messages.map((message) => (
            <article key={message.id} className={`chat-message chat-message--${message.role}`}>
              <span className="chat-role">{message.role === "user" ? "YOU" : "FLOWSTITCH"}</span>
              {textFromMessage(message).trim() && <p>{textFromMessage(message)}</p>}
              {message.parts.map((part, index) => {
                const proposal = proposalFromMessagePart(part);
                return proposal ? <ProposalCard key={`${message.id}-proposal-${index}`} proposal={proposal} onRefine={() => {
                  setInput(`/stitch Refine the draft about "${proposal.rationale}": `);
                  window.document.getElementById("chat-input")?.focus();
                }} /> : null;
              })}
            </article>
          ))}
          {isBusy && <div className="stream-status" role="status" aria-live="polite"><span className="stream-pulse" />{status === "submitted" ? "Sending request" : "Writing a response"}</div>}
          {error && <div className="chat-error" role="alert"><TriangleAlert size={14} /><div><strong>Couldn’t complete that request.</strong><span>{error.message || "Check the provider key and connection, then retry."}</span><button onClick={() => regenerate()} disabled={!lastSent}><RotateCcw size={12} /> Retry last message</button></div></div>}
        </div>
      )}
      {messages.length === 0 && <div className="chat-prompts"><span className="eyebrow">SUGGESTED STARTERS</span><button onClick={() => send("/stitch Add an order confirmation event after an order is created.")}><Sparkles size={14} /> Add an order confirmation event</button><button onClick={() => send("Explain the current graph and the sample data flow.")}><Sparkles size={14} /> Explain the current data flow</button></div>}
      <form className="chat-composer" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="chat-input">Message the co-architect</label>
        <textarea id="chat-input" placeholder="Ask about your system…" value={input} onChange={(event) => setInput(event.target.value)} disabled={isBusy} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(input); } }} />
        <div><span><code>/stitch</code> to propose a graph change</span>{isBusy ? <button type="button" onClick={() => stop()} aria-label="Stop response"><Square size={13} /></button> : <button type="submit" disabled={!input.trim()} aria-label="Send message"><ArrowUpRight size={16} /></button>}</div>
      </form>
      <span className="sr-only" aria-live="polite">{document.nodes.length} graph nodes available as context.</span>
    </section>
  );
});
