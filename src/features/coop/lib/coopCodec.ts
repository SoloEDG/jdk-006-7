import type {
  AudioBookmark,
  CaseContent,
  CoopSnapshot,
  EvidenceNote,
  InvestigatorId,
  InvestigatorState,
  MeetingState,
  PublicClueEntry,
  PublicNoteEntry,
  SceneId,
} from "../../../shared/types";
import { INVESTIGATOR_IDS, COOP_PARTITION } from "../model/coopState";

type Obj = Record<string, unknown>;

function object(value: unknown, label: string): Obj {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label}格式无效`);
  return value as Obj;
}
function string(value: unknown, label: string): string {
  if (typeof value !== "string" || !value)
    throw new Error(`${label}必须是文字`);
  return value;
}
function number(value: unknown, label: string, min = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min)
    throw new Error(`${label}数值无效`);
  return value;
}
function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label}必须是列表`);
  return value;
}
function boolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${label}必须是布尔值`);
  return value;
}
function investigatorId(value: unknown): InvestigatorId {
  const id = string(value, "调查员编号");
  if (!INVESTIGATOR_IDS.includes(id as InvestigatorId))
    throw new Error("未知的调查员");
  return id as InvestigatorId;
}

export function validateCoopSnapshot(
  input: unknown,
  content: CaseContent,
): CoopSnapshot {
  const root = object(input, "分工存档");
  if (root.version !== 2) throw new Error("不支持的分工存档版本");
  if (root.mode !== "coop") throw new Error("存档模式不匹配");
  if (root.caseId !== content.id) throw new Error("存档不属于当前案件");

  const scene = (value: unknown): SceneId => {
    const id = string(value, "场景");
    if (!content.scenes.some((item) => item.id === id))
      throw new Error("存档包含未知场景");
    return id as SceneId;
  };
  const clue = (value: unknown): string => {
    const id = string(value, "线索");
    if (!content.clues.some((item) => item.id === id))
      throw new Error("存档包含未知线索");
    return id;
  };
  const duration = (id: SceneId) =>
    Math.max(
      0,
      ...content.episodes
        .filter((episode) => episode.sceneId === id)
        .map((episode) => episode.duration),
    );
  const anchor = (value: unknown): AudioBookmark => {
    const a = object(value, "笔记锚点");
    const sceneId = scene(a.sceneId),
      start = number(a.start, "范围起点"),
      end = number(a.end, "范围终点");
    if (end < start || end > duration(sceneId))
      throw new Error("笔记范围超出音频");
    return { sceneId, start, end };
  };

  // 共享调查进度
  const rawStory = object(root.story, "调查进度");
  const decisions = array(rawStory.decisions, "决策").map((value) => {
    const d = object(value, "决策");
    const sceneId = scene(d.sceneId),
      choiceId = string(d.choiceId, "选项");
    if (
      !content.scenes
        .find((item) => item.id === sceneId)
        ?.choices.some((item) => item.id === choiceId)
    )
      throw new Error("存档包含未知选项");
    return { sceneId, choiceId };
  });
  const story = {
    sceneId: scene(rawStory.sceneId),
    visited: array(rawStory.visited, "到访场景").map(scene),
    decisions,
    ending:
      rawStory.ending === null ? null : string(rawStory.ending, "结局"),
  };

  const validateNotes = (value: unknown): EvidenceNote[] => {
    const notes = array(value, "笔记").map((item) => {
      const n = object(item, "笔记");
      const id = string(n.id, "笔记编号");
      return {
        id,
        clueId: n.clueId === null ? null : clue(n.clueId),
        title: string(n.title, "笔记标题"),
        text: string(n.text, "笔记内容"),
        anchor: anchor(n.anchor),
        createdAt: number(n.createdAt, "笔记日期"),
        pinned: boolean(n.pinned, "置顶"),
      };
    });
    if (new Set(notes.map((note) => note.id)).size !== notes.length)
      throw new Error("笔记编号重复");
    return notes;
  };

  // 两名调查员各自的私有状态
  const rawInvestigators = object(root.investigators, "调查员");
  const investigators = {} as Record<InvestigatorId, InvestigatorState>;
  for (const id of INVESTIGATOR_IDS) {
    const raw = object(rawInvestigators[id], `调查员${id}`);
    const name = string(raw.name, "调查员名称");
    const accessibleScenes = COOP_PARTITION[id];
    const sceneId = scene(raw.sceneId);
    if (!accessibleScenes.includes(sceneId))
      throw new Error("调查员被分配了无权接入的场景");
    const visited = array(raw.visited, "到访场景").map(scene);
    for (const visitedId of visited) {
      if (!accessibleScenes.includes(visitedId))
        throw new Error("到访记录包含无权接入的场景");
    }
    const rawEvidence = object(raw.evidence, "手记");
    const notes = validateNotes(rawEvidence.notes);
    const clues = array(rawEvidence.clues, "线索").map(clue);
    if (new Set(clues).size !== clues.length) throw new Error("线索重复");
    const selectedId =
      rawEvidence.selectedId === null
        ? null
        : string(rawEvidence.selectedId, "选中笔记");
    if (selectedId && !notes.some((note) => note.id === selectedId))
      throw new Error("选中的笔记不存在");
    const heard: InvestigatorState["heard"] = {};
    for (const [episodeId, value] of Object.entries(
      object(raw.heard, "收听记录"),
    )) {
      const episode = content.episodes.find((item) => item.id === episodeId);
      if (!episode) throw new Error("收听记录包含未知音源");
      const position = number(value, "收听位置");
      if (position > episode.duration) throw new Error("收听位置超出音频");
      heard[episodeId] = position;
    }
    const rawResume = object(raw.resume, "播放进度");
    const resumeSceneId = scene(rawResume.sceneId),
      position = number(rawResume.position, "播放位置"),
      rate = number(rawResume.rate, "播放速度");
    if (!accessibleScenes.includes(resumeSceneId))
      throw new Error("播放进度指向无权接入的场景");
    if (position > duration(resumeSceneId) || rate < 0.25 || rate > 4)
      throw new Error("播放进度无效");
    investigators[id] = {
      id,
      name,
      accessibleScenes: [...accessibleScenes],
      sceneId,
      visited,
      evidence: { notes, clues, selectedId },
      heard,
      resume: { sceneId: resumeSceneId, position, rate },
    };
  }

  const activeInvestigator = investigatorId(root.activeInvestigator);

  // 公共会议
  const rawMeeting = object(root.meeting, "公共会议");
  const clueEntries: PublicClueEntry[] = array(
    rawMeeting.clues,
    "公开线索",
  ).map((value) => {
    const e = object(value, "公开线索");
    const clueId = clue(e.clueId);
    const contributors = array(e.contributors, "贡献者").map(
      investigatorId,
    );
    if (new Set(contributors).size !== contributors.length)
      throw new Error("贡献者重复");
    if (!contributors.length) throw new Error("公开线索缺少贡献者");
    return {
      clueId,
      contributors,
      submittedAt: number(e.submittedAt, "提交时间"),
    };
  });
  if (
    new Set(clueEntries.map((entry) => entry.clueId)).size !==
    clueEntries.length
  )
    throw new Error("公开线索重复");
  const noteEntries: PublicNoteEntry[] = array(
    rawMeeting.notes,
    "公开笔记",
  ).map((value) => {
    const e = object(value, "公开笔记");
    return {
      id: string(e.id, "公开笔记编号"),
      noteId: string(e.noteId, "原始笔记编号"),
      contributor: investigatorId(e.contributor),
      title: string(e.title, "公开笔记标题"),
      text: string(e.text, "公开笔记内容"),
      anchor: anchor(e.anchor),
      clueId: e.clueId === null ? null : clue(e.clueId),
      submittedAt: number(e.submittedAt, "提交时间"),
    };
  });
  if (new Set(noteEntries.map((entry) => entry.id)).size !== noteEntries.length)
    throw new Error("公开笔记编号重复");
  const meeting: MeetingState = { clues: clueEntries, notes: noteEntries };

  return {
    version: 2,
    mode: "coop",
    caseId: content.id,
    story,
    activeInvestigator,
    investigators,
    meeting,
  };
}
