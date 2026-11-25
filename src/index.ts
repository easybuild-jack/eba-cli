#!/usr/bin/env node

import { Command, Option } from "commander";
import inquirer from "inquirer";
import ora from "ora";
import { resolve } from "node:path";
import { mkdir, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import chalk from "chalk";

import { downloadAndExtract, splitRepoRef } from "./helpers/download.js";
import { resolveLatestReleaseTag } from "./helpers/release.js";
import { replacePackageMeta, initGit, installDeps } from "./helpers/setup.js";
import { validateProjectName, checkDirExists } from "./helpers/validate.js";
import { logger } from "./helpers/logger.js";
import { TEMPLATE_REPO, PACKAGE_MANAGERS, type PackageManager } from "./constants.js";

const DEFAULT_PROJECT_NAME = "my-easybuild-app";
const DEFAULT_DESCRIPTION = "A Next.js admin project powered by EasyBuild";

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

interface Answers {
  projectName?: string;
  description?: string;
  packageManager?: PackageManager;
  initGit?: boolean;
  installDeps?: boolean;
}

const program = new Command();

/**
 * 用于中止流程的哨兵异常。
 * 不用 process.exit()：在 Windows 上，输出通道仍有未刷新的写入时强制退出
 * 会触发 libuv 断言（Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)）而崩溃。
 */
class CliAbort extends Error {}

/** 打印错误信息（可选一行提示），随后以退出码 1 结束 */
function failAndExit(message: string, hint?: string): never {
  logger.error(message);
  if (hint) console.log(chalk.cyan(`  ${hint}`));
  throw new CliAbort(message);
}

program
  .name("easybuild-admin")
  .description("从 EasyBuild Admin 模板快速创建 Next.js 管理后台项目")
  .version(readVersion())
  .argument("[project-name]", "项目名称")
  .option("-d, --description <desc>", "项目描述")
  .option("--repo <repo>", "自定义模板仓库，可用 #分支或 tag 指定版本", TEMPLATE_REPO)
  .addOption(new Option("--pm <pm>", "包管理器").choices([...PACKAGE_MANAGERS]))
  .option("--skip-install", "跳过依赖安装")
  .option("--skip-git", "跳过 Git 初始化")
  .option("-y, --yes", "全部使用默认值，不进行任何交互（适用于 CI）")
  .action(async (argName: string | undefined, opts) => {
    console.log();
    console.log(chalk.bold.cyan("  🚀 EasyBuild Admin 项目脚手架"));
    console.log(chalk.gray("  基于 Next.js 16 + React 19 + Shadcn/ui 的管理后台模板"));
    console.log();

    try {
      // ========== 交互式收集参数 ==========
      // 参数已通过命令行给出的问题不再询问；--yes 时全部走默认值
      const assumeDefaults = Boolean(opts.yes);
      const isInteractive = Boolean(process.stdin.isTTY);

      // 命令行直接给的项目名同样要校验，否则会绕过交互式校验写出非法目录/包名
      if (argName) {
        const valid = validateProjectName(argName);
        if (valid !== true) failAndExit(valid);
      }

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
        failAndExit(
          "当前是非交互环境（stdin 不是 TTY），无法弹出交互式问题",
          'npx easybuild-admin my-app -d "我的管理后台" --pm yarn --skip-git --skip-install -y',
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

      if (templateRef) {
        logger.info(`模板版本: ${chalk.cyan(`${templateRepo}@${templateRef}`)}（自定义）`);
      } else {
        const versionSpinner = ora("正在检查模板最新发布版本...").start();
        const latestTag = await resolveLatestReleaseTag(templateRepo);

        if (latestTag) {
          templateRef = latestTag;
          versionSpinner.succeed(`模板版本: ${chalk.cyan(latestTag)}（最新发布版）`);
        } else {
          versionSpinner.warn("未能获取最新发布版本，将使用仓库默认分支");
        }
      }

      // ========== 校验目标目录 ==========
      const projectDir = resolve(process.cwd(), projectName);
      const exists = await checkDirExists(projectName);
      if (exists) {
        if (assumeDefaults) {
          failAndExit(
            `目录 ${chalk.yellow(projectName)} 已存在，-y 模式下不会自动覆盖，请先删除或换一个项目名`,
          );
        }
        if (!isInteractive) {
          failAndExit(`目录 ${chalk.yellow(projectName)} 已存在，非交互环境下无法确认是否覆盖`);
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
      if (shouldInitGit) {
        await initGit(projectDir);
      }

      // ========== 安装依赖 ==========
      let depsInstalled = false;
      if (shouldInstall) {
        depsInstalled = await installDeps(projectDir, pm);
      }

      // ========== 完成提示 ==========
      logger.blank();
      logger.success(chalk.bold("项目创建成功! 🎉"));
      logger.blank();
      console.log(chalk.gray("  进入项目目录:"));
      console.log(chalk.cyan(`    cd ${projectName}`));
      logger.blank();

      if (!shouldInstall || !depsInstalled) {
        console.log(chalk.gray(shouldInstall ? "  依赖未安装成功，可手动重试:" : "  安装依赖:"));
        console.log(chalk.cyan(`    ${pm} install`));
        logger.blank();
      }

      console.log(chalk.gray("  启动开发服务器:"));
      console.log(chalk.cyan(`    ${pm === "npm" ? "npm run" : pm} dev`));
      logger.blank();
    } catch (err) {
      // CliAbort 的错误信息已在 failAndExit 里打印过，这里只设置退出码
      if (!(err instanceof CliAbort)) {
        logger.error(err instanceof Error ? err.message : String(err));
      }
      process.exitCode = 1;
    }
  });

program.parse();
