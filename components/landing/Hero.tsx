"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ChevronRight } from "lucide-react";

export function Hero() {
  return (
    <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 bg-primary/10 blur-[120px] rounded-full -z-10" />

      <div className="max-w-7xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-success/10 border border-success/20 mb-8"
        >
          <span className="w-2 h-2 rounded-full bg-success animate-pulse-glow" />
          <span className="text-success text-xs font-bold uppercase tracking-wider">
            Latvijas pirmais AI mācību palīgs
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-4xl md:text-7xl font-heading font-bold leading-[1.1] mb-6 max-w-4xl mx-auto text-white"
        >
          Saproti mācības ātrāk.{" "}
          <span className="text-primary">Bez stresa.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-white/60 text-lg md:text-xl max-w-2xl mx-auto mb-10"
        >
          Mākslīgais intelekts, kas palīdz tev saprast mācības — nevis izdara
          tās tavā vietā.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="hidden md:flex items-center justify-center gap-4"
        >
          <Link
            href="/signup"
            className="bg-primary hover:bg-primary-hover text-white px-8 py-4 rounded-xl font-bold transition-all flex items-center gap-2 group shadow-xl glow-primary"
          >
            Sākt mācīties bez maksas{" "}
            <ChevronRight
              size={20}
              className="group-hover:translate-x-1 transition-transform"
            />
          </Link>
          <Link
            href="/login"
            className="px-8 py-4 rounded-xl font-bold border border-border text-white hover:bg-surface-hover transition-all"
          >
            Pierakstīties
          </Link>
        </motion.div>
      </div>

      {/* Mobile fixed CTA */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-base/80 backdrop-blur-lg border-t border-border z-40 safe-area-bottom">
        <Link
          href="/signup"
          className="w-full bg-primary text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-xl glow-primary"
        >
          Sākt mācīties bez maksas <ChevronRight size={20} />
        </Link>
      </div>
    </section>
  );
}
