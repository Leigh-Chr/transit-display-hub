import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
	base: "/transit-display-hub/",
	server: {
		port: 3040,
		strictPort: true,
	},
	preview: {
		port: 3040,
		strictPort: true,
	},
	plugins: [tailwindcss()],
	build: {
		minify: "esbuild",
		cssCodeSplit: false,
		target: "esnext",
	},
});
