import type { Metadata, Viewport } from "next";
import { DM_Sans, JetBrains_Mono, Sora } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import "katex/dist/katex.min.css";
import { SettingsProvider } from "@/lib/context/settings-context";
import { AuthProvider } from "@/lib/context/auth-context";
import { SpeedInsights } from "@vercel/speed-insights/next";

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
  metadataBase: new URL("https://skolnieksai.lv"),
  title: "SkolnieksAI — AI mācību palīgs skolniekam",
  description:
    "AI palīgs, kas palīdz sagatavoties centralizētajiem eksāmeniem. Uzdod jautājumus, saņem skaidrojumus latviešu valodā.",
  keywords: ["skolnieks", "AI", "eksāmens", "mācības", "centralizētais eksāmens", "skolnieksai"],
  openGraph: {
    title: "SkolnieksAI — AI mācību palīgs skolniekam",
    description:
      "AI palīgs, kas palīdz sagatavoties centralizētajiem eksāmeniem. Uzdod jautājumus, saņem skaidrojumus latviešu valodā.",
    url: "https://skolnieksai.lv",
    type: "website",
  },
  // EU AI Act Art. 50 � machine-readable disclosure of AI-generated content
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
          <SettingsProvider>
            {children}
            <SpeedInsights />
          </SettingsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
