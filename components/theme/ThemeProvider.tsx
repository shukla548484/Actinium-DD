"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import {
  COLOR_THEME_STORAGE_KEY,
  isColorThemeId,
  type ColorThemeId,
} from "@/lib/theme/colorThemes";

type ColorThemeContextValue = {
  colorTheme: ColorThemeId;
  setColorTheme: (theme: ColorThemeId) => void;
};

const ColorThemeContext = createContext<ColorThemeContextValue | null>(null);

function applyColorTheme(theme: ColorThemeId) {
  document.documentElement.setAttribute("data-color-theme", theme);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [colorTheme, setColorThemeState] = useState<ColorThemeId>("default");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(COLOR_THEME_STORAGE_KEY);
      if (isColorThemeId(stored)) {
        setColorThemeState(stored);
        applyColorTheme(stored);
      } else {
        applyColorTheme("default");
      }
    } catch {
      applyColorTheme("default");
    }
  }, []);

  const setColorTheme = useCallback((theme: ColorThemeId) => {
    setColorThemeState(theme);
    applyColorTheme(theme);
    try {
      localStorage.setItem(COLOR_THEME_STORAGE_KEY, theme);
    } catch {
      // ignore quota / private mode
    }
  }, []);

  const value = useMemo(
    () => ({ colorTheme, setColorTheme }),
    [colorTheme, setColorTheme],
  );

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ColorThemeContext.Provider value={value}>{children}</ColorThemeContext.Provider>
    </NextThemesProvider>
  );
}

export function useColorTheme() {
  const ctx = useContext(ColorThemeContext);
  if (!ctx) {
    throw new Error("useColorTheme must be used within ThemeProvider");
  }
  return ctx;
}
