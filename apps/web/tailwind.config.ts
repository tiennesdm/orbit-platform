import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ORBIT design tokens — warm + calm + premium
        bg: {
          page: '#EEEAE0',
          elevated: '#FAF8F4',
          card: '#FFFFFF',
          subtle: '#F5F2EC',
          cream: '#FAF6EE',
        },
        text: {
          primary: '#0F0F12',
          secondary: '#6B6862',
          tertiary: '#A09C95',
        },
        accent: {
          DEFAULT: '#4338CA',
          hover: '#3730A3',
          soft: '#EEF0FE',
          light: '#818CF8',
        },
        ai: {
          DEFAULT: '#7C3AED',
          soft: '#F5F0FE',
          light: '#C4B5FD',
        },
        amber: '#F59E0B',
        success: '#059669',
        warning: '#D97706',
        danger: '#DC2626',
        live: '#FF3B5C',
        hairline: 'rgba(15, 15, 18, 0.08)',
        hairlineStrong: 'rgba(15, 15, 18, 0.14)',
      },
      fontFamily: {
        display: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', 'Inter', 'system-ui', 'sans-serif'],
        body: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"SF Mono"', 'Monaco', '"Cascadia Code"', 'monospace'],
      },
      fontSize: {
        '2xs': ['11px', { lineHeight: '1.4' }],
      },
      borderRadius: {
        xs: '6px',
        sm: '10px',
        md: '14px',
        lg: '20px',
        xl: '28px',
      },
      boxShadow: {
        phone: '0 30px 60px rgba(15, 15, 18, 0.15), 0 0 0 1px rgba(15, 15, 18, 0.04)',
        glass: '0 8px 24px rgba(15, 15, 18, 0.08), 0 2px 8px rgba(15, 15, 18, 0.04)',
      },
      backdropBlur: {
        glass: '24px',
      },
    },
  },
  plugins: [],
};

export default config;
