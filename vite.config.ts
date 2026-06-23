import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
import { visualizer } from "rollup-plugin-visualizer";

const plugins = [
  react(),
  tailwindcss(),
  jsxLocPlugin(),
  visualizer({
    open: false,
    filename: "dist/stats.html",
    gzipSize: true,
    brotliSize: true,
  }),
];

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (!id.includes("node_modules")) return;

          // React adapters for heavy libs (@fullcalendar/react, @tiptap/react)
          // re-export React and are pulled in by the eager graph. Keep them in
          // the eager react chunk so the heavy editor/calendar chunks stay pure
          // and lazy (otherwise they get linked into the initial bundle).
          if (id.includes("@fullcalendar/react") || id.includes("@tiptap/react"))
            return "vendor-react";

          // Heavy, feature-specific libs — only reached via lazy pages, so these
          // chunks load on demand. Kept pure (their react adapters were routed to
          // vendor-react above, and the d3 family is left in vendor-other): mixing
          // those in links the chunk into the eager graph and defeats lazy-loading.
          if (id.includes("@tiptap") || id.includes("prosemirror")) return "vendor-editor";
          if (id.includes("@fullcalendar")) return "vendor-calendar";
          if (id.includes("recharts")) return "vendor-charts";

          // Always-eager vendor groups, peeled off the former 900kB vendor-react
          // and 750kB vendor-other catch-alls for parallel download + caching.
          if (id.includes("lucide-react")) return "vendor-icons";
          if (
            id.includes("framer-motion") ||
            id.includes("motion-dom") ||
            id.includes("motion-utils")
          )
            return "vendor-motion";
          if (id.includes("@radix-ui")) return "vendor-ui";
          if (id.includes("@trpc") || id.includes("@tanstack") || id.includes("superjson"))
            return "vendor-data";
          if (id.includes("react-hook-form") || id.includes("@hookform") || id.includes("zod"))
            return "vendor-form";
          if (id.includes("date-fns") || id.includes("clsx") || id.includes("tailwind-merge"))
            return "vendor-utils";

          // React core. Broad match (kept last) so any remaining react-* satellite
          // lands in the eager react chunk rather than fragmenting the graph.
          if (id.includes("react")) return "vendor-react";

          return "vendor-other";
        },
      },
    },
    chunkSizeWarningLimit: 1000,
    minify: "terser",
  } as any,
  server: {
    host: true,
    allowedHosts: [
      "localhost",
      "127.0.0.1",
      "*.vercel.app",
    ],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
