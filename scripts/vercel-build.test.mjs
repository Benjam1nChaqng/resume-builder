import { describe, expect, it } from "vitest";
import { vercelBuildScripts } from "./vercel-build.mjs";

describe("vercelBuildScripts", () => {
  it("migrates before a production build", () => {
    expect(vercelBuildScripts("production")).toEqual(["db:migrate", "build"]);
  });

  it.each(["preview", "development", undefined])(
    "does not migrate the %s environment",
    (environment) => {
      expect(vercelBuildScripts(environment)).toEqual(["build"]);
    },
  );
});
