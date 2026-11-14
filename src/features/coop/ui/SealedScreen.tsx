import { Lock, UserRound, Users } from "lucide-react";
import type { CoopSnapshot } from "../../../shared/types";
import { activeInvestigator, otherInvestigator } from "../model/coopState";

/**
 * 交接密封画面：
 * 仅显示轮到谁与公共材料数量，不展示任何未公开的录音标题、字幕或笔记。
 */
export function SealedScreen({
  snap,
  onUnseal,
}: {
  snap: CoopSnapshot;
  onUnseal: () => void;
}) {
  const next = activeInvestigator(snap);
  const previous = snap.investigators[otherInvestigator(snap.activeInvestigator)];
  return (
    <div className="sealed-backdrop" role="dialog" aria-modal="true">
      <section className="sealed-card">
        <div className="sealed-lock">
          <Lock size={30} />
        </div>
        <span className="eyebrow">SEALED HANDOFF · 密封交接</span>
        <h2>请把耳机交给下一位调查员</h2>
        <p className="sealed-sub">
          上一位调查员的录音、字幕与私有手记已全部密封，本画面不会泄露任何线索。
        </p>
        <div className="sealed-turn">
          <UserRound size={18} />
          <div>
            <small>现在轮到</small>
            <strong>{next.name}</strong>
          </div>
        </div>
        <div className="sealed-meta">
          <span>
            <Users size={14} /> 两名调查员：
            {Object.values(snap.investigators)
              .map((i) => i.name)
              .join("、")}
          </span>
          <span>公共会议已收录 {snap.meeting.clues.length} 条证据</span>
          <span>公共会议已收录 {snap.meeting.notes.length} 篇公开笔记</span>
        </div>
        <p className="sealed-warn">
          只有主动提交到会议的材料可以共享；{previous.name} 的未公开内容对你不可见。
        </p>
        <button className="primary sealed-confirm" onClick={onUnseal}>
          我是{next.name}，开始调查
        </button>
      </section>
    </div>
  );
}
