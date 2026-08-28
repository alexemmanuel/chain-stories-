import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // GitHub project pages: base: "/chain-stories/"
  // Custom domain or username.github.io root: base: "/"
  base: "/",
});
