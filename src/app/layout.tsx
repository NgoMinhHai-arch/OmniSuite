import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import Sidebar from "@/shared/ui/Sidebar";
import GlowBackground from "@/shared/ui/GlowBackground";
import { ThemeProvider } from "@/shared/ui/ThemeProvider";
import { DownloadRiddleProvider } from "@/shared/ui/DownloadRiddleProvider";
import { TaskProvider } from "@/shared/lib/context/TaskContext";
import AuthProvider from "./AuthProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "OmniSuite AI",
  description: "Unified dashboard for marketing automation and AI content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${inter.variable} ${outfit.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-screen antialiased selection:bg-indigo-500/30 flex flex-col font-inter overflow-x-hidden">
        <AuthProvider>
          <TaskProvider>
            <ThemeProvider>
              <DownloadRiddleProvider>
                <GlowBackground />
                <div className="flex min-h-screen">
                  <Sidebar />
                  <main className="flex-1 min-h-screen relative min-w-0" style={{ paddingLeft: 'var(--sidebar-width, 300px)' }}>
                    <div className="w-full h-full p-8 lg:p-12">
                      {children}
                    </div>
                  </main>
                </div>
              </DownloadRiddleProvider>
            </ThemeProvider>
          </TaskProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
