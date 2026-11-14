import { useState } from "react";
import { CASE_CONTENT } from "../features/story";
import {
  readSlots,
  validateSlotSnapshot,
} from "../features/profiles";
import {
  CoopSession,
  CoopSetupDialog,
  createCoopSnapshot,
} from "../features/coop";
import type {
  CoopSnapshot,
  InvestigatorId,
  SaveSlot,
} from "../shared/types";
import { SoloSession } from "./SoloSession";

type View =
  | { kind: "solo" }
  | { kind: "coop"; startup: CoopStartupLike; key: number };

interface CoopStartupLike {
  slot: SaveSlot | null;
  snapshot: CoopSnapshot;
  name: string;
}

export function App() {
  const [view, setView] = useState<View>({ kind: "solo" });
  const [setup, setSetup] = useState(false);
  const [archive, setArchive] = useState(false);
  const [slotsVersion, setSlotsVersion] = useState(0);

  const startCoop = (names: Record<InvestigatorId, string>) => {
    const snapshot = createCoopSnapshot(CASE_CONTENT, names);
    setSetup(false);
    setArchive(false);
    setView({
      kind: "coop",
      key: Date.now(),
      startup: { slot: null, snapshot, name: "同机分工调查" },
    });
  };

  const loadCoopSlot = (slot: SaveSlot) => {
    const snapshot = validateSlotSnapshot(
      slot.snapshot,
      CASE_CONTENT,
    ) as CoopSnapshot;
    setSetup(false);
    setArchive(false);
    setView({
      kind: "coop",
      key: Date.now(),
      startup: { slot, snapshot: structuredClone(snapshot), name: slot.name },
    });
  };

  const loadCoopById = (id: string) => {
    const slot = readSlots(CASE_CONTENT).slots.find((s) => s.id === id);
    if (!slot || slot.snapshot.version !== 2) return;
    loadCoopSlot(slot);
  };

  const openArchiveCoop = () => {
    // 已有分工存档则进档案对话框选择，否则直接打开创建对话框。
    const hasCoop = readSlots(CASE_CONTENT).slots.some(
      (s) => s.snapshot.version === 2,
    );
    if (hasCoop) setArchive(true);
    else setSetup(true);
  };

  if (view.kind === "coop") {
    return (
      <CoopSession
        key={view.key}
        startup={view.startup}
        onExit={() => {
          setSlotsVersion((v) => v + 1);
          setView({ kind: "solo" });
        }}
      />
    );
  }

  return (
    <>
      <SoloSession
        key={`solo-${slotsVersion}`}
        slotsVersion={slotsVersion}
        archiveOpen={archive}
        onArchiveConsumed={() => setArchive(false)}
        onStartCoop={openArchiveCoop}
        onLoadCoop={loadCoopById}
      />
      {setup && (
        <CoopSetupDialog
          sceneLabels={Object.fromEntries(
            CASE_CONTENT.scenes.map((s) => [s.id, s.title]),
          )}
          onStart={startCoop}
          onClose={() => setSetup(false)}
        />
      )}
    </>
  );
}
