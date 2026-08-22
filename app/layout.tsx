import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { InactivityMonitor } from "@/components/auth/InactivityMonitor";
import { GlobalLoaderProvider } from "@/components/layout/GlobalLoaderProvider";
import { PortalShell } from "@/components/layout/PortalShell";
import { PwaBootstrap } from "@/components/mobile/PwaBootstrap";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { AppNotifyProvider } from "@/components/ui/AppNotifyProvider";
import { COLOR_THEME_STORAGE_KEY } from "@/lib/theme/colorThemes";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Actinium-DD",
  description:
    "Dry dock project management: tendering, superintendent planning, shipyard execution, and yard comparison.",
  icons: {
    icon: "/actinium-sm-logo.png",
    apple: "/actinium-sm-logo.png",
  },
};

const colorThemeBootScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(COLOR_THEME_STORAGE_KEY)});if(t)document.documentElement.setAttribute("data-color-theme",t);}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: colorThemeBootScript }} />
      </head>
      <body className="dd-app-shell bg-background text-foreground antialiased">
        <ThemeProvider>
          <GlobalLoaderProvider>
            <AppNotifyProvider>
              <PwaBootstrap />
              <InactivityMonitor />
              <PortalShell>{children}</PortalShell>
            </AppNotifyProvider>
          </GlobalLoaderProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
