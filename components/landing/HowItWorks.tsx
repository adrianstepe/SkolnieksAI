import { MessageSquare, Sparkles, Lightbulb } from "lucide-react";

const STEPS = [
  {
    icon: <MessageSquare className="text-primary" size={32} />,
    title: "Uzdod jautājumu",
    description: "Raksti jebkuru jautājumu par mācību vielu latviski",
  },
  {
    icon: <Sparkles className="text-primary" size={32} />,
    title: "AI izskaidro",
    description: "SkolnieksAI atrod atbildi un izskaidro tev saprotami",
  },
  {
    icon: <Lightbulb className="text-primary" size={32} />,
    title: "Tu saproti",
    description: "AI palīdz domāt, nevis dara tavā vietā",
  },
];

export function HowItWorks() {
  return (
    <section className="py-24 max-w-7xl mx-auto px-6">
      <h2 className="text-3xl md:text-5xl font-heading font-bold text-center text-white mb-16">
        Kā tas strādā?
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {STEPS.map((step, idx) => (
          <div
            key={idx}
            className="glass-card p-8 rounded-2xl text-center flex flex-col items-center hover:-translate-y-1 transition-transform duration-200"
          >
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
              {step.icon}
            </div>
            <h3 className="text-xl font-bold text-white mb-4">
              {step.title}
            </h3>
            <p className="text-white/60 leading-relaxed">
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
