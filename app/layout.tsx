import type { Metadata, Viewport } from "next";
import { DM_Sans, JetBrains_Mono, Sora } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";
import { SettingsProvider } from "@/lib/context/settings-context";
import { AuthProvider } from "@/lib/context/auth-context";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["300", "600"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0F1117",
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
    <html
      lang="lv"
      className={`${dmSans.variable} ${jetbrainsMono.variable} ${sora.variable} dark h-full antialiased`}
    >
      <body className="h-full bg-[#F9FAFB] dark:bg-[#0F1117] font-sans text-[#111827] dark:text-[#E8ECF4]">
        <AuthProvider>
          <SettingsProvider>{children}</SettingsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
