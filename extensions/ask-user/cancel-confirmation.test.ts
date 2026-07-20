import { describe, expect, it } from "vitest";
import { askCancelDecisionForSelection } from "./index.js";

describe("ask_user cancellation confirmation", () => {
   it("defaults Enter to confirming cancellation", () => {
      expect(askCancelDecisionForSelection(0)).toBe("cancel");
   });

   it("keeps answering when the safe second action is selected", () => {
      expect(askCancelDecisionForSelection(1)).toBe("keep-answering");
   });
});
