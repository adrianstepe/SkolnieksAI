import type { Metadata, Viewport } from "next";
import { DM_Sans, JetBrains_Mono, Sora } from "next/font/google";
import { headers } from "next/headers";
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
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%23111827'/><text y='72' x='50' text-anchor='middle' font-size='65' font-family='sans-serif' fill='white' font-weight='700'>S</text><circle cx='68' cy='32' r='10' fill='%232563EB'/></svg>",
  },
  // EU AI Act Art. 50 — machine-readable disclosure of AI-generated content
  other: {
    "ai-generated-content":
      "This platform uses AI to generate educational responses. AI model providers: DeepSeek, Anthropic Claude.",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Reading the nonce here opts the page into dynamic rendering and signals
  // Next.js to apply this nonce to all inline <script> tags it generates
  // (hydration, RSC payload, etc.), satisfying the CSP set in middleware.ts.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

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
