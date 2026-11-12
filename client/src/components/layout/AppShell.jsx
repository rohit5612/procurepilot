import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu, Moon, Sun } from 'lucide-react';
import { BrandMark } from '../common/BrandLogo';
import { BRAND_NAME } from '../../constants/branding';
import ProcurePilotSidebar from './ProcurePilotSidebar';
import { resolvePageTitle } from '../../utils/pageTitles';
import { useTheme } from '../../contexts/ThemeContext';

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const title = resolvePageTitle(location.pathname);
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-bg flex">
      <ProcurePilotSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 min-w-0 lg:pl-[17rem] flex flex-col min-h-screen">
        <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md px-4 py-3 lg:px-8 flex items-center gap-3">
          <button
            type="button"
            className="lg:hidden btn btn-ghost p-2"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-fg truncate tracking-tight">{title}</h1>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="btn btn-ghost p-2 rounded-lg"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>

        <main className="flex-1 relative">
          <div className="absolute inset-0 app-mesh pointer-events-none" aria-hidden />
          <div className="relative px-4 py-6 lg:px-8 lg:py-8 max-w-[1600px] mx-auto w-full">
            <Outlet />
          </div>
        </main>

        <footer className="px-4 lg:px-8 py-3 text-xs text-muted border-t border-border bg-card/50 flex items-center gap-2">
          <BrandMark size="xs" alt={BRAND_NAME} />
          <span>{BRAND_NAME} · Built for controlled, AI-assisted procurement</span>
        </footer>
      </div>
    </div>
  );
}
