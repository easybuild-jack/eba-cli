import assert from "node:assert/strict";
import { test } from "node:test";

import { splitRepoRef } from "../src/helpers/download.js";
import { validateProjectName } from "../src/helpers/validate.js";

test("splitRepoRef 支持 owner/repo 与 #ref 形式", () => {
  assert.deepEqual(splitRepoRef("owner/repo"), { repo: "owner/repo" });
  assert.deepEqual(splitRepoRef("owner/repo#v1.0.0"), { repo: "owner/repo", ref: "v1.0.0" });
  assert.deepEqual(splitRepoRef("owner/repo#feature/x"), { repo: "owner/repo", ref: "feature/x" });
  assert.equal(splitRepoRef("owner/repo#").ref, undefined);
});

test("validateProjectName 接受合法包名", () => {
  for (const name of ["my-app", "app2", "a", "my.app", "@scope/app"]) {
    assert.equal(validateProjectName(name), true, `${name} 应该合法`);
  }
});

test("validateProjectName 拒绝非法名称", () => {
  for (const name of ["", "MyApp", "my app", "../evil", "a/b", "中文名", "app!", ".hidden"]) {
    assert.notEqual(validateProjectName(name), true, `${name} 应该被拒绝`);
  }
  assert.notEqual(validateProjectName("a".repeat(215)), true);
});
