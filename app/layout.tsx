import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { InactivityMonitor } from "@/components/auth/InactivityMonitor";
import { GlobalLoaderProvider } from "@/components/layout/GlobalLoaderProvider";
import { PortalShell } from "@/components/layout/PortalShell";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="dd-app-shell bg-background text-foreground antialiased">
        <GlobalLoaderProvider>
          <InactivityMonitor />
          <PortalShell>{children}</PortalShell>
        </GlobalLoaderProvider>
      </body>
    </html>
  );
}
