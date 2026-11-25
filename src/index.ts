#!/usr/bin/env node

import { Command } from "commander";
import inquirer from "inquirer";
import { resolve } from "node:path";
import { mkdir, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import chalk from "chalk";

import { downloadAndExtract, splitRepoRef } from "./helpers/download.js";
import { resolveLatestReleaseTag } from "./helpers/release.js";
import { replacePackageMeta, initGit, installDeps, type GitResult } from "./helpers/setup.js";
import { validateProjectName, checkDirExists } from "./helpers/validate.js";
import { logger } from "./helpers/logger.js";
import { emitJson, print, setJsonOutput, spinner } from "./helpers/output.js";
import { CliError, type CliErrorCode } from "./helpers/errors.js";
import { TEMPLATE_REPO, PACKAGE_MANAGERS, type PackageManager } from "./constants.js";

const DEFAULT_PROJECT_NAME = "my-easybuild-app";
const DEFAULT_DESCRIPTION = "A Next.js admin project powered by EasyBuild";

/** 模板版本来源，决定 --json 报告里的 template.source */
type TemplateSource = "latest-release" | "custom-ref" | "default-branch";

interface CliOptions {
  description?: string;
  repo: string;
  pm?: string;
  skipInstall?: boolean;
  skipGit?: boolean;
  yes?: boolean;
  json?: boolean;
}

interface Answers {
  projectName?: string;
  description?: string;
  packageManager?: PackageManager;
  initGit?: boolean;
  installDeps?: boolean;
}

/**
 * 从 package.json 读取版本号，避免在源码里再硬编码一份
 * dev (src/index.ts) 与发布产物 (dist/index.js) 都位于项目根目录下一级，故路径一致
 */
function readVersion(): string {
  try {
    const raw = readFileSync(new URL("../package.json", import.meta.url), "utf-8");
    return JSON.parse(raw).version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

const CLI_VERSION = readVersion();
const program = new Command();

program
  .name("easybuild-admin")
  .description("从 EasyBuild Admin 模板快速创建 Next.js 管理后台项目")
  .version(CLI_VERSION)
  .argument("[project-name]", "项目名称")
  .option("-d, --description <desc>", "项目描述")
  .option("--repo <repo>", "自定义模板仓库，可用 #分支或 tag 指定版本", TEMPLATE_REPO)
  .option("--pm <pm>", "包管理器：yarn / pnpm / npm")
  .option("--skip-install", "跳过依赖安装")
  .option("--skip-git", "跳过 Git 初始化")
  .option("-y, --yes", "全部使用默认值，不进行任何交互（CI / AI Agent）")
  .option("--json", "输出一行机器可读的 JSON 结果（隐含非交互，适合 AI Agent）")
  .action(async (argName: string | undefined, opts: CliOptions) => {
    const startedAt = Date.now();
    const json = Boolean(opts.json);
    const assumeDefaults = Boolean(opts.yes);
    setJsonOutput(json);

    if (!json) {
      print();
      print(chalk.bold.cyan("  🚀 EasyBuild Admin 项目脚手架"));
      print(chalk.gray("  基于 Next.js 16 + React 19 + Shadcn/ui 的管理后台模板"));
      print();
    }

    try {
      // ========== 参数校验 ==========
      // --json 面向自动化调用，隐含非交互
      const isInteractive = Boolean(process.stdin.isTTY) && !json;

      // 命令行直接给的项目名同样要校验，否则会绕过交互式校验写出非法目录/包名
      if (argName) {
        const valid = validateProjectName(argName);
        if (valid !== true) throw new CliError("INVALID_PROJECT_NAME", valid);
      }

      if (opts.pm && !(PACKAGE_MANAGERS as readonly string[]).includes(opts.pm)) {
        throw new CliError("INVALID_ARGS", `包管理器参数不合法："${opts.pm}"`, {
          hint: `可选值：${PACKAGE_MANAGERS.join(" / ")}`,
        });
      }

      // ========== 交互式收集参数 ==========
      // 参数已通过命令行给出的问题不再询问；--yes / --json 时全部走默认值
      const questions = [
        {
          type: "input",
          name: "projectName",
          message: "请输入项目名称:",
          default: DEFAULT_PROJECT_NAME,
          validate: validateProjectName,
          when: !argName && !assumeDefaults,
        },
        {
          type: "input",
          name: "description",
          message: "请输入项目描述:",
          default: DEFAULT_DESCRIPTION,
          when: !opts.description && !assumeDefaults,
        },
        {
          type: "list",
          name: "packageManager",
          message: "选择包管理器:",
          choices: PACKAGE_MANAGERS,
          default: "yarn",
          when: !opts.pm && !opts.skipInstall && !assumeDefaults,
        },
        {
          type: "confirm",
          name: "initGit",
          message: "是否初始化 Git 仓库?",
          default: true,
          when: !opts.skipGit && !assumeDefaults,
        },
        {
          type: "confirm",
          name: "installDeps",
          message: "是否立即安装依赖?",
          default: true,
          when: !opts.skipInstall && !assumeDefaults,
        },
      ];

      const pending = questions.filter((question) => question.when);

      if (pending.length > 0 && !isInteractive) {
        const reason = json ? "使用了 --json（不进行交互）" : "当前是非交互环境（stdin 不是 TTY）";
        throw new CliError(
          "NON_INTERACTIVE",
          `${reason}，但仍有问题需要询问；请补齐参数或加 -y`,
          {
            hint:
              'npx easybuild-admin my-app -d "我的管理后台" --pm yarn --skip-git --skip-install -y',
          },
        );
      }

      const answers: Answers = pending.length > 0 ? await inquirer.prompt(questions) : {};

      const projectName = argName || answers.projectName || DEFAULT_PROJECT_NAME;
      const description = opts.description || answers.description || DEFAULT_DESCRIPTION;
      const pm: PackageManager =
        (opts.pm as PackageManager | undefined) || answers.packageManager || "yarn";
      const shouldInitGit = opts.skipGit ? false : (answers.initGit ?? true);
      const shouldInstall = opts.skipInstall ? false : (answers.installDeps ?? true);

      // ========== 解析模板版本（默认拉取最新发布版）==========
      const { repo: templateRepo, ref: customRef } = splitRepoRef(opts.repo);
      let templateRef = customRef;
      let templateSource: TemplateSource = customRef ? "custom-ref" : "default-branch";

      if (templateRef) {
        logger.info(`模板版本: ${chalk.cyan(`${templateRepo}@${templateRef}`)}（自定义）`);
      } else {
        const versionSpinner = spinner("正在检查模板最新发布版本...");
        const latestTag = await resolveLatestReleaseTag(templateRepo);

        if (latestTag) {
          templateRef = latestTag;
          templateSource = "latest-release";
          versionSpinner.succeed(`模板版本: ${chalk.cyan(latestTag)}（最新发布版）`);
        } else {
          versionSpinner.warn("未能获取最新发布版本，将使用仓库默认分支");
        }
      }

      // ========== 校验目标目录 ==========
      const projectDir = resolve(process.cwd(), projectName);
      const exists = await checkDirExists(projectName);
      if (exists) {
        if (assumeDefaults || !isInteractive) {
          const reason = assumeDefaults ? "-y 模式" : "--json / 非交互模式";
          throw new CliError(
            "DIR_EXISTS",
            `目录 ${chalk.yellow(projectName)} 已存在，${reason}下不会自动覆盖`,
            { hint: "删除该目录或换一个项目名" },
          );
        }
        const { overwrite } = await inquirer.prompt([
          {
            type: "confirm",
            name: "overwrite",
            message: `目录 ${chalk.yellow(projectName)} 已存在，覆盖会先清空该目录内的所有文件，是否继续?`,
            default: false,
          },
        ]);
        if (!overwrite) {
          logger.info("已取消操作");
          process.exitCode = 0;
          return;
        }
        // 先彻底清空目录，避免上一个项目的残留文件混进新模板
        await rm(projectDir, { recursive: true, force: true });
        logger.info(`已清空目录 ${chalk.yellow(projectName)}`);
      }

      await mkdir(projectDir, { recursive: true });

      // ========== 下载模板 ==========
      await downloadAndExtract({
        repo: templateRepo,
        ref: templateRef,
        dest: projectDir,
      });

      // ========== 替换项目元信息 ==========
      await replacePackageMeta(projectDir, { name: projectName, description });

      // ========== Git 初始化 ==========
      let git: GitResult = { skipped: true, initialized: false, committed: false };
      if (shouldInitGit) {
        git = await initGit(projectDir);
      }

      // ========== 安装依赖 ==========
      let depsInstalled = false;
      if (shouldInstall) {
        depsInstalled = await installDeps(projectDir, pm);
      }

      // ========== 完成提示（人类可读）==========
      logger.blank();
      logger.success(chalk.bold("项目创建成功! 🎉"));
      logger.blank();
      print(chalk.gray("  进入项目目录:"));
      print(chalk.cyan(`    cd ${projectName}`));
      logger.blank();

      if (!shouldInstall || !depsInstalled) {
        print(chalk.gray(shouldInstall ? "  依赖未安装成功，可手动重试:" : "  安装依赖:"));
        print(chalk.cyan(`    ${pm} install`));
        logger.blank();
      }

      print(chalk.gray("  启动开发服务器:"));
      print(chalk.cyan(`    ${pm === "npm" ? "npm run" : pm} dev`));
      logger.blank();

      // ========== 结构化结果（--json 时 stdout 仅此一行）==========
      emitJson({
        ok: true,
        cliVersion: CLI_VERSION,
        project: { name: projectName, path: projectDir, description },
        template: { repo: templateRepo, ref: templateRef ?? null, source: templateSource },
        git,
        dependencies: { skipped: !shouldInstall, installed: depsInstalled, packageManager: pm },
        durationMs: Date.now() - startedAt,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code: CliErrorCode = err instanceof CliError ? err.code : "UNEXPECTED";

      logger.error(message);
      if (err instanceof CliError && err.hint) print(chalk.cyan(`  ${err.hint}`));

      emitJson({
        ok: false,
        cliVersion: CLI_VERSION,
        error: { code, message },
        durationMs: Date.now() - startedAt,
      });

      process.exitCode = 1;
    }
  });

program.parse();
