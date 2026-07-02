import { defineCliConfig } from "sanity/cli";

// Project: XtraPoint Schools. Used by the `sanity` CLI (dev/deploy/exec).
export default defineCliConfig({
  api: {
    projectId: "xjhhxbqk",
    dataset: "production",
  },
  // Hosted Studio at https://xtrapoint.sanity.studio (avoids the deploy prompt).
  studioHost: "xtrapoint",
});
