import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronRight, 
  MessageSquare, 
  Sparkles, 
  Lightbulb, 
  Check, 
  ChevronDown,
  Menu,
  X
} from 'lucide-react';

// --- Components ---

const Logo = () => (
  <div className="font-sora font-semibold text-xl tracking-tight">
    <span className="font-bold">Skolnieks</span>
    <span className="text-brand-blue mx-0.5">·</span>
    <span className="font-light">AI</span>
  </div>
);

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-brand-bg/80 backdrop-blur-md border-b border-white/5 py-3' : 'bg-transparent py-5'}`}>
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <Logo />
        <div className="hidden md:flex items-center gap-8">
          <a href="/login" className="text-sm font-medium hover:text-brand-blue transition-colors">Ieiet</a>
          <a href="/register" className="bg-brand-blue hover:bg-blue-600 text-white px-5 py-2.5 rounded-full text-sm font-semibold transition-all shadow-lg shadow-blue-500/20">
            Reģistrēties
          </a>
        </div>
        <button className="md:hidden text-brand-text">
          <Menu size={24} />
        </button>
      </div>
    </nav>
  );
};

const Hero = () => {
  return (
    <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 bg-brand-blue/10 blur-[120px] rounded-full -z-10" />
      
      <div className="max-w-7xl mx-auto px-6 text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-green/10 border border-brand-green/20 mb-8"
        >
          <span className="w-2 h-2 rounded-full bg-brand-green animate-pulse-green" />
          <span className="text-brand-green text-xs font-bold uppercase tracking-wider">Latvijas pirmais AI mācību palīgs</span>
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-4xl md:text-7xl font-sora font-bold leading-[1.1] mb-6 max-w-4xl mx-auto"
        >
          Saproti mācības ātrāk. <span className="text-brand-blue">Bez stresa.</span>
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-brand-muted text-lg md:text-xl max-w-2xl mx-auto mb-10"
        >
          Mākslīgais intelekts, kas palīdz tev saprast mācības — nevis izdara tās tavā vietā.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="hidden md:flex items-center justify-center gap-4"
        >
          <a href="/register" className="bg-brand-blue hover:bg-blue-600 text-white px-8 py-4 rounded-xl font-bold transition-all flex items-center gap-2 group shadow-xl shadow-blue-500/25">
            Sākt mācīties bez maksas <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </a>
          <a href="/login" className="px-8 py-4 rounded-xl font-bold border border-white/10 hover:bg-white/5 transition-all">
            Pierakstīties
          </a>
        </motion.div>
      </div>

      {/* Mobile Fixed CTA */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-brand-bg/80 backdrop-blur-lg border-t border-white/5 z-40 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <a href="/register" className="w-full bg-brand-blue text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-xl shadow-blue-500/25">
          Sākt mācīties bez maksas <ChevronRight size={20} />
        </a>
      </div>
    </section>
  );
};

const InteractiveDemo = () => {
  const [activeQuestion, setActiveQuestion] = useState<number | null>(null);
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const questions = [
    {
      id: 1,
      grade: "9. klase",
      question: "Izskaidro Ņūtona 2. likumu vienkāršiem vārdiem",
      answer: "Ņūtona 2. likums saka: jo lielāku spēku tu piemēro objektam, jo ātrāk tas paātrinās. Bet — jo smagāks objekts, jo vairāk spēka vajag.\n\nFormula: F = m · a\n\nIedomājies — tu stumj iepirkumu ratiņus. Tukšus — viegli. Pilnus ar produktiem — grūtāk. Masa (m) ir lielāka, bet tavs spēks (F) paliek tāds pats — tāpēc paātrinājums (a) ir mazāks.\n\n💡 Pamēģini: kāds būtu paātrinājums, ja F = 10 N un m = 2 kg?"
    },
    {
      id: 2,
      grade: "10. klase",
      question: "Kā atrisināt kvadrātvienādojumu?",
      answer: "Kvadrātvienādojumam ax² + bx + c = 0 izmanto diskriminanta formulu.\n\n1. Aprēķini diskriminantu: D = b² - 4ac\n2. Ja D > 0 → divas saknes: x = (-b ± √D) / 2a\n3. Ja D = 0 → viena sakne: x = -b / 2a\n4. Ja D < 0 → nav reālu sakņu\n\nPiemērs: x² - 5x + 6 = 0\na=1, b=-5, c=6\nD = 25 - 24 = 1\nx₁ = (5+1)/2 = 3, x₂ = (5-1)/2 = 2\n\n💡 Tagad pamēģini pats: 2x² + 3x - 2 = 0"
    },
    {
      id: 3,
      grade: "8. klase",
      question: "Kas bija Latvijas neatkarības pasludināšanas nozīme?",
      answer: "Latvijas neatkarības pasludināšana 1918. gada 18. novembrī bija vēsturisks pavērsiens.\n\nGalvenie iemesli:\n• Pirmā pasaules kara beigas sagrāva Krievijas un Vācijas impērijas\n• Latvieši jau bija izveidojuši nacionālo identitāti (Atmoda, dziesmu svētki)\n• Tautu pašnoteikšanās princips — Vilsona 14 punkti\n\nKārlis Ulmanis un Latvijas Tautas padome pasludināja neatkarību Rīgas Nacionālajā teātrī.\n\n💡 Kā tu domā — kāpēc tieši teātris tika izvēlēts šim notikumam?"
    },
    {
      id: 4,
      grade: "7. klase",
      question: "Kāda ir fotosintēzes formula?",
      answer: "Fotosintēze ir process, kurā augi pārvērš saules gaismu enerģijā.\n\nFormula: 6CO₂ + 6H₂O + gaisma → C₆H₁₂O₆ + 6O₂\n\nVienkārši:\n• Augs paņem ogļskābo gāzi (CO₂) no gaisa\n• Paņem ūdeni (H₂O) no zemes\n• Izmanto saules gaismu kā enerģiju\n• Rezultāts: glikoze (cukurs) + skābeklis (ko mēs elpojam)\n\nTas notiek hloroplastos — zaļajās daļiņās auga šūnās.\n\n💡 Kāpēc, tavuprāt, augi ir zaļi?"
    }
  ];

  useEffect(() => {
    if (activeQuestion !== null) {
      setIsTyping(true);
      setDisplayText('');
      const fullText = questions.find(q => q.id === activeQuestion)?.answer || '';
      let i = 0;
      const interval = setInterval(() => {
        setDisplayText(fullText.slice(0, i + 1));
        i++;
        if (i >= fullText.length) {
          clearInterval(interval);
          setIsTyping(false);
        }
      }, 15);
      return () => clearInterval(interval);
    }
  }, [activeQuestion]);

  return (
    <section className="py-20 bg-white/[0.02]">
      <div className="max-w-4xl mx-auto px-6">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Izmēģini tagad — bez reģistrācijas</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {questions.map((q) => (
            <button
              key={q.id}
              onClick={() => setActiveQuestion(q.id)}
              className={`text-left p-4 rounded-xl border transition-all ${activeQuestion === q.id ? 'bg-brand-blue/10 border-brand-blue shadow-lg shadow-blue-500/10' : 'bg-brand-surface border-white/5 hover:border-white/20'}`}
            >
              <span className="inline-block px-2 py-0.5 rounded bg-white/10 text-[10px] font-bold uppercase mb-2">{q.grade}</span>
              <p className="font-medium text-sm md:text-base">{q.question}</p>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeQuestion && (
            <motion.div
              key={activeQuestion}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="glass-card p-6 md:p-8 rounded-2xl min-h-[200px] relative overflow-hidden"
            >
              <div className="flex items-center gap-2 mb-4 text-brand-blue">
                <Sparkles size={18} />
                <span className="text-xs font-bold uppercase tracking-widest">SkolnieksAI atbilde</span>
              </div>
              <p className="whitespace-pre-wrap text-brand-text/90 leading-relaxed">
                {displayText}
                {isTyping && <span className="inline-block w-1 h-4 bg-brand-blue ml-1 animate-pulse" />}
              </p>

              {!isTyping && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-8 pt-6 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4"
                >
                  <p className="text-sm text-brand-muted italic">Vēlies uzdot savu jautājumu?</p>
                  <a href="/register" className="text-brand-blue font-bold flex items-center gap-1 hover:gap-2 transition-all">
                    Reģistrējies bez maksas <ChevronRight size={18} />
                  </a>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
};

const HowItWorks = () => {
  const steps = [
    {
      icon: <MessageSquare className="text-brand-blue" size={32} />,
      title: "Uzdod jautājumu",
      description: "Raksti jebkuru jautājumu par mācību vielu latviski"
    },
    {
      icon: <Sparkles className="text-brand-blue" size={32} />,
      title: "AI izskaidro",
      description: "SkolnieksAI atrod atbildi un izskaidro tev saprotami"
    },
    {
      icon: <Lightbulb className="text-brand-blue" size={32} />,
      title: "Tu saproti",
      description: "AI palīdz domāt, nevis dara tavā vietā"
    }
  ];

  return (
    <section className="py-24 max-w-7xl mx-auto px-6">
      <h2 className="text-3xl md:text-5xl font-bold text-center mb-16">Kā tas strādā?</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {steps.map((step, idx) => (
          <motion.div 
            key={idx}
            whileHover={{ y: -5 }}
            className="glass-card p-8 rounded-2xl text-center flex flex-col items-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-brand-blue/10 flex items-center justify-center mb-6">
              {step.icon}
            </div>
            <h3 className="text-xl font-bold mb-4">{step.title}</h3>
            <p className="text-brand-muted leading-relaxed">{step.description}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

const SubjectGrid = () => {
  const subjects = [
    "Matemātika", "Fizika", "Ķīmija", "Bioloģija", "Vēsture", 
    "Ģeogrāfija", "Latviešu valoda", "Angļu valoda", "Datorzinātne", "Vizuālā māksla"
  ];

  return (
    <section className="py-24 bg-white/[0.02]">
      <div className="max-w-5xl mx-auto px-6 text-center">
        <h2 className="text-3xl md:text-5xl font-bold mb-4">Priekšmeti</h2>
        <p className="text-brand-muted mb-12">6.–12. klase</p>
        
        <div className="flex flex-wrap justify-center gap-3">
          {subjects.map((subject, idx) => (
            <span 
              key={idx}
              className="px-6 py-3 rounded-full bg-brand-surface border border-white/5 text-sm font-medium hover:border-brand-blue/50 transition-colors cursor-default"
            >
              {subject}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
};

const Pricing = () => {
  const plans = [
    {
      name: "Bezmaksas",
      price: "€0",
      features: ["Līdz 40 jautājumiem mēnesī", "Atbildes latviešu valodā", "DeepSeek AI modelis"],
      cta: "Sākt bez maksas",
      highlight: false,
      outline: true
    },
    {
      name: "Pro",
      price: "€5.99",
      features: ["Neierobežoti jautājumi", "Claude AI modelis", "Prioritāra atbilde"],
      cta: "Izmēģināt Pro",
      highlight: true,
      outline: false
    },
    {
      name: "Premium",
      price: "€14.99",
      features: ["Viss no Pro", "Eksāmenu simulācijas", "Personalizēts mācību plāns"],
      cta: "Izmēģināt Premium",
      highlight: false,
      outline: false
    }
  ];

  return (
    <section className="py-24 max-w-7xl mx-auto px-6">
      <h2 className="text-3xl md:text-5xl font-bold text-center mb-16">Plāni un cenas</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
        {plans.map((plan, idx) => (
          <motion.div 
            key={idx}
            whileHover={{ 
              scale: plan.highlight ? 1.08 : 1.03,
              y: -8,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
            }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className={`flex flex-col p-8 rounded-3xl border transition-all duration-300 ${plan.highlight ? 'bg-brand-blue/5 border-brand-blue shadow-2xl shadow-blue-500/10 scale-105 z-10' : 'bg-brand-surface border-white/5'}`}
          >
            <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
            <div className="flex items-baseline gap-1 mb-8">
              <span className="text-4xl font-bold">{plan.price}</span>
              <span className="text-brand-muted">/mēn</span>
            </div>
            <ul className="space-y-4 mb-10 flex-grow">
              {plan.features.map((f, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-brand-text/80">
                  <Check size={18} className="text-brand-blue shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <button className={`w-full py-4 rounded-xl font-bold transition-all ${plan.outline ? 'border border-white/10 hover:bg-white/5' : 'bg-brand-blue hover:bg-blue-600 text-white shadow-lg shadow-blue-500/20'}`}>
              {plan.cta}
            </button>
          </motion.div>
        ))}
      </div>
      <p className="text-center text-brand-muted text-sm mt-12">
        Skolām: Skolu Pro plāns no €20/skolēnu gadā.
      </p>
    </section>
  );
};

const FAQ = () => {
  const faqs = [
    {
      q: "Vai SkolnieksAI izdarīs manu mājas darbu?",
      a: "Nē. SkolnieksAI palīdz saprast — izskaidro, dod piemērus, palīdz domāt. Mēs nekad nedarīsim darbu tavā vietā."
    },
    {
      q: "Kādus priekšmetus atbalsta?",
      a: "Matemātiku, fiziku, ķīmiju, bioloģiju, vēsturi, ģeogrāfiju, latviešu valodu, angļu valodu, datorzinātni u.c. 6.–12. klase."
    },
    {
      q: "Vai tas ir droši?",
      a: "Jā. Mēs nesaglabājam personīgo informāciju. Lietotājiem zem 13 gadiem nepieciešama vecāku piekrišana. Atbilstam GDPR."
    },
    {
      q: "Kāda ir atšķirība no ChatGPT?",
      a: "ChatGPT nezina Latvijas mācību programmu. SkolnieksAI atbild latviski un zina tieši to, ko tev māca skolā."
    }
  ];

  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <section className="py-24 max-w-3xl mx-auto px-6">
      <h2 className="text-3xl md:text-5xl font-bold text-center mb-16">Biežāk uzdotie jautājumi</h2>
      <div className="space-y-4">
        {faqs.map((faq, idx) => (
          <div key={idx} className="glass-card rounded-2xl overflow-hidden">
            <button 
              onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
              className="w-full p-6 text-left flex items-center justify-between gap-4"
            >
              <span className="font-bold">{faq.q}</span>
              <ChevronDown className={`transition-transform duration-300 ${openIdx === idx ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {openIdx === idx && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-6 pb-6 text-brand-muted leading-relaxed">
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
};

const FinalCTA = () => {
  return (
    <section className="py-24 px-6">
      <div className="max-w-5xl mx-auto glass-card rounded-[40px] p-12 md:p-24 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-brand-blue/5 -z-10" />
        <h2 className="text-4xl md:text-6xl font-bold mb-6">Gatavs mācīties gudrāk?</h2>
        <p className="text-brand-muted text-lg mb-10">Nav nepieciešama kredītkarte.</p>
        <a href="/register" className="inline-flex items-center gap-2 bg-brand-blue hover:bg-blue-600 text-white px-10 py-5 rounded-2xl font-bold text-xl transition-all shadow-2xl shadow-blue-500/30 group">
          Sākt bez maksas <ChevronRight size={24} className="group-hover:translate-x-1 transition-transform" />
        </a>
      </div>
    </section>
  );
};

const Footer = () => {
  return (
    <footer className="py-12 border-t border-white/5">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="flex flex-col items-center md:items-start gap-4">
          <Logo />
          <p className="text-xs text-brand-muted">© 2026 Stepe Digital SIA</p>
        </div>
        
        <div className="flex flex-wrap justify-center gap-8 text-sm text-brand-muted">
          <a href="#" className="hover:text-brand-text transition-colors">Lietošanas noteikumi</a>
          <a href="#" className="hover:text-brand-text transition-colors">Privātuma politika</a>
          <a href="#" className="hover:text-brand-text transition-colors">Kontakti</a>
        </div>
      </div>
    </footer>
  );
};

export default function LandingPage() {
  return (
    <div className="min-h-screen selection:bg-brand-blue/30 selection:text-white">
      <Navbar />
      <main>
        <Hero />
        <InteractiveDemo />
        <HowItWorks />
        <SubjectGrid />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
