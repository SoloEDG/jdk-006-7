import { useRef, useState } from "react";
import {
  Archive,
  Download,
  FolderOpen,
  Plus,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import type {
  CaseSnapshot,
  CoopSnapshot,
  SaveSlot,
} from "../../../shared/types";
interface Props {
  slots: SaveSlot[];
  activeId: string | null;
  onLoad: (id: string) => void;
  onSave: (name: string) => void;
  onDelete: (id: string) => void;
  onImport: (text: string) => void;
  onExport: (id: string) => void;
  onClose: () => void;
  onLoadCoop?: (id: string) => void;
  onCreateCoop?: () => void;
}
export function ProfilesDialog({
  slots,
  activeId,
  onLoad,
  onSave,
  onDelete,
  onImport,
  onExport,
  onClose,
  onLoadCoop,
  onCreateCoop,
}: Props) {
  const [name, setName] = useState(""),
    [error, setError] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const run = (action: () => void) => {
    try {
      action();
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    }
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="profiles-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profiles-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="dialog-header">
          <div>
            <span className="eyebrow">INVESTIGATION ARCHIVE</span>
            <h2 id="profiles-title">
              <Archive size={20} /> 调查档案
            </h2>
          </div>
          <button
            className="icon-button"
            aria-label="关闭档案"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        <p className="panel-description">
          保存当前调查进度，随时回到熟悉的频率。
        </p>
        {onCreateCoop && (
          <button className="coop-archive-entry" onClick={onCreateCoop}>
            <Users size={15} />
            <span>
              <strong>开启同机分工模式</strong>
              <small>两名调查员轮流戴耳机，私有手记 + 公共会议</small>
            </span>
          </button>
        )}
        <form
          className="profile-save-form"
          onSubmit={(event) => {
            event.preventDefault();
            run(() => {
              onSave(name);
              setName("");
            });
          }}
        >
          <label htmlFor="save-name">新档案名称</label>
          <div className="profile-save-row">
            <input
              id="save-name"
              placeholder="例如：钟声之后"
              maxLength={24}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <button
              className="primary-button"
              disabled={!name.trim() || slots.length >= 8}
            >
              <Plus size={15} /> 保存当前进度
            </button>
          </div>
          <small>{slots.length}/8 份档案 · 仅保存在当前浏览器</small>
        </form>
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        <div className="profile-list">
          {slots.length === 0 ? (
            <div className="empty-notes">
              <Archive size={28} />
              <p>还没有保存的档案</p>
              <small>为这次调查留一个位置。</small>
            </div>
          ) : (
            slots.map((slot) => {
              const isCoop = slot.snapshot.version === 2;
              const coop = isCoop
                ? (slot.snapshot as CoopSnapshot)
                : null;
              const solo = !isCoop
                ? (slot.snapshot as CaseSnapshot)
                : null;
              return (
                <article
                  className={`profile-card ${activeId === slot.id ? "active" : ""} ${isCoop ? "coop-card" : ""}`}
                  key={slot.id}
                >
                  <div>
                    <h3>
                      {slot.name}
                      {isCoop && (
                        <span className="coop-label">
                          <Users size={10} /> 同机分工
                        </span>
                      )}
                      {activeId === slot.id && !isCoop && (
                        <span className="active-label">当前档案</span>
                      )}
                    </h3>
                    {coop ? (
                      <p>
                        {new Date(slot.updatedAt).toLocaleString("zh-CN")} ·
                        轮到「{coop.investigators[coop.activeInvestigator].name}
                        」 · 公开 {coop.meeting.clues.length} 条证据 ·{" "}
                        {coop.meeting.notes.length} 篇公开笔记
                      </p>
                    ) : (
                      <p>
                        {new Date(slot.updatedAt).toLocaleString("zh-CN")} ·{" "}
                        {solo!.evidence.clues.length} 条线索 ·{" "}
                        {solo!.evidence.notes.length} 篇笔记
                      </p>
                    )}
                  </div>
                  <div className="profile-actions">
                    {isCoop && onLoadCoop ? (
                      <button onClick={() => run(() => onLoadCoop(slot.id))}>
                        <Users size={15} /> 进入分工
                      </button>
                    ) : (
                      !isCoop && (
                        <button onClick={() => run(() => onLoad(slot.id))}>
                          <FolderOpen size={15} /> 读取
                        </button>
                      )
                    )}
                    <button
                      aria-label={`导出 ${slot.name}`}
                      onClick={() => run(() => onExport(slot.id))}
                    >
                      <Download size={15} />
                    </button>
                    <button
                      aria-label={`删除 ${slot.name}`}
                      onClick={() => run(() => onDelete(slot.id))}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
        <footer className="dialog-footer">
          <input
            ref={file}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={async (event) => {
              const selected = event.target.files?.[0];
              if (!selected) return;
              try {
                onImport(await selected.text());
                setError("");
              } catch (e) {
                setError(e instanceof Error ? e.message : "无法导入档案");
              } finally {
                event.target.value = "";
              }
            }}
          />
          <button
            className="secondary-button"
            onClick={() => file.current?.click()}
          >
            <Upload size={15} /> 导入档案
          </button>
          <span>导出的 JSON 文件可在其他设备继续调查</span>
        </footer>
      </section>
    </div>
  );
}
