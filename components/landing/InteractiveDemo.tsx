"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, ChevronRight } from "lucide-react";

interface Question {
  id: number;
  grade: string;
  question: string;
  answer: string;
}

const QUESTIONS: Question[] = [
  {
    id: 1,
    grade: "9. klase",
    question: "Izskaidro Ņūtona 2. likumu vienkāršiem vārdiem",
    answer:
      "Ņūtona 2. likums saka: jo lielāku spēku tu piemēro objektam, jo ātrāk tas paātrinās. Bet — jo smagāks objekts, jo vairāk spēka vajag.\n\nFormula: F = m · a\n\nIedomājies — tu stumj iepirkumu ratiņus. Tukšus — viegli. Pilnus ar produktiem — grūtāk. Masa (m) ir lielāka, bet tavs spēks (F) paliek tāds pats — tāpēc paātrinājums (a) ir mazāks.\n\nPamēģini: kāds būtu paātrinājums, ja F = 10 N un m = 2 kg?",
  },
  {
    id: 2,
    grade: "10. klase",
    question: "Kā atrisināt kvadrātvienādojumu?",
    answer:
      "Kvadrātvienādojumam ax² + bx + c = 0 izmanto diskriminanta formulu.\n\n1. Aprēķini diskriminantu: D = b² - 4ac\n2. Ja D > 0 → divas saknes: x = (-b ± √D) / 2a\n3. Ja D = 0 → viena sakne: x = -b / 2a\n4. Ja D < 0 → nav reālu sakņu\n\nPiemērs: x² - 5x + 6 = 0\na=1, b=-5, c=6\nD = 25 - 24 = 1\nx₁ = (5+1)/2 = 3, x₂ = (5-1)/2 = 2\n\nTagad pamēģini pats: 2x² + 3x - 2 = 0",
  },
  {
    id: 3,
    grade: "8. klase",
    question: "Kas bija Latvijas neatkarības pasludināšanas nozīme?",
    answer:
      'Latvijas neatkarības pasludināšana 1918. gada 18. novembrī bija vēsturisks pavērsiens.\n\nGalvenie iemesli:\n• Pirmā pasaules kara beigas sagrāva Krievijas un Vācijas impērijas\n• Latvieši jau bija izveidojuši nacionālo identitāti (Atmoda, dziesmu svētki)\n• Tautu pašnoteikšanās princips — Vilsona 14 punkti\n\nKārlis Ulmanis un Latvijas Tautas padome pasludināja neatkarību Rīgas Nacionālajā teātrī.\n\nKā tu domā — kāpēc tieši teātris tika izvēlēts šim notikumam?',
  },
  {
    id: 4,
    grade: "7. klase",
    question: "Kāda ir fotosintēzes formula?",
    answer:
      "Fotosintēze ir process, kurā augi pārvērš saules gaismu enerģijā.\n\nFormula: 6CO₂ + 6H₂O + gaisma → C₆H₁₂O₆ + 6O₂\n\nVienkārši:\n• Augs paņem ogļskābo gāzi (CO₂) no gaisa\n• Paņem ūdeni (H₂O) no zemes\n• Izmanto saules gaismu kā enerģiju\n• Rezultāts: glikoze (cukurs) + skābeklis (ko mēs elpojam)\n\nTas notiek hloroplastos — zaļajās daļiņās auga šūnās.\n\nKāpēc, tavuprāt, augi ir zaļi?",
  },
];

const TYPEWRITER_DELAY_MS = 15;

export function InteractiveDemo() {
  const [activeId, setActiveId] = useState<number | null>(null);
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function clearTyping() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  function startTypewriter(text: string) {
    clearTyping();
    setDisplayedText("");
    setIsTyping(true);

    let i = 0;
    intervalRef.current = setInterval(() => {
      i++;
      setDisplayedText(text.slice(0, i));
      if (i >= text.length) {
        clearTyping();
        setIsTyping(false);
      }
    }, TYPEWRITER_DELAY_MS);
  }

  function handleSelect(q: Question) {
    if (activeId === q.id && isTyping) return;
    setActiveId(q.id);
    startTypewriter(q.answer);
  }

  useEffect(() => {
    return () => clearTyping();
  }, []);

  return (
    <section className="py-20 bg-surface/30">
      <div className="max-w-4xl mx-auto px-6">
        <h2 className="text-3xl md:text-4xl font-heading font-bold text-center text-white mb-12">
          Izmēģini tagad — bez reģistrācijas
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {QUESTIONS.map((q) => {
            const isActive = activeId === q.id;
            return (
              <button
                key={q.id}
                onClick={() => handleSelect(q)}
                className={[
                  "text-left p-4 rounded-xl border transition-all cursor-pointer",
                  isActive
                    ? "bg-[#1a2040] border-primary shadow-lg"
                    : "bg-[#1A2033] border-white/10 hover:border-primary/30",
                ].join(" ")}
              >
                <span className="inline-block px-2 py-0.5 rounded bg-[#222940] text-[10px] font-bold uppercase !text-white/70 mb-2">
                  {q.grade}
                </span>
                <p className="font-medium text-sm md:text-base !text-white">
                  {q.question}
                </p>
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {activeId !== null && (
            <motion.div
              key={activeId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="glass-card p-6 md:p-8 rounded-2xl min-h-[200px] relative overflow-hidden"
            >
              <div className="flex items-center gap-2 mb-4 text-primary">
                <Sparkles size={18} />
                <span className="text-xs font-bold uppercase tracking-widest">
                  SkolnieksAI atbilde
                </span>
              </div>
              <p className="whitespace-pre-wrap text-white/90 leading-relaxed">
                {displayedText}
                {isTyping && (
                  <span className="inline-block w-1 h-4 bg-primary ml-1 animate-pulse" />
                )}
              </p>

              {!isTyping && activeId !== null && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-8 pt-6 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4"
                >
                  <p className="text-sm text-white/60 italic">
                    Vēlies uzdot savu jautājumu?
                  </p>
                  <Link
                    href="/signup"
                    className="text-primary font-bold flex items-center gap-1 hover:gap-2 transition-all"
                  >
                    Reģistrējies bez maksas <ChevronRight size={18} />
                  </Link>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
