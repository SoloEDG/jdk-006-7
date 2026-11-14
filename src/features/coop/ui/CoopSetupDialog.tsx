import { useState } from "react";
import { UserRoundPlus, X, Users, Lock } from "lucide-react";
import type { InvestigatorId } from "../../../shared/types";
import {
  COOP_PARTITION,
  DEFAULT_INVESTIGATOR_NAMES,
} from "../model/coopState";

interface Props {
  onStart: (names: Record<InvestigatorId, string>) => void;
  onClose: () => void;
  sceneLabels: Record<string, string>;
}

/**
 * 创建同机分工模式：命名两名调查员，并展示各自负责的可听场景。
 * 不需要联网账号，所有数据只保存在本机。
 */
export function CoopSetupDialog({ onStart, onClose, sceneLabels }: Props) {
  const [names, setNames] = useState<Record<InvestigatorId, string>>({
    alpha: DEFAULT_INVESTIGATOR_NAMES.alpha,
    beta: DEFAULT_INVESTIGATOR_NAMES.beta,
  });
  const [error, setError] = useState("");
  const start = () => {
    const alpha = names.alpha.trim() || DEFAULT_INVESTIGATOR_NAMES.alpha;
    const beta = names.beta.trim() || DEFAULT_INVESTIGATOR_NAMES.beta;
    if (alpha === beta) {
      setError("两名调查员需要不同的名字，方便交接时辨认。");
      return;
    }
    onStart({ alpha, beta });
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="profiles-dialog coop-setup"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="dialog-header">
          <div>
            <span className="eyebrow">LOCAL CO-OP · 同机分工</span>
            <h2>
              <Users size={20} /> 创建两名调查员
            </h2>
          </div>
          <button className="icon-button" aria-label="关闭" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        <p className="panel-description">
          两人轮流使用同一副耳机调查同一案件。各自拥有独立的可听场景、已听记录和私有手记；
          只有主动提交的证据会进入公共会议。无需联网账号，数据仅保存在本机。
        </p>
        <div className="coop-investigator-grid">
          {(["alpha", "beta"] as InvestigatorId[]).map((id) => (
            <div className="coop-investigator-card" key={id}>
              <label htmlFor={`name-${id}`}>
                <UserRoundPlus size={14} />
                {id === "alpha" ? "调查员甲" : "调查员乙"}
              </label>
              <input
                id={`name-${id}`}
                maxLength={16}
                value={names[id]}
                onChange={(e) =>
                  setNames((prev) => ({ ...prev, [id]: e.target.value }))
                }
              />
              <div className="coop-scene-scope">
                <Lock size={12} />
                <span>可听场景：</span>
                {COOP_PARTITION[id].map((sceneId) => (
                  <em key={sceneId}>{sceneLabels[sceneId]}</em>
                ))}
              </div>
            </div>
          ))}
        </div>
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        <footer className="dialog-footer coop-setup-footer">
          <button className="primary-button" onClick={start}>
            <Users size={15} /> 开始分工调查
          </button>
          <span>交接时会进入密封画面，未公开内容互不可见</span>
        </footer>
      </section>
    </div>
  );
}
