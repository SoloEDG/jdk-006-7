import { Check, Headphones, Lock, MapPin } from "lucide-react";
import type { CaseContent, CoopSnapshot } from "../../../shared/types";
import { canAccess } from "../model/coopState";

/**
 * 分工模式的章节列表：
 * 不属于当前调查员的场景只显示密封占位，不泄露标题或地点。
 */
export function CoopChapters({
  content,
  snap,
  onEnter,
}: {
  content: CaseContent;
  snap: CoopSnapshot;
  onEnter: (id: CoopSnapshot["story"]["sceneId"]) => void;
}) {
  const inv = snap.investigators[snap.activeInvestigator];
  return (
    <div className="chapters">
      <div className="side-caption">
        我的可听频道 <span>SEALED CHANNELS</span>
      </div>
      {content.scenes.map((s) => {
        const accessible = canAccess(inv.id, s.id);
        if (!accessible) {
          return (
            <div className="chapter chapter-sealed" key={s.id} aria-label="密封场景">
              <span className="chapter-number">
                <Lock size={13} />
              </span>
              <span>
                <strong>密封场景</strong>
                <small>
                  <MapPin size={9} />
                  搭档负责 · 无权接入
                </small>
              </span>
            </div>
          );
        }
        const visited = inv.visited.includes(s.id);
        const active = inv.sceneId === s.id;
        return (
          <button
            key={s.id}
            className={`chapter ${active ? "active" : ""}`}
            disabled={!visited}
            onClick={() => onEnter(s.id)}
          >
            <span className="chapter-number">
              {visited && !active ? <Check size={13} /> : s.chapter}
            </span>
            <span>
              <strong>{s.title}</strong>
              <small>
                <MapPin size={9} />
                {s.location}
              </small>
            </span>
            {active && <Headphones size={13} />}
          </button>
        );
      })}
      <div className="chapter-footer">
        你只能进入自己频道的录音。
        <br />
        搭档的发现，要等提交后才会公开。
      </div>
    </div>
  );
}
