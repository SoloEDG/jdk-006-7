import { useState } from "react";
import {
  Check,
  Headphones,
  Pin,
  Plus,
  Trash2,
  X,
  Pencil,
  Send,
  Lock,
} from "lucide-react";
import type {
  CaseContent,
  EvidenceNote,
  EvidenceState,
} from "../../../shared/types";

const time = (n: number) =>
  `${Math.floor(n / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(n % 60)
    .toString()
    .padStart(2, "0")}`;

interface Props {
  state: EvidenceState;
  content: CaseContent;
  isNotePublic: (id: string) => boolean;
  isCluePublic: (id: string) => boolean;
  onJump: (note: EvidenceNote) => void;
  onEdit: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onPin: (id: string) => void;
  onNew: () => void;
  onSubmitNote: (id: string) => void;
  onSubmitClue: (clueId: string) => void;
}

/**
 * 调查员的私有手记：收集到的线索与笔记默认只有自己可见，
 * 通过「提交到会议」主动公开；已公开的内容显示标记，笔记仍可私下编辑。
 */
export function CoopEvidencePanel({
  state,
  content,
  isNotePublic,
  isCluePublic,
  onJump,
  onEdit,
  onDelete,
  onPin,
  onNew,
  onSubmitNote,
  onSubmitClue,
}: Props) {
  const [editing, setEditing] = useState<string | null>(null),
    [draft, setDraft] = useState("");
  const notes = [...state.notes].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned),
  );
  return (
    <aside className="evidence-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">PRIVATE NOTES</span>
          <h2>
            <Lock size={16} /> 私有手记
          </h2>
        </div>
        <span className="count-badge">{state.clues.length} 条线索</span>
      </div>
      <p className="panel-description">
        这里的内容仅本人可见，提交后才进入公共会议。
      </p>
      <button className="new-note" onClick={onNew}>
        <Plus size={16} /> 添加收听笔记
      </button>
      <div className="evidence-list">
        {notes.length === 0 ? (
          <div className="empty-notes">
            <Headphones size={26} />
            <p>还没有私有笔记</p>
            <small>播放录音，捕捉值得留意的片刻。</small>
          </div>
        ) : (
          notes.map((note) => {
            const notePublic = isNotePublic(note.id);
            const cluePublic = note.clueId ? isCluePublic(note.clueId) : false;
            return (
              <article
                className={`evidence-card ${note.pinned ? "is-pinned" : ""}`}
                key={note.id}
              >
                <div className="note-heading">
                  <span className="note-kind">
                    {note.clueId ? "声音线索" : "收听笔记"}
                  </span>
                  <div className="note-heading-actions">
                    {notePublic && (
                      <span className="public-badge">
                        <Check size={11} /> 已公开
                      </span>
                    )}
                    <button
                      className={`icon-button ${note.pinned ? "active" : ""}`}
                      aria-label={note.pinned ? "取消置顶" : "置顶笔记"}
                      onClick={() => onPin(note.id)}
                    >
                      <Pin size={14} />
                    </button>
                  </div>
                </div>
                <h3>
                  {note.clueId
                    ? content.clues.find((clue) => clue.id === note.clueId)
                        ?.title || note.title
                    : note.title}
                </h3>
                {editing === note.id ? (
                  <>
                    <textarea
                      aria-label="编辑笔记"
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                    />
                    <div className="note-actions">
                      <button
                        disabled={!draft.trim()}
                        onClick={() => {
                          onEdit(note.id, draft);
                          setEditing(null);
                        }}
                      >
                        <Check size={13} /> 保存
                      </button>
                      <button onClick={() => setEditing(null)}>
                        <X size={13} /> 取消
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="note-text">{note.text}</p>
                )}
                <button className="note-play" onClick={() => onJump(note)}>
                  <Headphones size={13} />
                  {
                    content.scenes.find(
                      (scene) => scene.id === note.anchor.sceneId,
                    )?.title
                  }{" "}
                  · {time(note.anchor.start)} — {time(note.anchor.end)}
                </button>
                <div className="note-actions">
                  <button
                    aria-label="编辑笔记"
                    onClick={() => {
                      setEditing(note.id);
                      setDraft(note.text);
                    }}
                  >
                    <Pencil size={13} /> 编辑
                  </button>
                  <button
                    aria-label="删除笔记"
                    onClick={() => onDelete(note.id)}
                  >
                    <Trash2 size={13} /> 删除
                  </button>
                  {!notePublic && (
                    <button
                      className="submit-note-btn"
                      onClick={() => onSubmitNote(note.id)}
                    >
                      <Send size={13} /> 提交笔记副本
                    </button>
                  )}
                </div>
                {note.clueId && !cluePublic && (
                  <button
                    className="submit-clue-btn"
                    onClick={() => onSubmitClue(note.clueId!)}
                  >
                    <Send size={13} /> 提交这条证据到公共会议
                  </button>
                )}
              </article>
            );
          })
        )}
      </div>
      <footer className="evidence-footer">
        私有手记仅保存在此设备 · 提交动作才会共享
      </footer>
    </aside>
  );
}
