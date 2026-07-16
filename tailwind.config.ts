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
  plugins: [
    // Plugin untuk menambahkan utility kelas mobile
    function ({ addUtilities }: { addUtilities: Function }) {
      const newUtilities = {
        '.mobile-card': {
          'background': 'white',
          'border-radius': '14px',
          'box-shadow': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
          'overflow': 'hidden'
        },
        '.mobile-card-section': {
          'padding': '16px'
        },
        '.mobile-card-divider': {
          'height': '1px',
          'background-color': '#e2e8f0',
          'margin': '0 16px'
        },
        '.mobile-list': {
          'background': 'white',
          'border-radius': '14px',
          'overflow': 'hidden',
          'box-shadow': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)'
        },
        '.mobile-list-item': {
          'display': 'flex',
          'align-items': 'center',
          'padding': '16px',
          'border-bottom': '1px solid #f1f5f9',
          'cursor': 'pointer'
        },
        '.mobile-list-item:last-child': {
          'border-bottom': 'none'
        },
        '.mobile-list-item:active': {
          'background-color': '#f8fafc'
        },
        '.mobile-btn': {
          'display': 'flex',
          'align-items': 'center',
          'justify-content': 'center',
          'padding': '14px 20px',
          'border-radius': '12px',
          'font-weight': '600',
          'text-align': 'center',
          'cursor': 'pointer',
          'border': 'none',
          'transition': 'all 0.2s ease',
          'user-select': 'none'
        },
        '.mobile-btn:active': {
          'transform': 'scale(0.98)',
          'opacity': '0.8'
        },
        '.mobile-btn-primary': {
          'background-color': '#7C3AED',
          'color': 'white'
        },
        '.mobile-btn-secondary': {
          'background-color': '#f1f5f9',
          'color': '#475569'
        },
        '.mobile-input': {
          'width': '100%',
          'padding': '14px 16px',
          'border': '1px solid #cbd5e1',
          'border-radius': '12px',
          'font-size': '16px',
          'background-color': 'white',
          'transition': 'border-color 0.2s ease'
        },
        '.mobile-input:focus': {
          'outline': 'none',
          'border-color': '#7c3aed',
          'box-shadow': '0 0 0 3px rgba(124, 58, 237, 0.2)'
        },
        '.mobile-tab-bar': {
          'position': 'fixed',
          'bottom': '0',
          'left': '0',
          'right': '0',
          'height': '80px',
          'background': 'white',
          'border-top': '1px solid #e2e8f0',
          'display': 'flex',
          'justify-content': 'space-around',
          'align-items': 'center',
          'padding-bottom': 'env(safe-area-inset-bottom)',
          'z-index': '50'
        },
        '.mobile-tab-item': {
          'display': 'flex',
          'flex-direction': 'column',
          'align-items': 'center',
          'justify-content': 'center',
          'gap': '4px',
          'padding': '8px 0',
          'flex': '1',
          'max-width': '80px',
          'cursor': 'pointer',
          'transition': 'color 0.2s ease',
          'text-align': 'center'
        },
        '.mobile-tab-item.active': {
          'color': '#7c3aed'
        },
        '.h-minus-navbar': {
          'height': 'calc(100dvh - 5rem)'
        },
        '.pt-navbar': {
          'padding-top': '5rem'
        },
        '.pb-navbar': {
          'padding-bottom': '5rem'
        },
        '.safe-top': {
          'padding-top': 'env(safe-area-inset-top)'
        },
        '.safe-bottom': {
          'padding-bottom': 'env(safe-area-inset-bottom)'
        },
        '.safe-left': {
          'padding-left': 'env(safe-area-inset-left)'
        },
        '.safe-right': {
          'padding-right': 'env(safe-area-inset-right)'
        }
      };
      
      addUtilities(newUtilities, ['responsive', 'hover']);
    }
  ]
};

export default config;