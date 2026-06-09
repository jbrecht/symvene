// IndexedDB persistence for saved/reusable panels. A saved panel is a frozen unit — its
// experts plus the per-expert documents attached to them (embeddings included). Kept in a
// separate DB from the RAG corpus so the two evolve independently. Float32Array embeddings
// persist directly via structured clone.
import { openDB } from "idb";
import type { DBSchema, IDBPDatabase } from "idb";
import type { Expert } from "../engine/types";
import type { DocChunk, RagDoc } from "../engine/retrieval";

export interface SavedPanel {
  id: string;
  name: string;
  createdAt: number; // epoch ms
  experts: Expert[];
  docs: RagDoc[]; // the experts' per-expert documents (expertId set)
  chunks: DocChunk[]; // their embedded chunks
}

interface PanelDB extends DBSchema {
  panels: { key: string; value: SavedPanel };
}

let dbPromise: Promise<IDBPDatabase<PanelDB>> | null = null;

function db(): Promise<IDBPDatabase<PanelDB>> {
  if (!dbPromise) {
    dbPromise = openDB<PanelDB>("symvene-panels", 1, {
      upgrade(database) {
        database.createObjectStore("panels", { keyPath: "id" });
      },
    });
  }
  return dbPromise;
}

// All saved panels, newest first.
export async function loadPanels(): Promise<SavedPanel[]> {
  const panels = await (await db()).getAll("panels");
  panels.sort((a, b) => b.createdAt - a.createdAt);
  return panels;
}

export async function savePanel(panel: SavedPanel): Promise<void> {
  await (await db()).put("panels", panel);
}

export async function deletePanel(id: string): Promise<void> {
  await (await db()).delete("panels", id);
}
