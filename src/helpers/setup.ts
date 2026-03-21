import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execSync } from "node:child_process";
import ora from "ora";
import { logger } from "./logger.js";

interface ProjectMeta {
  name: string;
  description: string;
}

/**
 * 替换 package.json 中的 name 和 description
 */
export async function replacePackageMeta(projectDir: string, meta: ProjectMeta): Promise<void> {
  const pkgPath = join(projectDir, "package.json");

  try {
    const raw = await readFile(pkgPath, "utf-8");
    const pkg = JSON.parse(raw);

    pkg.name = meta.name;
    pkg.description = meta.description;
    pkg.version = "0.1.0";

    await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
    logger.success("已更新 package.json 中的项目信息");
  } catch {
    logger.warn("未找到 package.json 或更新失败，跳过");
  }
}

/**
 * 初始化 git 仓库
 */
export async function initGit(projectDir: string): Promise<void> {
  const spinner = ora("正在初始化 Git 仓库...").start();

  try {
    execSync("git init", { cwd: projectDir, stdio: "ignore" });
    execSync("git add -A", { cwd: projectDir, stdio: "ignore" });
    execSync('git commit -m "chore: init project from EasyBuild template"', {
      cwd: projectDir,
      stdio: "ignore",
    });
    spinner.succeed("Git 仓库初始化完成");
  } catch {
    spinner.warn("Git 初始化失败（可能未安装 git），跳过");
  }
}

type PackageManager = "yarn" | "pnpm" | "npm";

/**
 * 安装项目依赖
 */
export async function installDeps(projectDir: string, pm: PackageManager): Promise<void> {
  const spinner = ora(`正在使用 ${pm} 安装依赖...`).start();

  const commands: Record<PackageManager, string> = {
    yarn: "yarn install",
    pnpm: "pnpm install",
    npm: "npm install",
  };

  try {
    execSync(commands[pm], {
      cwd: projectDir,
      stdio: "ignore",
      timeout: 300_000, // 5 分钟超时
    });
    spinner.succeed("依赖安装完成");
  } catch {
    spinner.fail("依赖安装失败");
    logger.warn(`请手动进入项目目录执行: ${commands[pm]}`);
  }
}
