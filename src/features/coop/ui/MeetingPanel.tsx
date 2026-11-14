import { Users, FileText, Headphones, ShieldCheck } from "lucide-react";
import type { CaseContent, CoopSnapshot } from "../../../shared/types";
import { activeInvestigator } from "../model/coopState";

const time = (n: number) =>
  `${Math.floor(n / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(n % 60)
    .toString()
    .padStart(2, "0")}`;

/**
 * 公共会议：只呈现两名调查员主动提交的材料。
 * 公开笔记是提交时的副本，会议中不提供编辑入口。
 */
export function MeetingPanel({
  content,
  snap,
}: {
  content: CaseContent;
  snap: CoopSnapshot;
}) {
  const current = activeInvestigator(snap);
  const nameOf = (id: string) => snap.investigators[id as keyof typeof snap.investigators]?.name ?? id;
  return (
    <section className="meeting-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">PUBLIC MEETING</span>
          <h2>
            <Users size={18} /> 公共会议
          </h2>
        </div>
        <span className="count-badge">{snap.meeting.clues.length} 条证据</span>
      </div>
      <p className="panel-description">
        只有主动提交的证据与笔记会出现在这里，两个人据此共同决定下一步。
      </p>

      <div className="meeting-section">
        <h3>
          <ShieldCheck size={14} /> 公开证据
        </h3>
        {snap.meeting.clues.length === 0 ? (
          <div className="empty-notes">
            <Headphones size={26} />
            <p>会议还没有公开证据</p>
            <small>在私手记里收集线索后，点击「提交到会议」。</small>
          </div>
        ) : (
          snap.meeting.clues.map((entry) => {
            const clue = content.clues.find((c) => c.id === entry.clueId);
            return (
              <article className="meeting-card" key={entry.clueId}>
                <div className="meeting-card-head">
                  <strong>{clue?.title ?? entry.clueId}</strong>
                  <span className="meeting-kind">{clue?.kind}</span>
                </div>
                <p>{clue?.description}</p>
                <div className="meeting-contributors">
                  <Users size={12} />
                  贡献者：
                  {entry.contributors.map((id) => (
                    <span
                      key={id}
                      className={`contributor ${id === current.id ? "me" : ""}`}
                    >
                      {nameOf(id)}
                      {id === current.id ? "（我）" : ""}
                    </span>
                  ))}
                </div>
              </article>
            );
          })
        )}
      </div>

      <div className="meeting-section">
        <h3>
          <FileText size={14} /> 公开笔记（提交时副本）
        </h3>
        {snap.meeting.notes.length === 0 ? (
          <div className="empty-notes">
            <FileText size={26} />
            <p>还没有公开笔记</p>
            <small>提交后的笔记会冻结为副本，私下再改不会回写这里。</small>
          </div>
        ) : (
          snap.meeting.notes.map((entry) => (
            <article className="meeting-card note" key={entry.id}>
              <div className="meeting-card-head">
                <strong>{entry.title}</strong>
                <span className="meeting-kind">{nameOf(entry.contributor)} 提交</span>
              </div>
              <p>{entry.text}</p>
              <div className="meeting-anchor">
                <Headphones size={12} />
                {content.scenes.find((s) => s.id === entry.anchor.sceneId)
                  ?.title ?? entry.anchor.sceneId}{" "}
                · {time(entry.anchor.start)} — {time(entry.anchor.end)}
              </div>
            </article>
          ))
        )}
      </div>
      <footer className="evidence-footer">
        会议材料对两名调查员公开 · 未提交的内容保持密封
      </footer>
    </section>
  );
}
