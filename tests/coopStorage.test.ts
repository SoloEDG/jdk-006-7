import test from "node:test";
import assert from "node:assert/strict";
import {
  createCoopSnapshot,
  validateCoopSnapshot,
  persistCoopSlot,
  submitClue,
  handoff,
  updateCoopEvidence,
} from "../src/features/coop/index";
import {
  readSlots,
  writeSlot,
  createSlot,
  validateSlotSnapshot,
} from "../src/features/profiles/index";
import { CASE_CONTENT, createInvestigation } from "../src/features/story";
import { createEvidence, addNote } from "../src/features/evidence";
import { createSnapshot } from "../src/features/profiles";
import type { CoopSnapshot } from "../src/shared/types";

const content = CASE_CONTENT;

function installMemoryStorage() {
  const memory = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, val: string) => memory.set(key, val),
      removeItem: (key: string) => memory.delete(key),
    },
  });
  return memory;
}

test("coop slot persists and restores whose turn it is plus the public set", () => {
  installMemoryStorage();
  let snap: CoopSnapshot = createCoopSnapshot(content, {
    alpha: "小林",
    beta: "小舟",
  });
  // 让 alpha 持有并提交 bell
  snap = updateCoopEvidence(snap, (s) => ({
    ...s,
    clues: [...s.clues, "bell"],
  }));
  snap = submitClue(content, snap, "bell");
  snap = handoff(snap); // 轮到 beta
  const slot = persistCoopSlot(content, null, "分工 A", snap);

  const restored = readSlots(content).slots;
  assert.equal(restored.length, 1);
  const loaded = restored[0];
  assert.equal(loaded.snapshot.version, 2);
  const coop = validateCoopSnapshot(loaded.snapshot, content);
  assert.equal(coop.activeInvestigator, "beta");
  assert.equal(coop.investigators.beta.name, "小舟");
  assert.deepEqual(
    coop.meeting.clues.map((e) => e.clueId),
    ["bell"],
  );
  assert.equal(coop.meeting.clues[0].contributors[0], "alpha");
  // 同槽再次写入应更新而不是新增
  const snap2 = handoff(coop);
  persistCoopSlot(content, slot.id, "分工 A", snap2);
  assert.equal(readSlots(content).slots.length, 1);
  assert.equal(
    validateCoopSnapshot(readSlots(content).slots[0].snapshot, content)
      .activeInvestigator,
    "alpha",
  );
});

test("v1 solo and v2 coop slots coexist and dispatch to the right validator", () => {
  installMemoryStorage();
  // 旧的单人存档（v1）
  const solo = createSnapshot(
    content,
    createInvestigation(),
    addNote(
      createEvidence(),
      { sceneId: "arrival", start: 1, end: 2 },
      "单人笔记",
    ),
    {},
    { sceneId: "arrival", position: 0, rate: 1 },
  );
  writeSlot([], createSlot("旧单人档", solo));
  // 新的分工存档（v2）
  const coop = createCoopSnapshot(content);
  writeSlot(readSlots(content).slots, createSlot("新分工档", coop));

  const slots = readSlots(content).slots;
  assert.equal(slots.length, 2);
  const byName = Object.fromEntries(slots.map((s) => [s.name, s]));
  assert.equal(byName["旧单人档"].snapshot.version, 1);
  assert.equal(byName["新分工档"].snapshot.version, 2);

  // 自动分发：v1 走旧校验、v2 走分工校验
  const soloChecked = validateSlotSnapshot(
    byName["旧单人档"].snapshot,
    content,
  );
  assert.equal(soloChecked.version, 1);
  assert.equal(
    (soloChecked as { evidence: { notes: { text: string }[] } }).evidence
      .notes[0].text,
    "单人笔记",
  );
  const coopChecked = validateSlotSnapshot(
    byName["新分工档"].snapshot,
    content,
  );
  assert.equal(coopChecked.version, 2);
  assert.equal(
    (coopChecked as CoopSnapshot).mode,
    "coop",
  );
});

test("corrupt coop slot is skipped while the other slot still recovers", () => {
  const memory = installMemoryStorage();
  persistCoopSlot(content, null, "好档", createCoopSnapshot(content));
  const raw = JSON.parse(memory.get("midnight-frequency:profiles:v1")!);
  // 破坏其中分工存档的分区归属
  raw[0].snapshot.investigators.alpha.sceneId = "tower";
  memory.set("midnight-frequency:profiles:v1", JSON.stringify(raw));
  const result = readSlots(content);
  assert.equal(result.slots.length, 0);
  assert.ok(result.warning);
});
