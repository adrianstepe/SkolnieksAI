"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface Question {
  id: number;
  pill: string;
  grade: string;
  subject: string;
  response: string;
}

const QUESTIONS: Question[] = [
  {
    id: 1,
    pill: "Izskaidro Ņūtona 2. likumu vienkāršiem vārdiem",
    grade: "9. klase",
    subject: "Fizika",
    response:
      "Iedomājies, ka stumj ratiņus — jo stiprāk stumj, jo ātrāk tie kustas. Ņūtona 2. likums saka tieši to: spēks vienāds ar masu, reizinātu ar paātrinājumu (F = ma). Tas nozīmē, ka smagāks priekšmets prasa lielāku spēku, lai paātrinātos tikpat ātri kā vieglāks. Ko domā — ja dubulto masu, bet saglabā to pašu spēku, kā mainīsies paātrinājums?",
  },
  {
    id: 2,
    pill: "Kā atrisināt kvadrātvienādojumu?",
    grade: "10. klase",
    subject: "Matemātika",
    response:
      "Kvadrātvienādojumu ax² + bx + c = 0 vienmēr var atrisināt ar diskriminanta formulu: D = b² − 4ac. Ja D > 0, ir divi atrisinājumi; ja D = 0 — viens; ja D < 0 — reālu atrisinājumu nav. Saknes aprēķina pēc formulas x = (−b ± √D) / 2a. Padomā — kāpēc formula dod divas ± iespējas, nevis vienu?",
  },
  {
    id: 3,
    pill: "Kas bija Latvijas neatkarības pasludināšanas nozīme?",
    grade: "8. klase",
    subject: "Vēsture",
    response:
      "1918. gada 18. novembrī Latvija pasludināja neatkarību kā suverēna valsts — pirmoreiz vēsturē. Tas bija vairāk nekā politisks akts: latvju tauta apliecināja savas tiesības uz pašnoteikšanos pēc gadsimtiem ilgas vācu un krievu valdīšanas. Neatkarība deva pamatu valsts institūcijām, izglītībai latviešu valodā un kultūras uzplaukumam. Kādas, tavuprāt, bija lielākās grūtības, ar ko jaunā valsts saskārās uzreiz pēc 1918. gada?",
  },
  {
    id: 4,
    pill: "Kāda ir fotosintēzes formula?",
    grade: "7. klase",
    subject: "Bioloģija",
    response:
      "Fotosintēze ir process, kurā augi izmanto saules gaismu, lai no oglekļa dioksīda un ūdens ražotu glikozi un skābekli. Formula: 6CO₂ + 6H₂O + gaisma → C₆H₁₂O₆ + 6O₂. Vienkārši sakot — augi \"apēd\" gaisu un ūdeni, un \"izelpot\" tīro skābekli, ko mēs elpojam. Kāpēc, domā, fotosintēze nevar notikt pilnīgā tumsā?",
  },
];

const TYPEWRITER_DELAY_MS = 15;

export function InteractiveDemo() {
  const [activeId, setActiveId] = useState<number | null>(null);
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showCta, setShowCta] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const responseRef = useRef<HTMLDivElement>(null);

  function clearTyping() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  function startTypewriter(text: string) {
    clearTyping();
    setDisplayedText("");
    setShowCta(false);
    setIsTyping(true);

    let i = 0;
    intervalRef.current = setInterval(() => {
      i++;
      setDisplayedText(text.slice(0, i));
      if (i >= text.length) {
        clearTyping();
        setIsTyping(false);
        setShowCta(true);
      }
    }, TYPEWRITER_DELAY_MS);
  }

  function handleSelect(q: Question) {
    if (activeId === q.id && isTyping) return;
    setActiveId(q.id);
    setShowCta(false);
    startTypewriter(q.response);
    // Scroll response into view on mobile after short delay
    setTimeout(() => {
      responseRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 100);
  }

  useEffect(() => {
    return () => clearTyping();
  }, []);

  const activeQuestion = QUESTIONS.find((q) => q.id === activeId) ?? null;

  return (
    <section className="w-full max-w-2xl mx-auto px-4">
      {/* Section heading */}
      <h2 className="text-xl font-semibold text-text-primary mb-1 text-center">
        Izmēģini tagad — bez reģistrācijas
      </h2>
      <p className="text-sm text-text-secondary text-center mb-6">
        Izvēlies jautājumu un redzi, kā SkolnieksAI palīdz saprast
      </p>

      {/* Question pills */}
      <div className="flex flex-col gap-3">
        {QUESTIONS.map((q) => {
          const isActive = activeId === q.id;
          return (
            <button
              key={q.id}
              onClick={() => handleSelect(q)}
              className={[
                "w-full text-left rounded-xl border px-4 py-3 transition-all duration-200",
                "min-h-[56px] flex items-start gap-3 cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                isActive
                  ? "border-primary bg-primary/10 shadow-[0_0_0_1px_rgba(79,142,247,0.4)]"
                  : "border-border bg-surface hover:bg-surface-hover hover:border-[rgba(255,255,255,0.14)]",
              ].join(" ")}
              aria-pressed={isActive}
            >
              {/* Subject badge */}
              <span
                className={[
                  "mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium leading-tight",
                  isActive
                    ? "bg-primary/20 text-primary"
                    : "bg-surface-hover text-text-secondary",
                ].join(" ")}
              >
                {q.grade}
              </span>
              <span className="text-sm text-text-primary leading-snug">{q.pill}</span>
            </button>
          );
        })}
      </div>

      {/* Response area */}
      {activeId !== null && (
        <div
          ref={responseRef}
          className="mt-5 rounded-xl border border-border bg-surface/60 p-5 animate-fade-up"
        >
          {/* Header row */}
          <div className="flex items-center gap-2 mb-3">
            {/* AI avatar dot */}
            <span className="w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
              <span className="w-2 h-2 rounded-full bg-primary block" />
            </span>
            <span className="text-xs font-medium text-primary">SkolnieksAI</span>
            {activeQuestion && (
              <span className="ml-auto text-[11px] text-text-muted">
                {activeQuestion.subject} · {activeQuestion.grade}
              </span>
            )}
          </div>

          {/* Typewriter text */}
          <p className="text-sm text-text-primary leading-relaxed min-h-[4rem] whitespace-pre-wrap">
            {displayedText}
            {isTyping && (
              <span className="inline-block w-0.5 h-4 bg-primary ml-0.5 align-middle animate-pulse" />
            )}
          </p>

          {/* Post-typewriter CTA */}
          {showCta && (
            <div className="mt-4 pt-4 border-t border-border animate-fade-up">
              <Link
                href="/signup"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-hover transition-colors"
              >
                Uzdod savu jautājumu → Reģistrējies bez maksas
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
