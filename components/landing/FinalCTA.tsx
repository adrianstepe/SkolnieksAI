import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function FinalCTA() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-5xl mx-auto glass-card rounded-[40px] p-12 md:p-24 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-primary/5 -z-10" />
        <h2 className="text-4xl md:text-6xl font-heading font-bold text-white mb-6">
          Gatavs mācīties gudrāk?
        </h2>
        <p className="text-white/60 text-lg mb-10">
          Nav nepieciešama kredītkarte.
        </p>
        <Link
          href="/signup"
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-10 py-5 rounded-2xl font-bold text-xl transition-all shadow-2xl glow-primary group"
        >
          Sākt bez maksas{" "}
          <ChevronRight
            size={24}
            className="group-hover:translate-x-1 transition-transform"
          />
        </Link>
      </div>
    </section>
  );
}
