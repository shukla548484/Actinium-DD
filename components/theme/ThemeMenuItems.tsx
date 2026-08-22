"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useColorTheme } from "@/components/theme/ThemeProvider";
import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { COLOR_THEMES } from "@/lib/theme/colorThemes";

/** Theme controls rendered inside the top-nav user avatar dropdown. */
export function ThemeMenuItems() {
  const { theme, setTheme } = useTheme();
  const { colorTheme, setColorTheme } = useColorTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const appearance = mounted ? (theme ?? "system") : "system";
  const color = mounted ? colorTheme : "default";

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuRadioGroup value={appearance} onValueChange={(v) => setTheme(v)}>
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <DropdownMenuRadioItem value="light">
          <Sun className="size-4" />
          Light
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="dark">
          <Moon className="size-4" />
          Dark
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="system">
          <Monitor className="size-4" />
          System
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
      <DropdownMenuSeparator />
      <DropdownMenuRadioGroup
        value={color}
        onValueChange={(v) => {
          const match = COLOR_THEMES.find((t) => t.id === v);
          if (match) setColorTheme(match.id);
        }}
      >
        <DropdownMenuLabel>Color theme</DropdownMenuLabel>
        {COLOR_THEMES.map((t) => (
          <DropdownMenuRadioItem key={t.id} value={t.id}>
            <span
              className="size-3.5 shrink-0 rounded-full ring-1 ring-border"
              style={{ background: t.swatch }}
              aria-hidden
            />
            {t.label}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </>
  );
}
