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
        '.dark .mobile-card': {
          'background': 'var(--color-neutral-800)',
          'border-radius': '14px',
          'box-shadow': '0 1px 3px 0 rgba(0, 0, 0, 0.3)',
          'overflow': 'hidden',
          'border-color': 'var(--color-neutral-700)'
        },
        '.dark .mobile-card-section': {
          'padding': '16px'
        },
        '.dark .mobile-card-divider': {
          'height': '1px',
          'background-color': 'var(--color-neutral-700)',
          'margin': '0 16px'
        },
        '.dark .mobile-list': {
          'background': 'var(--color-neutral-800)',
          'border-radius': '14px',
          'overflow': 'hidden',
          'box-shadow': '0 1px 3px 0 rgba(0, 0, 0, 0.3)',
          'border-color': 'var(--color-neutral-700)'
        },
        '.dark .mobile-list-item': {
          'display': 'flex',
          'align-items': 'center',
          'padding': '16px',
          'border-bottom': '1px solid var(--color-neutral-700)',
          'cursor': 'pointer',
          'color': 'var(--color-foreground)'
        },
        '.dark .mobile-list-item:last-child': {
          'border-bottom': 'none'
        },
        '.dark .mobile-list-item:active': {
          'background-color': 'var(--color-neutral-700)'
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
        '.dark .mobile-btn': {
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
        '.dark .mobile-btn-primary': {
          'background-color': '#6d28d9',
          'color': 'white'
        },
        '.mobile-btn-secondary': {
          'background-color': '#f1f5f9',
          'color': '#475569'
        },
        '.dark .mobile-btn-secondary': {
          'background-color': 'var(--color-neutral-700)',
          'color': 'var(--color-neutral-200)'
        },
        '.mobile-input': {
          'width': '100%',
          'padding': '14px 16px',
          'border': '1px solid #cbd5e1',
          'border-radius': '12px',
          'font-size': '16px',
          'background-color': 'white',
          'transition': 'border-color 0.2s ease',
          'color': '#0f172a'
        },
        '.dark .mobile-input': {
          'width': '100%',
          'padding': '14px 16px',
          'border': '1px solid var(--color-neutral-600)',
          'border-radius': '12px',
          'font-size': '16px',
          'background-color': 'var(--color-neutral-800)',
          'transition': 'border-color 0.2s ease',
          'color': 'var(--color-foreground)'
        },
        '.mobile-input:focus': {
          'outline': 'none',
          'border-color': '#7c3aed',
          'box-shadow': '0 0 0 3px rgba(124, 58, 237, 0.2)'
        },
        '.dark .mobile-input:focus': {
          'outline': 'none',
          'border-color': '#8b5cf6',
          'box-shadow': '0 0 0 3px rgba(139, 92, 246, 0.3)'
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
        '.dark .mobile-tab-bar': {
          'position': 'fixed',
          'bottom': '0',
          'left': '0',
          'right': '0',
          'height': '80px',
          'background': 'var(--color-neutral-800)',
          'border-top': '1px solid var(--color-neutral-700)',
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
          'text-align': 'center',
          'color': '#64748b'
        },
        '.dark .mobile-tab-item': {
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
          'text-align': 'center',
          'color': 'var(--color-neutral-400)'
        },
        '.mobile-tab-item.active': {
          'color': '#7c3aed'
        },
        '.dark .mobile-tab-item.active': {
          'color': '#a78bfa'
        },
        '.mobile-navbar': {
          'position': 'fixed',
          'bottom': '0',
          'left': '0',
          'right': '0',
          'height': '5rem',
          'background': 'white',
          'border-top': '1px solid #e2e8f0',
          'display': 'flex',
          'justify-content': 'space-around',
          'align-items': 'center',
          'z-index': '50',
          'padding': '0.5rem 0',
          'color': '#0f172a'
        },
        '.dark .mobile-navbar': {
          'position': 'fixed',
          'bottom': '0',
          'left': '0',
          'right': '0',
          'height': '5rem',
          'background': 'var(--color-neutral-800)',
          'border-top': '1px solid var(--color-neutral-700)',
          'display': 'flex',
          'justify-content': 'space-around',
          'align-items': 'center',
          'z-index': '50',
          'padding': '0.5rem 0',
          'color': 'var(--color-foreground)'
        },
        '.mobile-nav-item': {
          'display': 'flex',
          'flex-direction': 'column',
          'align-items': 'center',
          'justify-content': 'center',
          'gap': '0.25rem',
          'padding': '0.5rem',
          'border-radius': 'var(--radius-lg)',
          'cursor': 'pointer',
          'transition': 'all 0.2s ease',
          'flex': '1',
          'max-width': '80px',
          'color': '#64748b'
        },
        '.dark .mobile-nav-item': {
          'display': 'flex',
          'flex-direction': 'column',
          'align-items': 'center',
          'justify-content': 'center',
          'gap': '0.25rem',
          'padding': '0.5rem',
          'border-radius': 'var(--radius-lg)',
          'cursor': 'pointer',
          'transition': 'all 0.2s ease',
          'flex': '1',
          'max-width': '80px',
          'color': 'var(--color-neutral-400)'
        },
        '.mobile-nav-item.active': {
          'color': 'var(--color-primary-600)',
          'background-color': 'var(--color-primary-50)'
        },
        '.dark .mobile-nav-item.active': {
          'color': '#a78bfa',
          'background-color': 'rgba(139, 92, 246, 0.15)'
        },
        '.mobile-sheet': {
          'position': 'fixed',
          'bottom': '0',
          'left': '0',
          'right': '0',
          'background': 'white',
          'border-top-left-radius': 'var(--radius-2xl)',
          'border-top-right-radius': 'var(--radius-2xl)',
          'box-shadow': '0 -10px 30px rgba(0, 0, 0, 0.1)',
          'z-index': '1000',
          'transform': 'translateY(100%)',
          'transition': 'transform 0.3s ease',
          'color': '#0f172a'
        },
        '.dark .mobile-sheet': {
          'position': 'fixed',
          'bottom': '0',
          'left': '0',
          'right': '0',
          'background': 'var(--color-neutral-800)',
          'border-top-left-radius': 'var(--radius-2xl)',
          'border-top-right-radius': 'var(--radius-2xl)',
          'box-shadow': '0 -10px 30px rgba(0, 0, 0, 0.5)',
          'z-index': '1000',
          'transform': 'translateY(100%)',
          'transition': 'transform 0.3s ease',
          'color': 'var(--color-foreground)'
        },
        '.mobile-action-sheet': {
          'background': 'white',
          'border-top-left-radius': 'var(--radius-2xl)',
          'border-top-right-radius': 'var(--radius-2xl)',
          'padding': '1rem',
          'color': '#0f172a'
        },
        '.dark .mobile-action-sheet': {
          'background': 'var(--color-neutral-800)',
          'border-top-left-radius': 'var(--radius-2xl)',
          'border-top-right-radius': 'var(--radius-2xl)',
          'padding': '1rem',
          'color': 'var(--color-foreground)'
        },
        '.mobile-action-sheet-item': {
          'padding': '1rem',
          'border-bottom': '1px solid var(--color-neutral-100)',
          'text-align': 'center',
          'font-weight': '500',
          'cursor': 'pointer',
          'color': '#0f172a'
        },
        '.dark .mobile-action-sheet-item': {
          'padding': '1rem',
          'border-bottom': '1px solid var(--color-neutral-700)',
          'text-align': 'center',
          'font-weight': '500',
          'cursor': 'pointer',
          'color': 'var(--color-foreground)'
        },
        '.mobile-search-bar': {
          'display': 'flex',
          'align-items': 'center',
          'gap': '0.5rem',
          'background': 'var(--color-neutral-100)',
          'border-radius': 'var(--radius-full)',
          'padding': '0.5rem 1rem'
        },
        '.dark .mobile-search-bar': {
          'display': 'flex',
          'align-items': 'center',
          'gap': '0.5rem',
          'background': 'var(--color-neutral-700)',
          'border-radius': 'var(--radius-full)',
          'padding': '0.5rem 1rem'
        },
        '.dark .mobile-search-input': {
          'flex': '1',
          'background': 'transparent',
          'border': 'none',
          'outline': 'none',
          'font-size': '0.875rem',
          'color': 'var(--color-foreground)'
        },
        '.dark .mobile-toolbar': {
          'position': 'fixed',
          'top': '1.5rem',
          'left': '0',
          'right': '0',
          'height': '3rem',
          'background': 'var(--color-neutral-800)',
          'z-index': '50',
          'display': 'flex',
          'align-items': 'center',
          'padding': '0 1rem',
          'border-bottom': '1px solid var(--color-neutral-700)'
        },
        '.dark .mobile-status-bar': {
          'position': 'fixed',
          'top': '0',
          'left': '0',
          'right': '0',
          'height': '1.5rem',
          'background': 'var(--color-neutral-900)',
          'z-index': '60',
          'display': 'none'
        },
        '.dark .mobile-action-sheet-item:last-child': {
          'border-bottom': 'none'
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