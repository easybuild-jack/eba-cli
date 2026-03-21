import degit from "degit";
import ora from "ora";
import { logger } from "./logger.js";

interface DownloadOptions {
  repo: string;   // 格式: "owner/repo" 或 "owner/repo#branch"
  dest: string;
}

/**
 * 使用 degit 从 GitHub 公开仓库下载模板到目标目录
 * 不携带 .git 历史，无需额外清理
 */
export async function downloadAndExtract(options: DownloadOptions): Promise<void> {
  const { repo, dest } = options;

  const spinner = ora(`正在从 GitHub 下载模板 (${repo})...`).start();

  try {
    const emitter = degit(repo, { cache: false, force: true });

    emitter.on("info", (info) => {
      spinner.text = info.message;
    });

    await emitter.clone(dest);

    spinner.succeed("模板下载完成");
  } catch (err: any) {
    spinner.fail("模板下载失败");
    logger.error(err.message);
    throw err;
  }
}
