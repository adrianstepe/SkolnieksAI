import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
// KaTeX CSS for math rendering. No MathJax is configured in this project.
// Latvian decimal comma is handled at the prompt level via {,} syntax in LaTeX
// (e.g. $3{,}14$) — no global comma-spacing overrides needed.
import "katex/dist/katex.min.css";
import { SettingsProvider } from "@/lib/context/settings-context";
import { AuthProvider } from "@/lib/context/auth-context";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#1e40af",
};

export const metadata: Metadata = {
  title: "SkolnieksAI \u2014 Tavs m\u0101c\u012Bbu pal\u012Bgs",
  description:
    "AI m\u0101c\u012Bbu pal\u012Bgs, kas balst\u012Bts uz Latvijas Skola2030 m\u0101c\u012Bbu programmu. Pal\u012Bdz saprast, nevis dara m\u0101jas darbus tav\u0101 viet\u0101.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="lv" className={`${inter.variable} h-full antialiased`}>
      <body className="h-full bg-gray-50 font-sans text-gray-900 dark:bg-slate-900 dark:text-slate-100">
        <AuthProvider>
          <SettingsProvider>{children}</SettingsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
