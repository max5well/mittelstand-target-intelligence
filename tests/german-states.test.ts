import { describe, expect, it } from "vitest";
import { registerCourtsForStates } from "@/lib/german-states";

describe("German state filters", () => {
  it("maps states to OpenRegister-supported court values", () => {
    expect(registerCourtsForStates(["Berlin"])).toEqual([
      "Berlin (Charlottenburg)",
    ]);
    expect(registerCourtsForStates(["Bayern"])).toContain("München");
  });
});
