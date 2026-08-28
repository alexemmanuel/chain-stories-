import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // GitHub project pages example: base: "/chain-stories/"
  base: "/",
});
