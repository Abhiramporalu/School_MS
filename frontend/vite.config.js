import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
var vite_config_default = defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/recharts/")) return "charts";
          if (id.includes("/node_modules/d3-")) return "charts-vendor";
          if (id.includes("/node_modules/react/") || id.includes("/node_modules/react-dom/")) return "react-vendor";
        }
      }
    }
  },
  server: {
    proxy: { "/api": "http://localhost:4000" }
  }
});
export {
  vite_config_default as default
};
