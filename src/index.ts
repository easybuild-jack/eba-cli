#!/usr/bin/env node

import { Command } from "commander";
import inquirer from "inquirer";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import chalk from "chalk";

import { downloadAndExtract } from "./helpers/download.js";
import { replacePackageMeta, initGit, installDeps } from "./helpers/setup.js";
import { validateProjectName, checkDirExists } from "./helpers/validate.js";
import { logger } from "./helpers/logger.js";
import { TEMPLATE_REPO, PACKAGE_MANAGERS } from "./constants.js";

const program = new Command();

program
  .name("easybuild-admin")
  .description("从 EasyBuild Admin 模板快速创建 Next.js 管理后台项目")
  .version("1.0.1")
  .argument("[project-name]", "项目名称")
  .option("-d, --description <desc>", "项目描述")
  .option("--repo <repo>", "自定义模板仓库 (owner/repo#branch)", TEMPLATE_REPO)
  .option("--pm <pm>", "包管理器 (yarn/pnpm/npm)")
  .option("--skip-install", "跳过依赖安装")
  .option("--skip-git", "跳过 Git 初始化")
  .action(async (argName: string | undefined, opts) => {
    console.log();
    console.log(chalk.bold.cyan("  🚀 EasyBuild Admin 项目脚手架"));
    console.log(chalk.gray("  基于 Next.js 15 + React 19 + Shadcn/ui 的管理后台模板"));
    console.log();

    try {
      // ========== 交互式收集参数 ==========
      const answers = await inquirer.prompt([
        {
          type: "input",
          name: "projectName",
          message: "请输入项目名称:",
          default: argName || "my-easybuild-app",
          validate: validateProjectName,
          when: !argName,
        },
        {
          type: "input",
          name: "description",
          message: "请输入项目描述:",
          default: "A Next.js admin project powered by EasyBuild",
          when: !opts.description,
        },
        {
          type: "list",
          name: "packageManager",
          message: "选择包管理器:",
          choices: PACKAGE_MANAGERS,
          default: "yarn",
          when: !opts.pm && !opts.skipInstall,
        },
        {
          type: "confirm",
          name: "initGit",
          message: "是否初始化 Git 仓库?",
          default: true,
          when: !opts.skipGit,
        },
        {
          type: "confirm",
          name: "installDeps",
          message: "是否立即安装依赖?",
          default: true,
          when: !opts.skipInstall,
        },
      ]);

      const projectName = argName || answers.projectName;
      const description = opts.description || answers.description;
      const pm = opts.pm || answers.packageManager || "yarn";
      const shouldInitGit = opts.skipGit ? false : (answers.initGit ?? true);
      const shouldInstall = opts.skipInstall ? false : (answers.installDeps ?? true);

      // ========== 校验目标目录 ==========
      const exists = await checkDirExists(projectName);
      if (exists) {
        const { overwrite } = await inquirer.prompt([
          {
            type: "confirm",
            name: "overwrite",
            message: `目录 ${chalk.yellow(projectName)} 已存在，是否覆盖?`,
            default: false,
          },
        ]);
        if (!overwrite) {
          logger.info("已取消操作");
          process.exit(0);
        }
      }

      const projectDir = resolve(process.cwd(), projectName);
      await mkdir(projectDir, { recursive: true });

      // ========== 下载模板 ==========
      await downloadAndExtract({
        repo: opts.repo,
        dest: projectDir,
      });

      // ========== 替换项目元信息 ==========
      await replacePackageMeta(projectDir, { name: projectName, description });

      // ========== Git 初始化 ==========
      if (shouldInitGit) {
        await initGit(projectDir);
      }

      // ========== 安装依赖 ==========
      if (shouldInstall) {
        await installDeps(projectDir, pm);
      }

      // ========== 完成提示 ==========
      logger.blank();
      logger.success(chalk.bold("项目创建成功! 🎉"));
      logger.blank();
      console.log(chalk.gray("  进入项目目录:"));
      console.log(chalk.cyan(`    cd ${projectName}`));
      logger.blank();

      if (!shouldInstall) {
        console.log(chalk.gray("  安装依赖:"));
        console.log(chalk.cyan(`    ${pm} install`));
        logger.blank();
      }

      console.log(chalk.gray("  启动开发服务器:"));
      console.log(chalk.cyan(`    ${pm === "npm" ? "npm run" : pm} dev`));
      logger.blank();
    } catch (err: any) {
      logger.error(err.message || "创建项目时发生未知错误");
      process.exit(1);
    }
  });

program.parse();
