import { Play, Sun, Moon, ChevronDown } from "lucide-react";

interface NavbarProps {
  dark: boolean;
  onToggleTheme: () => void;
}

export function Navbar({ dark, onToggleTheme }: NavbarProps) {
  return (
    <header className="navbar">
      <a className="brand" href="#" aria-label="Study Sync home">
        <span className="brand-mark">
          <Play size={16} fill="currentColor" />
        </span>
        <span>
          Study <span className="brand-accent">Sync</span>
        </span>
      </a>
      <div className="nav-actions">
        <button className="language-button" type="button" aria-label="Language: English">
          English <ChevronDown size={14} aria-hidden="true" />
        </button>
        <button
          className="icon-button"
          onClick={onToggleTheme}
          aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
          title="Toggle theme"
        >
          {dark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  );
}
