import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Cue,
  SaveSlot,
  SceneId,
  CoopSnapshot,
  EvidenceNote,
  InvestigatorId,
} from "../../../shared/types";
import { CASE_CONTENT, resolveEpisode } from "../../story";
import { useTransport } from "../../listening";
import {
  addNote,
  collectClue,
  editNote,
  deleteNote,
  togglePinned,
  canCollectSound,
} from "../../evidence";
import {
  activeInvestigator,
  applyCoopChoice,
  canAccess,
  enterCoopScene,
  handoff as handoffState,
  isCluePublic,
  isNotePublic,
  publicClueIds,
  recordCoopHeard,
  renameInvestigators,
  saveCoopResume,
  submitClue as submitClueState,
  submitNote as submitNoteState,
  updateCoopEvidence,
} from "../model/coopState";
import { persistCoopSlot, removeCoopSlot } from "./coopStorage";

export interface CoopStartup {
  slot: SaveSlot | null;
  snapshot: CoopSnapshot;
  name: string;
}

export function useCoopCase(startup: CoopStartup) {
  const [snap, setSnap] = useState<CoopSnapshot>(
    structuredClone(startup.snapshot),
  );
  const [slotId, setSlotId] = useState<string | null>(startup.slot?.id ?? null);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState(
    "分工调查已开始，只有提交的证据才会进入公共会议。",
  );
  const [sealed, setSealed] = useState(false);
  const slotIdRef = useRef(slotId);
  slotIdRef.current = slotId;
  const nameRef = useRef(startup.name);

  const inv = activeInvestigator(snap);
  const meetingClueIds = useMemo(
    () => publicClueIds(snap.meeting),
    [snap.meeting],
  );
  const episode = resolveEpisode(CASE_CONTENT, inv.sceneId, meetingClueIds);

  // 落盘：交接、提交、场景移动等关键动作会写入本地存档。
  const persist = useCallback((next: CoopSnapshot): CoopSnapshot => {
    const slot = persistCoopSlot(
      CASE_CONTENT,
      slotIdRef.current,
      nameRef.current,
      next,
    );
    slotIdRef.current = slot.id;
    setSlotId(slot.id);
    setDirty(false);
    return next;
  }, []);

  const run = (fn: () => CoopSnapshot, message?: string) => {
    try {
      const next = fn();
      setSnap(persist(next));
      if (message) setNotice(message);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "操作未完成，请重试");
    }
  };

  // 收听进度高频更新，只在内存累积，不触发写盘。
  const onHeard = useCallback((sourceId: string, position: number) => {
    setSnap((current) => recordCoopHeard(current, sourceId, position));
  }, []);

  const audio = useTransport(episode, onHeard);

  // 轮到某位调查员（解封/初始载入）时，恢复其保存的播放位置与语速。
  const resumeApplied = useRef<string | null>(null);
  useEffect(() => {
    if (sealed) {
      resumeApplied.current = null;
      return;
    }
    const key = `${snap.activeInvestigator}:${episode.id}`;
    if (resumeApplied.current === key || audio.view.loading) return;
    resumeApplied.current = key;
    const r = snap.investigators[snap.activeInvestigator].resume;
    if (r.sceneId === inv.sceneId) {
      audio.seek(r.position);
      audio.setRate(r.rate);
    }
    // 仅在轮次/音源切换或加载完成时触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.activeInvestigator, episode.id, sealed, audio.view.loading]);

  const go = (id: SceneId, position = 0) => {
    if (!canAccess(inv.id, id)) {
      setNotice("这段录音由搭档负责，你的频道无法接入。");
      return;
    }
    audio.pause();
    if (id === inv.sceneId) {
      audio.seek(position);
    } else {
      audio.queueSeek(position);
    }
    run(() => enterCoopScene(CASE_CONTENT, snap, id), "已切换到你负责的录音。");
  };

  const choose = (choiceId: string) => {
    const scene = CASE_CONTENT.scenes.find((s) => s.id === inv.sceneId);
    const choice = scene?.choices.find((c) => c.id === choiceId);
    const crossChannel =
      !!choice && !canAccess(inv.id, choice.target);
    run(
      () => applyCoopChoice(CASE_CONTENT, snap, choiceId),
      crossChannel
        ? "该方向由搭档频道负责，已记录；请用「密封交接」把耳机交给搭档。"
        : "调查方向已更新，点击播放继续收听。",
    );
  };

  const note = () => {
    const anchor = audio.captureRange(inv.sceneId, 5);
    if (!anchor) {
      setNotice("请等待录音载入后再标记");
      return;
    }
    run(
      () =>
        updateCoopEvidence(snap, (state) =>
          addNote(state, anchor, "在这里写下你的观察…", "声音标记"),
        ),
      "已记录最近五秒，这篇私有笔记只有你能看见。",
    );
  };

  const collect = (cue: Cue) => {
    const anchor = audio.captureRange(
      inv.sceneId,
      Math.max(
        1,
        (cue.sound?.end || cue.end) - (cue.sound?.start || cue.start),
      ),
    );
    if (!anchor) return;
    const sound = cue.sound;
    const result = collectClue(inv.evidence, episode, cue, inv.heard, {
      ...anchor,
      start: sound?.start ?? cue.start,
      end: sound?.end ?? cue.end,
    });
    if (!result) {
      setNotice("请先听完这段声音，或检查是否已收集。");
      return;
    }
    audio.pause();
    run(
      () => updateCoopEvidence(snap, () => result),
      "声音线索已进入你的私手记；提交后才会出现在公共会议。",
    );
  };

  const jump = (n: EvidenceNote) => {
    go(n.anchor.sceneId, n.anchor.start);
    setNotice(`已定位到「${n.title}」对应声音，点击播放回听。`);
  };

  const submitClueById = (clueId: string) =>
    run(
      () => submitClueState(CASE_CONTENT, snap, clueId),
      "证据已提交到公共会议，两名调查员都能据此决定下一步。",
    );

  const submitNoteById = (noteId: string) =>
    run(
      () => submitNoteState(snap, noteId),
      "笔记副本已提交；之后你私下修改不会影响会议中的版本。",
    );

  const handoffTurn = () => {
    audio.pause();
    const withResume = saveCoopResume(snap, {
      sceneId: inv.sceneId,
      position: audio.view.position,
      rate: audio.view.rate,
    });
    const next = handoffState(withResume);
    setSnap(persist(next));
    setSealed(true);
  };

  const unseal = () => {
    setSealed(false);
    const current = activeInvestigator(snap);
    setNotice(`轮到 ${current.name}，请戴上耳机开始调查。`);
  };

  const saveAs = (name: string) => {
    const withResume = saveCoopResume(snap, {
      sceneId: inv.sceneId,
      position: audio.view.position,
      rate: audio.view.rate,
    });
    nameRef.current = name;
    const slot = persistCoopSlot(CASE_CONTENT, null, name, withResume);
    setSlotId(slot.id);
    slotIdRef.current = slot.id;
    setSnap(withResume);
    setDirty(false);
    setNotice(`分工调查「${slot.name}」已另存。`);
  };

  const removeSlot = (id: string) => {
    removeCoopSlot(CASE_CONTENT, id);
    if (slotId === id) {
      setSlotId(null);
      setDirty(true);
    }
  };

  const rename = (names: Partial<Record<InvestigatorId, string>>) =>
    run(() => renameInvestigators(snap, names), "调查员名称已更新。");

  return {
    snap,
    inv,
    episode,
    audio,
    slotId,
    dirty,
    notice,
    sealed,
    meetingClueIds,
    canCollect: (cue: Cue) =>
      !audio.view.loading && canCollectSound(inv.heard, episode, cue),
    isCluePublic: (clueId: string) => isCluePublic(snap.meeting, clueId),
    isNotePublic: (noteId: string) => isNotePublic(snap.meeting, noteId),
    go,
    choose,
    note,
    collect,
    jump,
    submitClue: submitClueById,
    submitNote: submitNoteById,
    handoff: handoffTurn,
    unseal,
    saveAs,
    removeSlot,
    rename,
    edit: (id: string, text: string) =>
      run(() => updateCoopEvidence(snap, (state) => editNote(state, id, text))),
    remove: (id: string) =>
      run(() => updateCoopEvidence(snap, (state) => deleteNote(state, id))),
    pin: (id: string) =>
      run(() => updateCoopEvidence(snap, (state) => togglePinned(state, id))),
  };
}
