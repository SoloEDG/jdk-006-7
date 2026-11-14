import type {
  CaseContent,
  CaseSnapshot,
  CoopSnapshot,
  SaveSlot,
} from "../../../shared/types";
import { validateSnapshot } from "../lib/codec";
import { validateCoopSnapshot } from "../../coop/lib/coopCodec";
export const MAX_SLOTS = 8;
export function normalizeSlotName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("请输入档案名称");
  if (trimmed.length > 24) throw new Error("档案名称最多 24 个字");
  return trimmed;
}
export function validateSlotSnapshot(
  input: unknown,
  content: CaseContent,
): CaseSnapshot | CoopSnapshot {
  const root = input as { version?: unknown } | null;
  if (root && root.version === 2)
    return validateCoopSnapshot(input, content);
  return validateSnapshot(input, content);
}
export function createSlot(
  name: string,
  snapshot: CaseSnapshot | CoopSnapshot,
): SaveSlot {
  return {
    id: crypto.randomUUID(),
    name: normalizeSlotName(name),
    updatedAt: Date.now(),
    snapshot: structuredClone(snapshot),
  };
}
export function exportSlot(slot: SaveSlot): string {
  return JSON.stringify(slot, null, 2);
}
export function parseStoredSlot(
  input: unknown,
  content: CaseContent,
): SaveSlot {
  if (!input || typeof input !== "object") throw new Error("存档卡片格式无效");
  const s = input as Record<string, unknown>;
  if (
    typeof s.id !== "string" ||
    !s.id ||
    typeof s.name !== "string" ||
    typeof s.updatedAt !== "number" ||
    !Number.isFinite(s.updatedAt) ||
    s.updatedAt < 0
  )
    throw new Error("存档卡片信息无效");
  return {
    id: s.id,
    name: normalizeSlotName(s.name),
    updatedAt: s.updatedAt,
    snapshot: validateSlotSnapshot(s.snapshot, content),
  };
}
export function parseImported(text: string, content: CaseContent): SaveSlot {
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    throw new Error("导入失败：文件不是有效 JSON");
  }
  const slot = parseStoredSlot(input, content);
  return createSlot(`${slot.name.slice(0, 20)} · 副本`, slot.snapshot);
}
