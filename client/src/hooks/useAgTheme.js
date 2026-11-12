import { useMemo } from 'react';
import { AllCommunityModule, ModuleRegistry, colorSchemeDark, themeQuartz } from 'ag-grid-community';
import { useTheme } from '../contexts/ThemeContext';

ModuleRegistry.registerModules([AllCommunityModule]);

const FONT = '"Plus Jakarta Sans", system-ui, sans-serif';

/** Hex mirrors of the CSS tokens in index.css; canvas rendering cannot resolve CSS variables. */
const TOKENS = {
  light: {
    fg: '#0f172a',
    muted: '#64748b',
    border: '#e2e8f0',
    grid: '#eef2f7',
    card: '#ffffff',
    surface: '#f8fafc',
    series: ['#6366f1', '#14b8a6', '#8b5cf6', '#0ea5e9', '#f59e0b', '#f43f5e', '#94a3b8'],
    status: {
      draft: '#94a3b8',
      pending_approval: '#f59e0b',
      approved: '#10b981',
      rejected: '#f43f5e',
      cancelled: '#cbd5e1'
    }
  },
  dark: {
    fg: '#f1f5f9',
    muted: '#94a3b8',
    border: '#1e293b',
    grid: '#172033',
    card: '#111827',
    surface: '#0f172a',
    series: ['#818cf8', '#2dd4bf', '#a78bfa', '#38bdf8', '#fbbf24', '#fb7185', '#64748b'],
    status: {
      draft: '#64748b',
      pending_approval: '#fbbf24',
      approved: '#34d399',
      rejected: '#fb7185',
      cancelled: '#334155'
    }
  }
};

export function useAgTheme() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return useMemo(() => {
    const t = isDark ? TOKENS.dark : TOKENS.light;

    const chartTheme = {
      baseTheme: isDark ? 'ag-default-dark' : 'ag-default',
      palette: { fills: t.series, strokes: t.series },
      params: {
        fontFamily: FONT,
        fontSize: 12,
        backgroundColor: 'transparent',
        chartBackgroundColor: 'transparent',
        foregroundColor: t.fg,
        textColor: t.fg,
        subtleTextColor: t.muted,
        gridLineColor: t.grid,
        axisLineColor: t.border,
        tooltipBackgroundColor: t.card,
        tooltipTextColor: t.fg,
        tooltipSubtleTextColor: t.muted,
        tooltipBorder: { color: t.border, width: 1 },
        tooltipBorderRadius: 10,
        chartPadding: 4
      }
    };

    const gridTheme = (isDark ? themeQuartz.withPart(colorSchemeDark) : themeQuartz).withParams({
      fontFamily: FONT,
      fontSize: 13,
      headerFontSize: 11,
      headerFontWeight: 600,
      headerTextColor: t.muted,
      headerBackgroundColor: t.surface,
      backgroundColor: t.card,
      foregroundColor: t.fg,
      borderColor: t.border,
      rowBorder: { color: t.border },
      wrapperBorder: false,
      wrapperBorderRadius: 0,
      accentColor: t.series[0],
      rowHoverColor: isDark ? 'rgba(129,140,248,0.08)' : 'rgba(99,102,241,0.05)',
      spacing: 7,
      rowHeight: 44,
      headerHeight: 38
    });

    return { isDark, tokens: t, chartTheme, gridTheme };
  }, [isDark]);
}
