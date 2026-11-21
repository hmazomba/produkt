"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Braces, FormInput, Plus, Server, X } from "lucide-react";
import { useWorkspace } from "@/state/workspace";

const nodeTypes = [
  { kind: "service", label: "Service", description: "An API, worker, or other system component", icon: Server },
  { kind: "schema", label: "Data Schema", description: "A record or payload with named fields", icon: Braces },
  { kind: "ui", label: "Wireframe", description: "A form, button, or list to connect to the system", icon: FormInput },
] as const;

export function NodeTypePicker() {
  const addNode = useWorkspace((state) => state.addNode);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { setOpen(next); if (!next) setError(""); }}>
      <Dialog.Trigger asChild>
        <button type="button" className="add-button" aria-label="Add node"><Plus size={15} aria-hidden="true" /><span>Add node</span></button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="shortcut-overlay" />
        <Dialog.Content className="shortcut-dialog node-picker" aria-describedby={undefined}>
          <Dialog.Title className="shortcut-title">Add node</Dialog.Title>
          <div className="node-picker-options">
            {nodeTypes.map(({ kind, label, description, icon: Icon }) => (
              <button key={kind} type="button" className="node-picker-option" aria-labelledby={`node-picker-${kind}-label`}
                aria-describedby={`node-picker-${kind}-description`} onClick={() => {
                  if (addNode(kind)) { setError(""); setOpen(false); }
                  else setError(useWorkspace.getState().graphError);
                }}>
                <span className={`node-mark node-mark--${kind}`} aria-hidden="true"><Icon size={16} /></span>
                <span>
                  <strong id={`node-picker-${kind}-label`}>{label}</strong>
                  <span id={`node-picker-${kind}-description`}>{description}</span>
                </span>
              </button>
            ))}
          </div>
          {error && <p className="connect-error" role="alert">{error}</p>}
          <Dialog.Close className="icon-button node-picker-close" aria-label="Close node picker"><X size={16} aria-hidden="true" /></Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
