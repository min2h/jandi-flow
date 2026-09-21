export const GARDEN_RELATIVE_PATH = ".jandi/GARDEN.md";

const HEADER = `# jandi-flow garden

이 파일은 잔디 심기 기록입니다. 앱이 commit 할 때마다 한 줄을 추가합니다.
대상 레포의 기존 소스와 기능은 수정하지 않습니다.

## 기록

`;

export function appendGardenJournal(existing: string, at: Date, message: string): string {
  const base = existing.includes("## 기록") ? existing.replace(/\s*$/, "\n") : HEADER;
  const stamp = at.toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
  const safe = message.replace(/\s+/g, " ").trim() || "garden tick";
  return `${base}- ${stamp} · ${safe}\n`;
}
