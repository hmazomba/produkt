import { create } from "zustand";
import { advanceSimulation, initialSimulation, type SimulationState, type StoryboardSetup } from "@/domain/simulation";
import type { GraphDocument } from "@/domain/graph";

interface SimulationStore extends SimulationState {
  advance: (document: GraphDocument, keepPlaying?: boolean) => void;
  reset: () => void;
  configure: (setup: StoryboardSetup) => void;
  setRunning: (running: boolean) => void;
  chooseBranch: (edgeId: string) => void;
}

export const useSimulation = create<SimulationStore>((set) => ({
  ...initialSimulation(),
  advance: (document, keepPlaying = false) => set((state) => ({ ...advanceSimulation(document, state, keepPlaying) })),
  reset: () => set((state) => initialSimulation(state)),
  configure: (setup) => set(initialSimulation(setup)),
  setRunning: (running) => set({ running }),
  chooseBranch: (branchEdgeId) => set({ branchEdgeId }),
}));
