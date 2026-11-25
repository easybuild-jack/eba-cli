/**
 * 解析仓库的最新正式发布版本 tag（GitHub Releases 的 latest，不含 prerelease / draft）
 *
 * 走 github.com/{repo}/releases/latest 的 302 重定向读取 tag，
 * 相比 GitHub API 不消耗 60 次/小时的匿名配额，网络可达性也与 degit 一致。
 * 仓库未发布任何 release 时返回 null，由调用方决定回退策略。
 */
const RELEASE_TIMEOUT = 8000;

/** 仅对 GitHub 的 owner/repo 形式做探测；完整 URL、GitLab 地址等直接回退默认分支 */
const REPO_PATTERN = /^[\w.-]+\/[\w.-]+$/;

export async function resolveLatestReleaseTag(repo: string): Promise<string | null> {
  if (!REPO_PATTERN.test(repo)) return null;

  try {
    const res = await fetch(`https://github.com/${repo}/releases/latest`, {
      redirect: "manual",
      signal: AbortSignal.timeout(RELEASE_TIMEOUT),
      headers: { "User-Agent": "easybuild-admin-cli" },
    });

    if (res.status !== 302) return null;

    const location = res.headers.get("location") ?? "";
    const matched = location.match(/\/releases\/tag\/(.+)$/);
    return matched ? decodeURIComponent(matched[1]) : null;
  } catch {
    return null;
  }
}
