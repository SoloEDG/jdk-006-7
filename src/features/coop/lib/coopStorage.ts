import type { CaseContent, CoopSnapshot, SaveSlot } from "../../../shared/types";
import {
  createSlot,
  readSlots,
  writeSlot,
  deleteSlot,
  MAX_SLOTS,
} from "../../profiles";

/**
 * 分工模式始终把当前会话落盘到唯一的存档槽，
 * 读取时直接改本地存储，保证应用层的档案对话框读到最新数据。
 */
export function persistCoopSlot(
  content: CaseContent,
  slotId: string | null,
  name: string,
  snapshot: CoopSnapshot,
): SaveSlot {
  const current = readSlots(content).slots;
  const existing = slotId
    ? current.find((slot) => slot.id === slotId)
    : undefined;
  if (existing) {
    const updated: SaveSlot = {
      ...existing,
      updatedAt: Date.now(),
      snapshot: structuredClone(snapshot),
    };
    writeSlot(current, updated);
    return updated;
  }
  if (current.length >= MAX_SLOTS)
    throw new Error("最多保存 8 份档案，请先删除一份");
  const created = createSlot(name, structuredClone(snapshot));
  writeSlot(current, created);
  return created;
}

export function removeCoopSlot(content: CaseContent, id: string): void {
  const current = readSlots(content).slots;
  deleteSlot(current, id);
}
