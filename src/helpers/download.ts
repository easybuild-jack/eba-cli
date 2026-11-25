import degit from "degit";
import ora from "ora";

interface DownloadOptions {
  repo: string;   // 格式: "owner/repo"
  ref?: string;   // 分支、tag 或 commit，缺省时拉仓库默认分支
  dest: string;
}

/**
 * 拆分 "owner/repo#ref" 形式的仓库参数
 */
export function splitRepoRef(option: string): { repo: string; ref?: string } {
  const index = option.indexOf("#");
  if (index === -1) return { repo: option };
  return { repo: option.slice(0, index), ref: option.slice(index + 1) || undefined };
}

/**
 * 把 degit 的英文错误（带 code）翻译成可执行的中文提示
 * degit 的原始信息如 "could not find commit hash for HEAD"，对使用者没有指导意义
 */
function describeDownloadError(err: unknown, label: string, ref?: string): string {
  const detail = err instanceof Error ? err.message : String(err);
  const code = (err as { code?: string }).code;

  switch (code) {
    case "MISSING_REF":
    case "BAD_REF":
      return ref
        ? `找不到模板版本 "${ref}"：${label}。请检查仓库地址与分支/tag 是否存在`
        : `找不到模板的默认分支：${label}。仓库可能不存在或已设为私有`;
    case "BAD_SRC":
      return `仓库地址格式不正确：${label}。应为 owner/repo 或 owner/repo#分支或tag`;
    case "UNSUPPORTED_HOST":
      return `不支持的仓库主机：${label}。目前仅支持 GitHub 公开仓库`;
    case "COULD_NOT_FETCH":
    case "COULD_NOT_DOWNLOAD":
      return `无法下载模板 ${label}，请检查网络连接并确认仓库存在且可公开访问（原始错误：${detail}）`;
    case "DEST_NOT_EMPTY":
      return `目标目录非空，无法写入模板（${label}）`;
    default:
      return `模板下载失败（${label}）：${detail}`;
  }
}

/**
 * 使用 degit 从 GitHub 公开仓库下载模板到目标目录
 * 不携带 .git 历史，无需额外清理
 */
export async function downloadAndExtract(options: DownloadOptions): Promise<void> {
  const { repo, ref, dest } = options;

  const source = ref ? `${repo}#${ref}` : repo;
  const label = ref ? `${repo}@${ref}` : repo;

  const spinner = ora(`正在从 GitHub 下载模板 (${label})...`).start();

  try {
    const emitter = degit(source, { cache: false, force: true });

    emitter.on("info", (info) => {
      spinner.text = info.message;
    });

    await emitter.clone(dest);

    spinner.succeed("模板下载完成");
  } catch (err) {
    spinner.fail("模板下载失败");
    // 错误详情统一由调用方打印，这里只把原因翻译成人话
    throw new Error(describeDownloadError(err, label, ref), { cause: err });
  }
}
