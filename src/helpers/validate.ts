import { access } from "node:fs/promises";
import { resolve } from "node:path";

/** npm 包名长度上限，同时避免超长目录名 */
const MAX_NAME_LENGTH = 214;

/**
 * 校验项目名是否合法（npm 包命名规范）
 */
export function validateProjectName(name: string): true | string {
  if (!name) return "项目名称不能为空";
  if (name.length > MAX_NAME_LENGTH) return `项目名称不能超过 ${MAX_NAME_LENGTH} 个字符`;
  if (!/^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(name)) {
    return "项目名称不合法，只能包含小写字母、数字、连字符和下划线（作用域包名形如 @scope/name）";
  }
  return true;
}

/**
 * 检查目标目录是否已存在
 */
export async function checkDirExists(name: string): Promise<boolean> {
  const target = resolve(process.cwd(), name);
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}
