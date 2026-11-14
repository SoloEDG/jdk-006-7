import { ArrowUpRight, Lock, Compass, Users } from "lucide-react";
import type { CaseContent, Investigation, SceneId } from "../../../shared/types";
export function Directions({
  content,
  story,
  clues,
  onChoose,
  accessibleTargets,
}: {
  content: CaseContent;
  story: Investigation;
  clues: string[];
  onChoose: (id: string) => void;
  /** 分工模式下当前调查员可进入的目标场景；缺省时视为全部可进入（单人模式）。 */
  accessibleTargets?: SceneId[];
}) {
  const s = content.scenes.find((s) => s.id === story.sceneId)!;
  return (
    <section className="directions">
      <div className="section-title">
        <span>
          <Compass size={15} /> 下一步调查
        </span>
        <small>你的选择，将改变故事的回声。</small>
      </div>
      <div className="direction-grid">
        {s.choices.map((c) => {
          const locked = !c.requires.every((id) => clues.includes(id));
          const crossChannel =
            accessibleTargets !== undefined &&
            !accessibleTargets.includes(c.target);
          return (
            <button
              key={c.id}
              disabled={locked}
              className={crossChannel ? "cross-channel" : ""}
              onClick={() => onChoose(c.id)}
            >
              <span className="direction-icon">
                {locked ? (
                  <Lock size={16} />
                ) : crossChannel ? (
                  <Users size={16} />
                ) : (
                  <ArrowUpRight size={17} />
                )}
              </span>
              <span>
                <strong>{c.label}</strong>
                <small>
                  {locked
                    ? "缺少证据：" +
                      c.requires
                        .filter((id) => !clues.includes(id))
                        .map(
                          (id) => content.clues.find((c) => c.id === id)?.title,
                        )
                        .join("、")
                    : crossChannel
                      ? "搭档频道负责 · 记录方向后请密封交接"
                      : c.description}
                </small>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
