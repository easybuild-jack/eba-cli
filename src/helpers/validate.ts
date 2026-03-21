import { access } from "node:fs/promises";
import { join, resolve } from "node:path";

/**
 * 校验项目名是否合法（npm 包命名规范）
 */
export function validateProjectName(name: string): true | string {
  if (!name) return "项目名称不能为空";
  if (!/^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(name)) {
    return "项目名称不合法，只能包含小写字母、数字、连字符和下划线";
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
