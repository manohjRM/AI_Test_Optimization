// ABOUTME: Root layout — wraps every page with shared HTML shell, fonts, and styles.
// ABOUTME: Sets project metadata and global Tailwind imports.

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "AI Test Optimization Agent",
  description:
    "AI-driven regression test script optimizer — generate and refine test scripts with natural language.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");if(t==="dark")document.documentElement.classList.add("dark");else if(t!=="light"&&window.matchMedia("(prefers-color-scheme:dark)").matches)document.documentElement.classList.add("dark")}catch(e){}})()`,
          }}
        />
        {children}
        <footer className="border-t border-zinc-200 dark:border-zinc-800 px-6 py-4 text-center text-xs text-zinc-400 dark:text-zinc-500 shrink-0">
          AI Test Optimisation Agent &mdash; AI-driven regression test script optimizer
        </footer>
      </body>
    </html>
  );
}
