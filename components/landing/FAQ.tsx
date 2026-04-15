"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown } from "lucide-react";

const FAQS = [
  {
    q: "Vai SkolnieksAI palīdzēs ar mājas darbiem?",
    a: "Jā! SkolnieksAI var palīdzēt ar mājas darbiem — izskaidro uzdevumus, dod piemērus un palīdz saprast, kā nonākt pie atbildes. Mērķis ir, lai tu pats saprastu vielu, nevis tikai iegūtu atbildi.",
  },
  {
    q: "Kādus priekšmetus atbalsta?",
    a: "Matemātiku, fiziku, ķīmiju, bioloģiju, vēsturi, ģeogrāfiju, latviešu valodu, angļu valodu, datorzinātni u.c. 6.–12. klase.",
  },
  {
    q: "Vai tas ir droši?",
    a: "Jā. Mēs nesaglabājam personīgo informāciju. Lietotājiem zem 13 gadiem nepieciešama vecāku piekrišana. Atbilstam GDPR.",
  },
  {
    q: "Kāda ir atšķirība no ChatGPT?",
    a: "ChatGPT nezina Latvijas mācību programmu. SkolnieksAI atbild latviski un zina tieši to, ko tev māca skolā.",
  },
];

export function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <section className="py-24 max-w-3xl mx-auto px-6">
      <h2 className="text-3xl md:text-5xl font-heading font-bold text-center text-white mb-16">
        Biežāk uzdotie jautājumi
      </h2>
      <div className="space-y-4">
        {FAQS.map((faq, idx) => (
          <div key={idx} className="glass-card rounded-2xl overflow-hidden">
            <button
              onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
              className="w-full p-6 text-left flex items-center justify-between gap-4 cursor-pointer"
            >
              <span className="font-bold text-white">{faq.q}</span>
              <ChevronDown
                className={`text-white/60 transition-transform duration-300 shrink-0 ${
                  openIdx === idx ? "rotate-180" : ""
                }`}
              />
            </button>
            <AnimatePresence>
              {openIdx === idx && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-6 pb-6 text-white/60 leading-relaxed">
                    {faq.a}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </section>
  );
}
