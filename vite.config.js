import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Must match the repo name exactly (including trailing slash)
  base: "/chain-stories-/",
});
