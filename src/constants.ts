export const TEMPLATE_REPO = "jackliuyijun/easybuild-admin";

export const PACKAGE_MANAGERS = ["yarn", "pnpm", "npm"] as const;
export type PackageManager = (typeof PACKAGE_MANAGERS)[number];
