import type { Config } from "tailwindcss";

/**
 * GuruPRO Design System Configuration
 *
 * IMPORTANT: This project uses Tailwind CSS v4 with CSS-based configuration.
 * The actual theme is defined in `app/globals.css` via the `@theme` directive.
 *
 * This file exists for IDE autocompletion and documentation purposes only.
 * To modify theme values, edit `app/globals.css` — NOT this file.
 *
 * @see https://tailwindcss.com/docs/upgrade-guide
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
};

export default config;
