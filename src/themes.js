// Theme definitions for gformdummy TUI
// Each theme provides colors for different UI elements

export const THEMES = {
  sunset: {
    name: 'Sunset',
    description: 'Warm gradient (default)',
    logo: ['#FF6B6B', '#FFA07A', '#FFD93D'],
    accent: '#FF69B4',
    primary: '#FFD93D',
    success: '#4ADE80',
    error: '#FF6B6B',
    warning: '#FFA07A',
    info: '#60A5FA',
    border: 'cyan',
    dim: '#888888',
  },
  ocean: {
    name: 'Ocean',
    description: 'Cool blues & teals',
    logo: ['#00D2FF', '#3A7BD5', '#00D4AA'],
    accent: '#00D4AA',
    primary: '#60A5FA',
    success: '#34D399',
    error: '#F87171',
    warning: '#FBBF24',
    info: '#38BDF8',
    border: 'blue',
    dim: '#6B7280',
  },
  forest: {
    name: 'Forest',
    description: 'Natural greens',
    logo: ['#10B981', '#34D399', '#6EE7B7'],
    accent: '#34D399',
    primary: '#6EE7B7',
    success: '#4ADE80',
    error: '#F87171',
    warning: '#FBBF24',
    info: '#60A5FA',
    border: 'green',
    dim: '#6B7280',
  },
  purple: {
    name: 'Purple',
    description: 'Deep purple & pink',
    logo: ['#A855F7', '#C084FC', '#E879F9'],
    accent: '#E879F9',
    primary: '#C084FC',
    success: '#4ADE80',
    error: '#F87171',
    warning: '#FBBF24',
    info: '#818CF8',
    border: 'magenta',
    dim: '#6B7280',
  },
  matrix: {
    name: 'Matrix',
    description: 'Hacker green on black',
    logo: ['#00FF41', '#00CC33', '#009926'],
    accent: '#00FF41',
    primary: '#00FF41',
    success: '#00FF41',
    error: '#FF0000',
    warning: '#FFFF00',
    info: '#00FF41',
    border: 'green',
    dim: '#006600',
  },
  monokai: {
    name: 'Monokai',
    description: 'Classic dark theme',
    logo: ['#F92672', '#A6E22E', '#E6DB74'],
    accent: '#F92672',
    primary: '#A6E22E',
    success: '#A6E22E',
    error: '#F92672',
    warning: '#E6DB74',
    info: '#66D9EF',
    border: 'yellow',
    dim: '#75715E',
  },
};

export const THEME_NAMES = Object.keys(THEMES);

export function getTheme(name) {
  return THEMES[name] || THEMES.sunset;
}
