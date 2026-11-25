import chalk from "chalk";

import { print } from "./output.js";

export const logger = {
  info: (msg: string) => print(`${chalk.cyan("ℹ")} ${msg}`),
  success: (msg: string) => print(`${chalk.green("✔")} ${msg}`),
  warn: (msg: string) => print(`${chalk.yellow("⚠")} ${msg}`),
  error: (msg: string) => print(`${chalk.red("✖")} ${msg}`),
  blank: () => print(),
};
