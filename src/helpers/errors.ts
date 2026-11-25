/** CLI 失败时对外暴露的错误码，用于 --json 输出与 Agent 分支处理 */
export type CliErrorCode =
  | "INVALID_ARGS"
  | "INVALID_PROJECT_NAME"
  | "NON_INTERACTIVE"
  | "DIR_EXISTS"
  | "DOWNLOAD_FAILED"
  | "TEMPLATE_INVALID"
  | "UNEXPECTED";

export class CliError extends Error {
  readonly code: CliErrorCode;
  /** 人类可读模式下额外打印的一行建议（JSON 模式不使用） */
  readonly hint?: string;

  constructor(
    code: CliErrorCode,
    message: string,
    options: { hint?: string; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "CliError";
    this.code = code;
    this.hint = options.hint;
  }
}
