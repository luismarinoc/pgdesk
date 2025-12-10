/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Semantic Backgrounds
                page: '#050505',       // Deepest black for main background
                surface: '#0A0F16',    // Slightly lighter for cards/sidebar
                'surface-highlight': '#121824', // Hover states

                // Semantic Text
                primary: '#EDEDED',    // High contrast text
                secondary: '#888888',  // Muted text
                tertiary: '#4A5568',   // Disabled/subtle text

                // Brand Colors
                brand: {
                    DEFAULT: '#3B82F6', // Electric Blue
                    hover: '#2563EB',
                    light: '#60A5FA',
                    dark: '#1D4ED8',
                    glow: 'rgba(59, 130, 246, 0.5)'
                },

                // Status Colors (Desaturated/Premium)
                success: '#10B981',
                warning: '#F59E0B',
                danger: '#EF4444',
                info: '#3B82F6',
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                mono: ['Fira Code', 'monospace'],
            },
            letterSpacing: {
                tight: '-0.02em',
                normal: '0',
                wide: '0.025em',
                wider: '0.05em',
            },
            boxShadow: {
                'glow': '0 0 20px rgba(59, 130, 246, 0.15)',
                'glow-strong': '0 0 30px rgba(59, 130, 246, 0.3)',
                'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
            },
            backgroundImage: {
                'glass-gradient': 'linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0) 100%)',
            },
            backdropBlur: {
                xs: '2px',
            }
        },
    },
    plugins: [],
}
