import type {
  CaseContent,
  CoopSnapshot,
  InvestigatorId,
  InvestigatorState,
  MeetingState,
  SceneId,
} from "../../../shared/types";
import { createEvidence } from "../../evidence";

export const INVESTIGATOR_IDS: InvestigatorId[] = ["alpha", "beta"];

export const COOP_PARTITION: Record<InvestigatorId, SceneId[]> = {
  alpha: ["arrival", "interview", "finale"],
  beta: ["harbor", "tower", "finale"],
};

export const DEFAULT_INVESTIGATOR_NAMES: Record<InvestigatorId, string> = {
  alpha: "调查员甲",
  beta: "调查员乙",
};

export function canAccess(
  id: InvestigatorId,
  sceneId: SceneId,
): boolean {
  return COOP_PARTITION[id].includes(sceneId);
}

export function otherInvestigator(id: InvestigatorId): InvestigatorId {
  return id === "alpha" ? "beta" : "alpha";
}

function createInvestigator(
  id: InvestigatorId,
  name: string,
): InvestigatorState {
  const sceneId = COOP_PARTITION[id][0];
  return {
    id,
    name: name.trim() || DEFAULT_INVESTIGATOR_NAMES[id],
    accessibleScenes: [...COOP_PARTITION[id]],
    sceneId,
    visited: [sceneId],
    evidence: createEvidence(),
    heard: {},
    resume: { sceneId, position: 0, rate: 1 },
  };
}

export function createCoopSnapshot(
  content: CaseContent,
  names: Partial<Record<InvestigatorId, string>> = {},
): CoopSnapshot {
  return {
    version: 2,
    mode: "coop",
    caseId: content.id,
    story: {
      sceneId: COOP_PARTITION.alpha[0],
      visited: [COOP_PARTITION.alpha[0]],
      decisions: [],
      ending: null,
    },
    activeInvestigator: "alpha",
    investigators: {
      alpha: createInvestigator("alpha", names.alpha ?? ""),
      beta: createInvestigator("beta", names.beta ?? ""),
    },
    meeting: { clues: [], notes: [] },
  };
}

export function activeInvestigator(
  snap: CoopSnapshot,
): InvestigatorState {
  return snap.investigators[snap.activeInvestigator];
}

export function publicClueIds(meeting: MeetingState): string[] {
  return meeting.clues.map((entry) => entry.clueId);
}

export function isNotePublic(
  meeting: MeetingState,
  noteId: string,
): boolean {
  return meeting.notes.some((entry) => entry.noteId === noteId);
}

export function isCluePublic(
  meeting: MeetingState,
  clueId: string,
): boolean {
  return meeting.clues.some((entry) => entry.clueId === clueId);
}

function withActive(
  snap: CoopSnapshot,
  update: (inv: InvestigatorState) => InvestigatorState,
): CoopSnapshot {
  const id = snap.activeInvestigator;
  return {
    ...snap,
    investigators: {
      ...snap.investigators,
      [id]: update(snap.investigators[id]),
    },
  };
}

export function renameInvestigators(
  snap: CoopSnapshot,
  names: Partial<Record<InvestigatorId, string>>,
): CoopSnapshot {
  const investigators = { ...snap.investigators };
  for (const id of INVESTIGATOR_IDS) {
    const name = names[id]?.trim();
    if (name) investigators[id] = { ...investigators[id], name };
  }
  return { ...snap, investigators };
}

/** 交接：进入密封画面，轮到另一名调查员，任何私有内容都不会进入交接画面。 */
export function handoff(snap: CoopSnapshot): CoopSnapshot {
  const next = otherInvestigator(snap.activeInvestigator);
  const nextScene = snap.investigators[next].sceneId;
  return {
    ...snap,
    activeInvestigator: next,
    // 共享指针跟随当前调查员，保证“下一步调查”读取的是其所在场景。
    story: { ...snap.story, sceneId: nextScene },
  };
}

export function enterCoopScene(
  content: CaseContent,
  snap: CoopSnapshot,
  sceneId: SceneId,
): CoopSnapshot {
  const id = snap.activeInvestigator;
  if (!canAccess(id, sceneId))
    throw new Error("这段录音由搭档负责，你的频道无法接入。");
  if (!content.scenes.some((s) => s.id === sceneId))
    throw new Error("调查地点不存在");
  return {
    ...withActive(snap, (inv) => ({
      ...inv,
      sceneId,
      visited: inv.visited.includes(sceneId)
        ? inv.visited
        : [...inv.visited, sceneId],
      resume: { ...inv.resume, sceneId, position: 0 },
    })),
    story: { ...snap.story, sceneId },
  };
}

export function applyCoopChoice(
  content: CaseContent,
  snap: CoopSnapshot,
  choiceId: string,
): CoopSnapshot {
  const inv = activeInvestigator(snap);
  const scene = content.scenes.find((s) => s.id === inv.sceneId);
  const choice = scene?.choices.find((c) => c.id === choiceId);
  if (!choice) throw new Error("调查方向不存在");
  const known = publicClueIds(snap.meeting);
  const missing = choice.requires.filter((clueId) => !known.includes(clueId));
  if (missing.length)
    throw new Error(
      "公共会议还缺少证据：" +
        missing
          .map(
            (clueId) =>
              content.clues.find((c) => c.id === clueId)?.title ?? clueId,
          )
          .join("、"),
    );
  const target = choice.target;
  const accessible = canAccess(inv.id, target);
  // 目标在自己频道内才移动当前调查员；跨分区的选择只记录决策，
  // 具体场景移动留给对应搭档在其频道内完成，避免越权接入。
  const moved = accessible
    ? enterCoopScene(content, snap, target)
    : snap;
  return {
    ...moved,
    story: {
      ...moved.story,
      sceneId: accessible ? target : moved.story.sceneId,
      decisions: [
        ...moved.story.decisions,
        { sceneId: inv.sceneId, choiceId },
      ],
      ending: target === "finale" ? "灯塔的真相" : moved.story.ending,
    },
  };
}

export function recordCoopHeard(
  snap: CoopSnapshot,
  sourceId: string,
  position: number,
): CoopSnapshot {
  if (!Number.isFinite(position) || position < 0) return snap;
  return withActive(snap, (inv) => ({
    ...inv,
    heard: {
      ...inv.heard,
      [sourceId]: Math.max(inv.heard[sourceId] || 0, position),
    },
  }));
}

export function updateCoopEvidence(
  snap: CoopSnapshot,
  fn: (state: InvestigatorState["evidence"]) => InvestigatorState["evidence"],
): CoopSnapshot {
  return withActive(snap, (inv) => ({ ...inv, evidence: fn(inv.evidence) }));
}

export function saveCoopResume(
  snap: CoopSnapshot,
  resume: InvestigatorState["resume"],
): CoopSnapshot {
  return withActive(snap, (inv) => ({ ...inv, resume }));
}

/** 主动提交线索：重复提交只保留一份，但追加贡献者。 */
export function submitClue(
  content: CaseContent,
  snap: CoopSnapshot,
  clueId: string,
): CoopSnapshot {
  const inv = activeInvestigator(snap);
  if (!inv.evidence.clues.includes(clueId))
    throw new Error("你还没有收集到这条声音线索。");
  if (!content.clues.some((c) => c.id === clueId))
    throw new Error("未知的线索。");
  const existing = snap.meeting.clues.find((e) => e.clueId === clueId);
  const clues = existing
    ? snap.meeting.clues.map((e) =>
        e.clueId === clueId && !e.contributors.includes(inv.id)
          ? { ...e, contributors: [...e.contributors, inv.id] }
          : e,
      )
    : [
        ...snap.meeting.clues,
        { clueId, contributors: [inv.id], submittedAt: Date.now() },
      ];
  return { ...snap, meeting: { ...snap.meeting, clues } };
}

/** 主动提交笔记：公共会议保存提交时的副本，之后私下编辑不回写。 */
export function submitNote(
  snap: CoopSnapshot,
  noteId: string,
): CoopSnapshot {
  const inv = activeInvestigator(snap);
  const note = inv.evidence.notes.find((n) => n.id === noteId);
  if (!note) throw new Error("笔记不存在。");
  if (isNotePublic(snap.meeting, noteId))
    throw new Error("这篇笔记已经在公共会议中。");
  const entry = {
    id: crypto.randomUUID(),
    noteId: note.id,
    contributor: inv.id,
    title: note.title,
    text: note.text,
    anchor: structuredClone(note.anchor),
    clueId: note.clueId,
    submittedAt: Date.now(),
  };
  return {
    ...snap,
    meeting: { ...snap.meeting, notes: [entry, ...snap.meeting.notes] },
  };
}
