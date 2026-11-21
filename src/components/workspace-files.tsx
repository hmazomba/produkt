"use client";

import { useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronDown, Download, FolderOpen, X } from "lucide-react";
import { findStoryboardTrigger } from "@/domain/simulation";
import { MAX_WORKSPACE_FILE_BYTES, parseWorkspaceFile, serializeWorkspaceFile, type WorkspaceSnapshot } from "@/domain/workspace-file";
import { useWorkspace } from "@/state/workspace";

interface ImportPreview {
  name: string;
  workspace: WorkspaceSnapshot;
}

export function WorkspaceFiles() {
  const openWorkspace = useWorkspace((state) => state.openWorkspace);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [reading, setReading] = useState(false);
  const [includeStoryboard, setIncludeStoryboard] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const readRevision = useRef(0);
  const previewSetup = preview?.workspace.storyboardSetup;
  const previewTrigger = preview && previewSetup ? findStoryboardTrigger(preview.workspace.document, previewSetup.triggerNodeId) : undefined;

  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) {
      readRevision.current += 1;
      setPreview(null);
      setReading(false);
      setIncludeStoryboard(false);
      setError("");
    }
  }

  function exportWorkspace() {
    setNotice("");
    setError("");
    try {
      const workspace = useWorkspace.getState();
      const text = serializeWorkspaceFile(workspace, includeStoryboard ? workspace.storyboardSetup : undefined);
      const file = new Blob([text], { type: "application/json" });
      if (file.size > MAX_WORKSPACE_FILE_BYTES) {
        setError("This workspace exceeds the 10 MB file limit.");
        return;
      }
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = "flowstitch.produkt.json";
      document.body.append(link);
      try {
        link.click();
      } finally {
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
      }
      setNotice("Workspace export started.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "The workspace file could not be created.");
    }
  }

  async function previewFile(file: File) {
    const revision = ++readRevision.current;
    setPreview(null);
    setReading(false);
    setError("");
    setNotice("");
    if (file.size > MAX_WORKSPACE_FILE_BYTES) {
      setError("Choose a workspace file under 10 MB.");
      return;
    }
    setReading(true);
    try {
      const text = await file.text();
      if (revision !== readRevision.current) return;
      const result = parseWorkspaceFile(text);
      if ("workspace" in result) setPreview({ name: file.name, workspace: result.workspace });
      else setError(result.error);
    } catch {
      if (revision === readRevision.current) setError("The workspace file could not be read.");
    } finally {
      if (revision === readRevision.current) setReading(false);
    }
  }

  function replaceWorkspace() {
    if (!preview) return;
    const saved = openWorkspace(preview.workspace);
    if (saved) {
      changeOpen(false);
      setNotice("Workspace imported.");
    } else {
      setPreview(null);
      setError("Workspace opened for this session. Browser storage could not save it. Keep the original file.");
    }
  }

  return (
    <>
      <Dialog.Root open={open} onOpenChange={changeOpen}>
        <Dialog.Trigger asChild>
          <button type="button" className="tool-button workspace-files-trigger" aria-label="Workspace files" title="Workspace files">
            <FolderOpen size={15} aria-hidden="true" />
            <span>FlowStitch</span>
            <ChevronDown className="workspace-files-chevron" size={12} aria-hidden="true" />
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="shortcut-overlay" />
          <Dialog.Content className="shortcut-dialog workspace-files-dialog">
            <Dialog.Title className="shortcut-title">Workspace files</Dialog.Title>
            <Dialog.Description className="workspace-files-description">Save or open a local file with the diagram source, mappings, and node positions.</Dialog.Description>
            <div className="workspace-files-actions">
              <button type="button" className="tool-button workspace-export" onClick={exportWorkspace}><Download size={15} aria-hidden="true" /> Export current workspace</button>
              <label className="workspace-include-storyboard">
                <input type="checkbox" checked={includeStoryboard} onChange={(event) => { setIncludeStoryboard(event.target.checked); setError(""); }} />
                Include storyboard trigger and sample JSON
              </label>
              <div className="workspace-import-input">
                <label htmlFor="workspace-file">Import workspace</label>
                <input id="workspace-file" type="file" accept=".json,application/json" onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  if (file) void previewFile(file);
                }} />
              </div>
            </div>
            {reading && <p className="workspace-files-description" role="status">Reading workspace file…</p>}
            {error && <p className="workspace-files-error" role="alert">{error}</p>}
            {preview && <section className="workspace-file-preview" aria-label="Import preview">
              <div role="status">
                <strong>{preview.name}</strong>
                <p>{preview.workspace.document.nodes.length} nodes · {preview.workspace.document.edges.length} links</p>
                {preview.workspace.diagnostics.length > 0 && <p>Includes an invalid source draft and its last valid graph.</p>}
              </div>
              {previewSetup && previewTrigger && <details className="workspace-storyboard-preview">
                <summary>Storyboard sample · {previewTrigger.data.label}</summary>
                <pre>{previewSetup.payloadDraft}</pre>
              </details>}
              <p>Opening this file replaces the current workspace and starts a fresh chat and storyboard run. Export the current workspace above to keep a copy.</p>
              <button type="button" className="dialog-done" onClick={replaceWorkspace}>Replace workspace</button>
            </section>}
            <Dialog.Close className="icon-button workspace-files-close" aria-label="Close workspace files"><X size={16} aria-hidden="true" /></Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <span className="sr-only" role="status">{notice}</span>
    </>
  );
}
