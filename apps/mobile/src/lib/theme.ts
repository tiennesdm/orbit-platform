/**
 * ORBIT design tokens — shared between web and mobile
 * Source of truth: apps/web/tailwind.config.ts
 */

export const colors = {
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
    inverse: '#FFFFFF',
  },
  accent: {
    DEFAULT: '#4338CA',
    hover: '#3730A3',
    soft: '#EEF0FE',
    light: '#818CF8',
  },
  ai: {
    DEFAULT: '#7C3AED',
    hover: '#6D28D9',
    soft: '#F3EEFE',
  },
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  hairline: 'rgba(15,15,18,0.08)',
  hairlineStrong: 'rgba(15,15,18,0.14)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const typography = {
  fontFamily: {
    display: 'System',
    body: 'System',
    mono: 'Menlo',
  },
  size: {
    xs: 12,
    sm: 13,
    base: 15,
    md: 17,
    lg: 20,
    xl: 24,
    xxl: 32,
    xxxl: 48,
  },
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    black: '900',
  },
} as const;
