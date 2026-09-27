import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { describeTool } from "../src/events.ts";

const WS_POSIX = "/home/user/projects/myapp";
const WS_WIN = "C:\\Users\\alice\\projects\\myapp";

describe("describeTool – read_file", () => {
  it("returns 'Read <relative path>'", () => {
    const label = describeTool("read_file", { path: `${WS_POSIX}/src/index.ts` }, WS_POSIX);
    assert.equal(label, "Read src/index.ts");
  });

  it("makes Windows paths relative", () => {
    const label = describeTool("read_file", { path: `${WS_WIN}\\src\\main.ts` }, WS_WIN);
    assert.equal(label, "Read src/main.ts");
  });

  it("returns absolute path when it is outside the workspace", () => {
    const label = describeTool("read_file", { path: "/etc/hosts" }, WS_POSIX);
    assert.equal(label, "Read /etc/hosts");
  });
});

describe("describeTool – write_file", () => {
  it("returns 'Wrote <relative path>'", () => {
    const label = describeTool("write_file", { path: `${WS_POSIX}/dist/bundle.js` }, WS_POSIX);
    assert.equal(label, "Wrote dist/bundle.js");
  });

  it("also handles write_to_file alias", () => {
    const label = describeTool("write_to_file", { path: `${WS_POSIX}/out.txt` }, WS_POSIX);
    assert.equal(label, "Wrote out.txt");
  });
});

describe("describeTool – apply_diff", () => {
  it("returns 'Edited <relative path>'", () => {
    const label = describeTool("apply_diff", { path: `${WS_POSIX}/src/app.ts` }, WS_POSIX);
    assert.equal(label, "Edited src/app.ts");
  });

  it("also handles edit_file alias", () => {
    const label = describeTool("edit_file", { path: `${WS_POSIX}/src/app.ts` }, WS_POSIX);
    assert.equal(label, "Edited src/app.ts");
  });
});

describe("describeTool – execute_command", () => {
  it("returns 'Ran <command>'", () => {
    const label = describeTool("execute_command", { command: "npm install" }, WS_POSIX);
    assert.equal(label, "Ran npm install");
  });

  it("truncates long commands to about 60 chars with ellipsis", () => {
    // Longer than the 60-char threshold used by describeTool's short() helper.
    const longCmd = "npm run build && npm test && npm run lint && npm run format && echo done";
    const label = describeTool("execute_command", { command: longCmd }, WS_POSIX);
    assert.ok(label.startsWith("Ran "));
    // The raw command (without 'Ran ') should be truncated to ≤60 chars (59 + ellipsis).
    const cmdPart = label.slice(4);
    assert.ok(cmdPart.endsWith("…"), `expected ellipsis, got: "${cmdPart}"`);
    assert.ok(cmdPart.length <= 61, `truncated part too long: ${cmdPart.length}`);
  });

  it("does not truncate short commands", () => {
    const shortCmd = "node server.js";
    const label = describeTool("execute_command", { command: shortCmd }, WS_POSIX);
    assert.equal(label, `Ran ${shortCmd}`);
  });
});

describe("describeTool – workspace path handling", () => {
  it("workspace with trailing slash is handled correctly", () => {
    const label = describeTool("read_file", { path: `${WS_POSIX}/README.md` }, `${WS_POSIX}/`);
    assert.equal(label, "Read README.md");
  });

  it("Windows workspace path normalisation", () => {
    const label = describeTool(
      "write_file",
      { path: `${WS_WIN}\\lib\\helpers.ts` },
      WS_WIN,
    );
    assert.equal(label, "Wrote lib/helpers.ts");
  });

  it("mixed-case workspace prefix is stripped (case-insensitive)", () => {
    const label = describeTool(
      "read_file",
      { path: "/Home/User/Projects/MyApp/src/foo.ts" },
      "/home/user/projects/myapp",
    );
    assert.equal(label, "Read src/foo.ts");
  });
});
