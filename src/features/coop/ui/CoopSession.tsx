import { useState } from "react";
import {
  Radio,
  ArrowUpRight,
  NotebookPen,
  Headphones,
  Volume2,
  BookOpen,
  Save,
  Check,
  ChevronRight,
  Users,
  ArrowLeftRight,
  Info,
} from "lucide-react";
import {
  CASE_CONTENT,
  Directions,
  SceneArtwork,
  sceneProgress,
} from "../../story";
import { Player } from "../../listening";
import { TranscriptPanel } from "../../transcript";
import { currentCue } from "../../transcript";
import { useCoopCase } from "../lib/useCoopCase";
import type { CoopStartup } from "../lib/useCoopCase";
import { CoopChapters } from "./CoopChapters";
import { CoopEvidencePanel } from "./CoopEvidencePanel";
import { MeetingPanel } from "./MeetingPanel";
import { SealedScreen } from "./SealedScreen";

type Tab = "transcript" | "evidence" | "meeting";

export function CoopSession({
  startup,
  onExit,
}: {
  startup: CoopStartup;
  onExit: () => void;
}) {
  const c = useCoopCase(startup);
  const [tab, setTab] = useState<Tab>("transcript");
  const [about, setAbout] = useState(false);
  const scene = CASE_CONTENT.scenes.find((s) => s.id === c.inv.sceneId)!;
  const cue = currentCue(c.episode, c.audio.view.position);
  const partner = c.snap.investigators[c.snap.activeInvestigator === "alpha" ? "beta" : "alpha"];

  if (c.sealed) {
    return <SealedScreen snap={c.snap} onUnseal={c.unseal} />;
  }

  return (
    <div className="app coop-app">
      <header className="topbar">
        <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
          <span className="brand-icon">
            <Radio size={23} />
          </span>
          <span>
            午夜频率<small>MIDNIGHT FREQUENCY</small>
          </span>
        </a>
        <nav>
          <span className="nav-selected coop-mode-tag">
            <Users size={14} />
            同机分工模式
          </span>
          <button onClick={() => setAbout(true)}>
            <BookOpen size={14} />
            收听指南
          </button>
        </nav>
        <button className="archive-button" onClick={onExit}>
          <ArrowLeftRight size={15} />
          返回单人模式
        </button>
        <div className="avatar">{c.inv.name.slice(0, 1)}</div>
      </header>
      <main>
        <div className="breadcrumbs">
          声音剧场 <ChevronRight size={11} /> 同机分工{" "}
          <ChevronRight size={11} />
          <span>雾港来电</span>
        </div>
        <div className="case-heading">
          <div>
            <div className="eyebrow">LOCAL CO-OP INVESTIGATION</div>
            <h1>
              雾港来电 · 分工调查
              <span>{c.inv.name} 的频道</span>
            </h1>
            <p>你与 {partner.name} 共用一副耳机，各自的发现默认互不可见。</p>
          </div>
          <div className="case-tags">
            <span className="headphone-tag">
              <Headphones size={12} />
              当前：{c.inv.name}
            </span>
          </div>
        </div>
        <div className="workspace">
          <aside className="left-column">
            <div className="case-file coop-case-file">
              <div className="file-stamp">CO-OP FILE / 001</div>
              <div className="case-icon">
                <Users size={32} />
              </div>
              <h3>{c.inv.name}</h3>
              <p>可听 {c.inv.accessibleScenes.length} 个场景 · 已到访 {c.inv.visited.length}</p>
              <span className="case-difficulty">
                探索进度 {sceneProgress(CASE_CONTENT, c.inv.visited)}%
              </span>
            </div>
            <CoopChapters content={CASE_CONTENT} snap={c.snap} onEnter={c.go} />
            <button className="handoff-button" onClick={c.handoff}>
              <ArrowLeftRight size={15} />
              密封交接给{partner.name}
            </button>
            <div className="left-note">
              <Info size={13} />
              <p>
                交接会进入密封画面，
                <br />
                你的未公开线索不会泄露。
              </p>
            </div>
          </aside>
          <div className="center-column">
            <section className="scene-card">
              <div className="scene-stage">
                <SceneArtwork sceneId={c.inv.sceneId} />
                <div className="stage-top">
                  <span>
                    <span className="live-dot" />{" "}
                    {c.audio.view.playing ? "正在收听" : "调查进行中"}
                  </span>
                  <span>EPISODE {scene.chapter} / 05</span>
                </div>
                <div className="stage-title">
                  <span className="scene-location">
                    {scene.location.toUpperCase()} / 23:17 PM
                  </span>
                  <h2>{c.episode.title}</h2>
                  <p>{scene.description}</p>
                </div>
                <div className="scene-grain" />
              </div>
              <div className="scene-meta">
                <div>
                  <span className="chapter-badge">CH. {scene.chapter}</span>
                  <strong>{c.episode.title}</strong>
                  <small>{c.episode.version}</small>
                </div>
                <button
                  onClick={() => {
                    c.audio.pause();
                    setTab("evidence");
                    c.note();
                  }}
                >
                  <NotebookPen size={14} />
                  记一笔
                </button>
              </div>
              <Player
                episode={c.episode}
                state={c.audio.view}
                onToggle={() => void c.audio.toggle()}
                onSeek={c.audio.seek}
                onRate={c.audio.setRate}
                onVolume={c.audio.setVolume}
                onNote={() => {
                  c.note();
                  setTab("evidence");
                }}
              />
              <div className="live-caption">
                <span>{cue?.speaker ?? "雾港电台"}</span>
                <p>
                  {c.audio.view.loading
                    ? "正在调谐下一段声音…"
                    : (cue?.text ?? "点击播放，让声音带你进入故事。")}
                </p>
                <Volume2 size={13} />
              </div>
            </section>
            <Directions
              content={CASE_CONTENT}
              story={c.snap.story}
              clues={c.meetingClueIds}
              onChoose={c.choose}
              accessibleTargets={c.inv.accessibleScenes}
            />
            <div className="session-bar">
              <span>
                <span className={`live-dot ${c.dirty ? "unsaved" : ""}`} />
                {c.dirty ? "有未保存更改" : "分工进度已自动保存在本机"}
              </span>
              <button onClick={() => c.saveAs(c.inv.name + " 的分工存档")}>
                <Save size={13} />
                另存存档
              </button>
              <button onClick={c.handoff}>
                <ArrowLeftRight size={12} />
                交接
              </button>
            </div>
          </div>
          <aside className="right-column">
            <div className="panel-tabs">
              <button
                className={tab === "transcript" ? "active" : ""}
                onClick={() => setTab("transcript")}
              >
                <Headphones size={14} />
                剧情字幕
              </button>
              <button
                className={tab === "evidence" ? "active" : ""}
                onClick={() => setTab("evidence")}
              >
                <NotebookPen size={14} />
                私手记<span>{c.inv.evidence.notes.length}</span>
              </button>
              <button
                className={tab === "meeting" ? "active" : ""}
                onClick={() => setTab("meeting")}
              >
                <Users size={14} />
                会议<span>{c.snap.meeting.clues.length}</span>
              </button>
            </div>
            {tab === "transcript" && (
              <TranscriptPanel
                episode={c.episode}
                position={c.audio.view.position}
                history={c.inv.heard}
                clues={c.meetingClueIds}
                onSeek={c.audio.seek}
                onCollect={(cueItem) => {
                  c.collect(cueItem);
                  setTab("evidence");
                }}
                canCollect={c.canCollect}
              />
            )}
            {tab === "evidence" && (
              <CoopEvidencePanel
                state={c.inv.evidence}
                content={CASE_CONTENT}
                isNotePublic={c.isNotePublic}
                isCluePublic={c.isCluePublic}
                onJump={c.jump}
                onEdit={c.edit}
                onDelete={c.remove}
                onPin={c.pin}
                onNew={c.note}
                onSubmitNote={c.submitNote}
                onSubmitClue={c.submitClue}
              />
            )}
            {tab === "meeting" && (
              <MeetingPanel content={CASE_CONTENT} snap={c.snap} />
            )}
            <div className="clue-tracker coop-tracker">
              <div>
                <span className="mini-label">PUBLIC EVIDENCE</span>
                <b>
                  {c.snap.meeting.clues.length}
                  <small> / 4</small>
                </b>
              </div>
              <div className="evidence-dots">
                {CASE_CONTENT.clues.map((clue) => {
                  const found = c.snap.meeting.clues.some(
                    (e) => e.clueId === clue.id,
                  );
                  return (
                    <span
                      key={clue.id}
                      title={found ? clue.title : "未公开的线索名称保持密封"}
                      className={found ? "found" : ""}
                    >
                      {found ? <Check size={12} /> : <Headphones size={11} />}
                    </span>
                  );
                })}
              </div>
              <p>只有提交到会议的证据才会计入，用于解锁共同结局。</p>
            </div>
          </aside>
        </div>
        <div role="status" className="notice">
          <span className="live-dot" />
          {c.notice}
        </div>
        <footer>
          <span>
            <Radio size={13} /> MIDNIGHT FREQUENCY <i /> 同机轮流 · 密封交接
          </span>
          <span>
            未公开的声音，只属于当前调查员。{" "}
            <span className="footer-id">JDK—006</span>
          </span>
        </footer>
      </main>
      {about && (
        <div className="modal-backdrop">
          <section className="guide-dialog">
            <button className="dialog-close" onClick={() => setAbout(false)}>
              关闭 ✕
            </button>
            <div className="eyebrow">LOCAL CO-OP GUIDE</div>
            <h2>两个人，一副耳机，各自的频率。</h2>
            <p>
              两名调查员被分配到不同的可听场景，只能听到自己频道的录音；字幕搜索也只会命中你自己已听过的对白。
            </p>
            <p>
              收集到的声音线索和写下的笔记默认保存在私有手记里，搭档无法看到。点击「提交」后，材料才会进入公共会议。
            </p>
            <p>
              重复提交同一条证据只保留一份，并记录所有贡献者；公开笔记是提交时的副本，之后私下编辑不会回写会议。
            </p>
            <p>
              交接时进入密封画面，轮到谁、哪些已公开都会在保存后准确保留；无需联网账号，全部数据仅存于本机。
            </p>
            <button className="primary" onClick={() => setAbout(false)}>
              继续调查 <ArrowUpRight size={15} />
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
