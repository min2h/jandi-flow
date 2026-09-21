import { RANDOM_MESSAGES, type MessageMode } from "./types.js";

export function pickCommitMessage(
  mode: MessageMode,
  fixed: string,
  random = Math.random
): string {
  if (mode === "fixed") {
    const text = fixed.trim();
    if (!text) throw new Error("고정 커밋 메시지를 입력하세요");
    return text;
  }
  const index = Math.floor(random() * RANDOM_MESSAGES.length);
  return RANDOM_MESSAGES[index] ?? RANDOM_MESSAGES[0];
}

export function resolveCommitCount(
  mode: "fixed" | "random",
  count: number,
  random = Math.random
): number {
  const max = Math.min(20, Math.max(1, Math.floor(count || 1)));
  if (mode === "fixed") return max;
  return 1 + Math.floor(random() * max);
}
