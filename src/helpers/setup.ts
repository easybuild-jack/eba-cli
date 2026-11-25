import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execSync, spawn, spawnSync } from "node:child_process";
import chalk from "chalk";
import { logger } from "./logger.js";
import { CliError } from "./errors.js";
import { print, spinner as startSpinner } from "./output.js";
import type { PackageManager } from "../constants.js";

interface ProjectMeta {
  name: string;
  description: string;
}

/** git 初始化的结果，用于 --json 报告 */
export interface GitResult {
  skipped: boolean;
  initialized: boolean;
  committed: boolean;
}

interface RunResult {
  ok: boolean;
  timedOut: boolean;
  stderr: string;
}

/** 依赖安装默认超时 5 分钟，慢速网络下可用环境变量覆盖 */
const DEFAULT_INSTALL_TIMEOUT = 300_000;

function installTimeout(): number {
  const fromEnv = Number(process.env.EASYBUILD_INSTALL_TIMEOUT_MS);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_INSTALL_TIMEOUT;
}

/** 把毫秒时长格式化成可读文本，避免自定义短超时时显示成"1 分钟" */
function formatDuration(ms: number): string {
  return ms >= 60_000 ? `${Math.round(ms / 60_000)} 分钟` : `${Math.max(1, Math.round(ms / 1000))} 秒`;
}

/** 取命令失败时 stderr 的最后一行，作为可读的失败原因 */
function lastErrorLine(err: unknown): string {
  const stderr = (err as { stderr?: Buffer | string }).stderr;
  const text = stderr ? stderr.toString() : "";
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length > 0) return lines[lines.length - 1];
  return err instanceof Error ? err.message : String(err);
}

/** 取 stderr 末尾若干行用于展示 */
function stderrTail(stderr: string, maxLines: number): string[] {
  return stderr
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .slice(-maxLines)
    .map((line) => line.trimEnd());
}

/**
 * 以 shell 方式执行命令并收集 stderr。
 * 超时会终止整个子进程树——execSync 的 timeout 在 Windows 上只会杀掉外层 shell，
 * npm/pnpm 子进程会残留并继续写目标目录。
 */
function runCommand(command: string, cwd: string, timeoutMs: number): Promise<RunResult> {
  return new Promise((resolvePromise) => {
    const isWindows = process.platform === "win32";
    const child = spawn(command, {
      cwd,
      shell: true,
      windowsHide: true,
      detached: !isWindows, // POSIX 下独立进程组，便于整组终止
      stdio: ["ignore", "ignore", "pipe"],
    });

    let stderr = "";
    let timedOut = false;
    let settled = false;

    const timer = setTimeout(() => {
      timedOut = true;
      if (!child.pid) return;

      if (isWindows) {
        spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      } else {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {
          // 进程可能已退出，忽略
        }
      }
    }, timeoutMs);

    const finish = (result: RunResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolvePromise(result);
    };

    child.stderr?.setEncoding("utf-8");
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
      if (stderr.length > 100_000) stderr = stderr.slice(-100_000);
    });

    child.on("error", (err) => {
      finish({
        ok: false,
        timedOut,
        stderr: stderr + (err instanceof Error ? err.message : String(err)),
      });
    });

    child.on("close", (code) => {
      finish({ ok: code === 0, timedOut, stderr });
    });
  });
}

/**
 * 替换 package.json 中的 name、description 和 version
 * 模板结构异常时直接抛错，避免"信息没替换成功却提示创建成功"
 */
export async function replacePackageMeta(projectDir: string, meta: ProjectMeta): Promise<void> {
  const pkgPath = join(projectDir, "package.json");

  let raw: string;
  try {
    raw = await readFile(pkgPath, "utf-8");
  } catch {
    throw new CliError(
      "TEMPLATE_INVALID",
      `模板中缺少 package.json（${pkgPath}），下载的模板可能不完整`,
    );
  }

  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(raw);
  } catch {
    throw new CliError("TEMPLATE_INVALID", `模板中的 package.json 不是合法 JSON（${pkgPath}）`);
  }

  pkg.name = meta.name;
  pkg.description = meta.description;
  pkg.version = "0.1.0";

  await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
  logger.success("已更新 package.json 中的项目信息");
}

/**
 * 初始化 git 仓库并做首次提交
 * 每一步单独处理失败原因：未装 git / 未配置用户信息 的提示不一样
 */
export async function initGit(projectDir: string): Promise<GitResult> {
  const progress = startSpinner("正在初始化 Git 仓库...");
  const skipped: GitResult = { skipped: true, initialized: false, committed: false };

  try {
    execSync("git --version", { cwd: projectDir, stdio: "ignore" });
  } catch {
    progress.warn("未检测到 git 命令，已跳过 Git 初始化");
    return skipped;
  }

  try {
    execSync("git init", { cwd: projectDir, stdio: "ignore" });
  } catch (err) {
    progress.warn(`Git 初始化失败，已跳过：${lastErrorLine(err)}`);
    return skipped;
  }

  try {
    execSync("git add -A", { cwd: projectDir, stdio: "ignore" });
    execSync('git commit -m "chore: init project from EasyBuild template"', {
      cwd: projectDir,
      stdio: "ignore",
    });
    progress.succeed("Git 仓库初始化完成");
    return { skipped: false, initialized: true, committed: true };
  } catch (err) {
    progress.warn("Git 仓库已创建，但首次提交失败");
    logger.info(`原因：${lastErrorLine(err)}`);
    logger.info("通常是未配置 Git 用户信息，配置后可在项目目录执行:");
    print(chalk.cyan('    git config user.name "你的名字" && git config user.email "you@example.com"'));
    print(chalk.cyan('    git add -A && git commit -m "chore: init project"'));
    return { skipped: false, initialized: true, committed: false };
  }
}

/**
 * 安装项目依赖
 * @returns 是否安装成功；失败时已打印原因与手动命令
 */
export async function installDeps(projectDir: string, pm: PackageManager): Promise<boolean> {
  const commands: Record<PackageManager, string> = {
    yarn: "yarn install",
    pnpm: "pnpm install",
    npm: "npm install",
  };
  const command = commands[pm];
  const timeout = installTimeout();

  const progress = startSpinner(`正在使用 ${pm} 安装依赖（可能需要几分钟）...`);
  const result = await runCommand(command, projectDir, timeout);

  if (result.ok) {
    progress.succeed("依赖安装完成");
    return true;
  }

  progress.fail("依赖安装失败");

  if (result.timedOut) {
    logger.warn(`安装超过 ${formatDuration(timeout)}，已终止安装进程`);
  } else {
    const tail = stderrTail(result.stderr, 8);
    if (tail.length > 0) {
      print(chalk.gray(`  安装日志（最后 ${tail.length} 行）:`));
      for (const line of tail) print(chalk.gray(`    ${line}`));
    }
  }

  // 手动重试命令由调用方在收尾提示里统一给出
  return false;
}
