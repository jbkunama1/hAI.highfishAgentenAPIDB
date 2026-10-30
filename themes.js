'use strict';

/**
 * Theme System for Telegram Bot Messages
 * Mobile-first approach with 3 pre-configured themes
 */

// Available themes
const THEMES = {
  ocean: {
    name: '🌊 Ocean Blue',
    primary: '#1E40AF',
    secondary: '#3B82F6',
    accent: '#60A5FA',
    background: '#F0F9FF',
    text: '#1E293B',
    button: {
      bg: '#3B82F6',
      text: '#FFFFFF',
      active: '#1D4ED8'
    }
  },
  forest: {
    name: '🌲 Forest Green',
    primary: '#15803D',
    secondary: '#16A34A',
    accent: '#4ADE80',
    background: '#F0FDF4',
    text: '#14532D',
    button: {
      bg: '#16A34A',
      text: '#FFFFFF',
      active: '#15803D'
    }
  },
  sunset: {
    name: '🌅 Sunset Orange',
    primary: '#EA580C',
    secondary: '#F97316',
    accent: '#FB923C',
    background: '#FFF7ED',
    text: '#7C2D12',
    button: {
      bg: '#F97316',
      text: '#FFFFFF',
      active: '#EA580C'
    }
  }
};

// Mobile-first formatting helpers
const FORMATTERS = {
  // Mobile-optimized text formatting
  header: (text, theme = 'ocean') => {
    const themeColors = THEMES[theme];
    return `<b>📱 ${text}</b>`;
  },
  
  title: (text, theme = 'ocean') => {
    return `<b>${text}</b>`;
  },
  
  subtitle: (text, theme = 'ocean') => {
    return `<i>${text}</i>`;
  },
  
  button: (text, theme = 'ocean') => {
    const themeColors = THEMES[theme];
    return `<b>🔹 ${text}</b>`;
  },
  
  success: (text, theme = 'ocean') => {
    return `<b>✅ ${text}</b>`;
  },
  
  error: (text, theme = 'ocean') => {
    return `<b>❌ ${text}</b>`;
  },
  
  warning: (text, theme = 'ocean') => {
    return `<b>⚠️ ${text}</b>`;
  },
  
  info: (text, theme = 'ocean') => {
    return `<b>ℹ️ ${text}</b>`;
  },
  
  // Mobile-optimized formatting
  mobileFormat: (text, type = 'normal', theme = 'ocean') => {
    switch (type) {
      case 'header':
        return FORMATTERS.header(text, theme);
      case 'title':
        return FORMATTERS.title(text, theme);
      case 'subtitle':
        return FORMATTERS.subtitle(text, theme);
      case 'button':
        return FORMATTERS.button(text, theme);
      case 'success':
        return FORMATTERS.success(text, theme);
      case 'error':
        return FORMATTERS.error(text, theme);
      case 'warning':
        return FORMATTERS.warning(text, theme);
      case 'info':
        return FORMATTERS.info(text, theme);
      default:
        return text;
    }
  },
  
  // Mobile-optimized message composer
  composeMessage: (parts, theme = 'ocean') => {
    let message = '';
    
    for (const part of parts) {
      if (typeof part === 'string') {
        message += part + '\n';
      } else if (part.type && part.text) {
        message += FORMATTERS.mobileFormat(part.text, part.type, theme) + '\n';
      }
    }
    
    return message.trim();
  },
  
  // Mobile-optimized inline keyboard generator
  generateKeyboard: (buttons, theme = 'ocean') => {
    const keyboard = [];
    const row = [];
    
    for (const button of buttons) {
      row.push({
        text: button.icon ? `${button.icon} ${button.text}` : button.text,
        callback_data: button.callback
      });
      
      // Mobile-optimized: 2 buttons per row for better touch experience
      if (row.length >= 2 || buttons.indexOf(button) === buttons.length - 1) {
        keyboard.push(row);
        row.length = 0;
      }
    }
    
    return { inline_keyboard: keyboard };
  }
};

// Theme persistence (simplified for Telegram bot context)
let currentTheme = 'ocean'; // Default theme

function setTheme(themeName) {
  if (THEMES[themeName]) {
    currentTheme = themeName;
    console.log(`[Theme] Switched to: ${THEMES[themeName].name}`);
    return true;
  }
  console.error(`[Theme] Theme '${themeName}' not found`);
  return false;
}

function getCurrentTheme() {
  return {
    name: THEMES[currentTheme].name,
    colors: THEMES[currentTheme],
    currentTheme: currentTheme
  };
}

function getAllThemes() {
  return Object.keys(THEMES).map(key => ({
    id: key,
    name: THEMES[key].name,
    current: key === currentTheme
  }));
}

// Get formatting helpers for current theme
function getFormatters() {
  return {
    ...FORMATTERS,
    currentTheme: currentTheme,
    header: (text) => FORMATTERS.header(text, currentTheme),
    title: (text) => FORMATTERS.title(text, currentTheme),
    subtitle: (text) => FORMATTERS.subtitle(text, currentTheme),
    button: (text) => FORMATTERS.button(text, currentTheme),
    success: (text) => FORMATTERS.success(text, currentTheme),
    error: (text) => FORMATTERS.error(text, currentTheme),
    warning: (text) => FORMATTERS.warning(text, currentTheme),
    info: (text) => FORMATTERS.info(text, currentTheme),
    composeMessage: (parts) => FORMATTERS.composeMessage(parts, currentTheme),
    generateKeyboard: (buttons) => FORMATTERS.generateKeyboard(buttons, currentTheme)
  };
}

module.exports = {
  THEMES,
  setTheme,
  getCurrentTheme,
  getAllThemes,
  getFormatters
};