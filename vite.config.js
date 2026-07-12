import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^leaflet-draw$/,
        replacement: fileURLToPath(new URL("./src/vendor/leafletDrawShim.js", import.meta.url)),
      },
    ],
  },
});
