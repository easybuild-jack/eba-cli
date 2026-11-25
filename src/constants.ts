export const TEMPLATE_REPO = "easybuild-jack/easybuild-admin-front";

export const PACKAGE_MANAGERS = ["yarn", "pnpm", "npm"] as const;
export type PackageManager = (typeof PACKAGE_MANAGERS)[number];
