import test from "node:test";
import assert from "node:assert/strict";
import {
  createCoopSnapshot,
  enterCoopScene,
  applyCoopChoice,
  submitClue,
  submitNote,
  handoff,
  recordCoopHeard,
  updateCoopEvidence,
  canAccess,
  activeInvestigator,
  otherInvestigator,
  publicClueIds,
  isNotePublic,
  isCluePublic,
  COOP_PARTITION,
  validateCoopSnapshot,
} from "../src/features/coop/index";
import { addNote, collectClue } from "../src/features/evidence";
import { searchCues } from "../src/features/transcript";
import { CASE_CONTENT } from "../src/features/story";
import type { CoopSnapshot, InvestigatorId } from "../src/shared/types";

const content = CASE_CONTENT;

function fresh(): CoopSnapshot {
  return createCoopSnapshot(content, { alpha: "甲", beta: "乙" });
}

test("partition splits scenes without overlap except shared finale", () => {
  assert.deepEqual(COOP_PARTITION.alpha, ["arrival", "interview", "finale"]);
  assert.deepEqual(COOP_PARTITION.beta, ["harbor", "tower", "finale"]);
  assert.ok(canAccess("alpha", "arrival"));
  assert.equal(canAccess("alpha", "harbor"), false);
  assert.ok(canAccess("beta", "tower"));
  assert.equal(canAccess("beta", "interview"), false);
  assert.equal(otherInvestigator("alpha"), "beta");
});

test("an investigator cannot enter a scene assigned to the partner", () => {
  const snap = fresh();
  assert.equal(activeInvestigator(snap).id, "alpha");
  assert.throws(() => enterCoopScene(content, snap, "harbor"), /搭档|无权/);
  // alpha 可以进入自己分区的 interview
  assert.doesNotThrow(() => enterCoopScene(content, snap, "interview"));
});

test("heard history is private per investigator and never shared on handoff", () => {
  let snap = fresh();
  const episode = content.episodes.find((e) => e.id === "arrival-normal")!;
  snap = recordCoopHeard(snap, episode.id, 10);
  assert.equal(snap.investigators.alpha.heard[episode.id], 10);
  assert.equal(snap.investigators.beta.heard[episode.id], undefined);
  snap = handoff(snap);
  assert.equal(snap.activeInvestigator, "beta");
  // beta 的收听记录里完全没有 alpha 听过的音源
  assert.deepEqual(snap.investigators.beta.heard, {});
  // 共享场景指针跟随新调查员所在场景
  assert.equal(snap.story.sceneId, snap.investigators.beta.sceneId);
});

test("investigators cannot search or see each other's unheard subtitles", () => {
  // 字幕搜索只基于当前调查员的私有 heard 记录：alpha 听过不代表 beta 听过。
  let snap = fresh();
  const episode = content.episodes.find((e) => e.id === "arrival-normal")!;
  const query = episode.cues[0].text.slice(0, 2);
  // 没人听过时，搜索不返回任何对白（防止字幕内容泄露）。
  assert.equal(searchCues(episode, query, snap.investigators.alpha.heard).length, 0);
  snap = recordCoopHeard(snap, episode.id, episode.duration);
  // alpha 听完后可以搜到。
  assert.ok(searchCues(episode, query, snap.investigators.alpha.heard).length > 0);
  snap = handoff(snap);
  // beta 的私有 heard 为空，同一查询对 beta 仍然零结果。
  assert.deepEqual(snap.investigators.beta.heard, {});
  assert.equal(searchCues(episode, query, snap.investigators.beta.heard).length, 0);
});

test("collected clue stays private until explicitly submitted", () => {
  let snap = fresh();
  const episode = content.episodes.find((e) => e.id === "arrival-normal")!;
  const cue = episode.cues.find((c) => c.sound?.clueId === "bell")!;
  const heard = { [episode.id]: cue.sound!.end + 1 };
  snap = recordCoopHeard(snap, episode.id, heard[episode.id]);
  const evidence = collectClue(
    snap.investigators.alpha.evidence,
    episode,
    cue,
    snap.investigators.alpha.heard,
    { sceneId: "arrival", start: cue.sound!.start, end: cue.sound!.end },
  )!;
  snap = updateCoopEvidence(snap, () => evidence);
  assert.ok(snap.investigators.alpha.evidence.clues.includes("bell"));
  assert.equal(isCluePublic(snap.meeting, "bell"), false);
  assert.deepEqual(publicClueIds(snap.meeting), []);
  snap = submitClue(content, snap, "bell");
  assert.ok(isCluePublic(snap.meeting, "bell"));
  assert.deepEqual(publicClueIds(snap.meeting), ["bell"]);
});

test("duplicate clue submission keeps one entry but lists every contributor", () => {
  let snap = fresh();
  // alpha 提交 bell
  snap = seedClue(snap, "alpha", "bell");
  assert.equal(snap.meeting.clues.length, 1);
  // 模拟 beta 也独立收集并提交同一条线索
  snap = handoff(snap);
  snap = seedClue(snap, "beta", "bell");
  const entry = snap.meeting.clues.find((e) => e.clueId === "bell")!;
  assert.equal(snap.meeting.clues.length, 1);
  assert.deepEqual([...entry.contributors].sort(), ["alpha", "beta"]);
});

test("public note is a copy: later private edits do not rewrite the meeting", () => {
  let snap = fresh();
  const anchor = { sceneId: "arrival" as const, start: 1, end: 3 };
  snap = updateCoopEvidence(snap, (s) => addNote(s, anchor, "原始内容"));
  const noteId = snap.investigators.alpha.evidence.notes[0].id;
  snap = submitNote(snap, noteId);
  assert.ok(isNotePublic(snap.meeting, noteId));
  const publicId = snap.meeting.notes[0].id;
  assert.equal(snap.meeting.notes[0].text, "原始内容");
  // 提交后私下编辑
  snap = updateCoopEvidence(snap, (s) => ({
    ...s,
    notes: s.notes.map((n) =>
      n.id === noteId ? { ...n, text: "私下修改后的内容" } : n,
    ),
  }));
  assert.equal(
    snap.meeting.notes.find((n) => n.id === publicId)!.text,
    "原始内容",
  );
});

test("cannot submit a clue the investigator has not collected", () => {
  const snap = fresh();
  assert.throws(() => submitClue(content, snap, "horn"), /还没有/);
});

test("final choice stays locked until the meeting has the public evidence", () => {
  let snap = fresh();
  snap = enterCoopScene(content, snap, "interview");
  // 直接试图做出需要三份证据的终局选择（先移动到 tower 由 beta 完成）
  snap = handoff(snap);
  snap = enterCoopScene(content, snap, "harbor");
  snap = enterCoopScene(content, snap, "tower");
  assert.throws(() => applyCoopChoice(content, snap, "solve"), /缺少/);
  snap = seedClue(snap, "beta", "key");
  snap = seedClue(snap, "beta", "horn");
  // 还差 bell（错误信息使用线索的中文标题）
  assert.throws(() => applyCoopChoice(content, snap, "solve"), /钟/);
  snap = handoff(snap);
  snap = seedClue(snap, "alpha", "bell");
  snap = handoff(snap);
  const resolved = applyCoopChoice(content, snap, "solve");
  assert.equal(resolved.story.ending, "灯塔的真相");
});

test("codec rebuilds the snapshot and rejects cross-partition tampering", () => {
  const snap = fresh();
  const raw = JSON.parse(JSON.stringify(snap));
  raw.extra = "drop";
  const checked = validateCoopSnapshot(raw, content);
  assert.equal("extra" in checked, false);
  assert.equal(checked.version, 2);
  assert.equal(checked.mode, "coop");
  // 篡改：让 alpha 持有 beta 分区的场景
  const tampered = JSON.parse(JSON.stringify(snap));
  tampered.investigators.alpha.sceneId = "tower";
  assert.throws(
    () => validateCoopSnapshot(tampered, content),
    /无权接入/,
  );
  // 篡改：未知线索
  const badClue = JSON.parse(JSON.stringify(snap));
  badClue.meeting.clues.push({
    clueId: "ghost",
    contributors: ["alpha"],
    submittedAt: 1,
  });
  assert.throws(() => validateCoopSnapshot(badClue, content), /线索/);
});

test("round-trip preserves whose turn it is and what is already public", () => {
  let snap = fresh();
  snap = seedClue(snap, "alpha", "bell");
  snap = handoff(snap);
  const restored = validateCoopSnapshot(
    JSON.parse(JSON.stringify(snap)),
    content,
  );
  assert.equal(restored.activeInvestigator, "beta");
  assert.deepEqual(publicClueIds(restored.meeting), ["bell"]);
  assert.equal(restored.investigators.alpha.evidence.clues.includes("bell"), true);
  // beta 仍看不到 alpha 的私有收听明细之外的线索归属，公开线索仍在会议中
  assert.equal(isCluePublic(restored.meeting, "bell"), true);
});

test("wrong case id or version is rejected", () => {
  const snap = fresh();
  const wrongCase = JSON.parse(JSON.stringify(snap));
  wrongCase.caseId = "other";
  assert.throws(() => validateCoopSnapshot(wrongCase, content), /案件/);
  const wrongVersion = JSON.parse(JSON.stringify(snap));
  wrongVersion.version = 1;
  assert.throws(() => validateCoopSnapshot(wrongVersion, content), /版本/);
});

test("a choice toward the partner's scene records the decision without crossing channels", () => {
  let snap = fresh(); // alpha 在 arrival
  // visit-harbor 指向 beta 分区的 harbor
  const next = applyCoopChoice(content, snap, "visit-harbor");
  assert.equal(next.story.decisions.length, 1);
  assert.equal(next.story.decisions[0].choiceId, "visit-harbor");
  // alpha 仍停留在自己的场景，没有越权进入 harbor
  assert.equal(next.investigators.alpha.sceneId, "arrival");
  assert.deepEqual(next.investigators.alpha.visited, ["arrival"]);
  // 同分区选择（visit-keeper -> interview）应正常移动
  const moved = applyCoopChoice(content, snap, "visit-keeper");
  assert.equal(moved.investigators.alpha.sceneId, "interview");
  assert.ok(moved.investigators.alpha.visited.includes("interview"));
});

// 辅助：让指定调查员直接拥有并提交某条线索（绕过音频播放条件）。
function seedClue(
  snap: CoopSnapshot,
  id: InvestigatorId,
  clueId: string,
): CoopSnapshot {
  const sceneId = COOP_PARTITION[id].find((sid) =>
    content.episodes.some(
      (e) => e.sceneId === sid && e.cues.some((c) => c.sound?.clueId === clueId),
    ),
  )!;
  const episode = content.episodes.find(
    (e) =>
      e.sceneId === sceneId &&
      e.cues.some((c) => c.sound?.clueId === clueId),
  )!;
  const target =
    snap.activeInvestigator === id
      ? snap
      : { ...snap, activeInvestigator: id };
  const withClue = updateCoopEvidence(target, (s) => ({
    ...s,
    clues: [...s.clues, clueId],
  }));
  return submitClue(content, withClue, clueId);
}
