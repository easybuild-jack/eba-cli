import ora, { type Ora } from "ora";

let jsonOutput = false;

/** 开启 JSON 输出模式：stdout 只留一行 JSON，其余人类可读内容全部静默 */
export function setJsonOutput(enabled: boolean): void {
  jsonOutput = enabled;
}

export function isJsonOutput(): boolean {
  return jsonOutput;
}

/** 人类可读输出；JSON 模式下静默，保证 stdout 干净 */
export function print(line = ""): void {
  if (jsonOutput) return;
  process.stdout.write(line + "\n");
}

/** 结构化结果输出；仅在 JSON 模式下写 stdout */
export function emitJson(payload: unknown): void {
  if (!jsonOutput) return;
  process.stdout.write(JSON.stringify(payload) + "\n");
}

/** 进度条；JSON 模式下完全静默（isSilent 会同时禁用文本与动画） */
export function spinner(text: string): Ora {
  return ora({ text, isSilent: jsonOutput }).start();
}
