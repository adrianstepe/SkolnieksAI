import Link from "next/link";
import { LogoWordmark } from "@/components/LogoWordmark";

export function Footer() {
  return (
    <footer className="py-12 border-t border-border">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="flex flex-col items-center md:items-start gap-4">
          <LogoWordmark size="sm" />
          <p className="text-xs text-white/40">© 2026 Stepe Digital SIA</p>
        </div>

        <div className="flex flex-wrap justify-center gap-8 text-sm text-white/60">
          <Link
            href="/terms"
            className="hover:text-white transition-colors"
          >
            Lietošanas noteikumi
          </Link>
          <Link
            href="/privacy"
            className="hover:text-white transition-colors"
          >
            Privātuma politika
          </Link>
        </div>
      </div>

      {/* EU AI Act Art. 50 — transparency disclosure */}
      <div className="max-w-7xl mx-auto px-6 mt-6 border-t border-white/10 pt-6">
        <p className="text-xs text-white/30 text-center leading-relaxed">
          SkolnieksAI izmanto mākslīgo intelektu, lai sniegtu izglītojošas atbildes. Atbildes ģenerē AI modeļi un tās nav cilvēku autorizētas mācību materiālu aizstājēji.
        </p>
      </div>
    </footer>
  );
}
