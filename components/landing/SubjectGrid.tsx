const SUBJECTS = [
  "Matemātika",
  "Fizika",
  "Ķīmija",
  "Bioloģija",
  "Vēsture",
  "Ģeogrāfija",
  "Latviešu valoda",
  "Angļu valoda",
  "Datorzinātne",
  "Vizuālā māksla",
];

export function SubjectGrid() {
  return (
    <section className="py-24 bg-surface/30">
      <div className="max-w-5xl mx-auto px-6 text-center">
        <h2 className="text-3xl md:text-5xl font-heading font-bold text-white mb-4">
          Priekšmeti
        </h2>
        <p className="text-white/60 mb-12">6.–12. klase</p>

        <div className="flex flex-wrap justify-center gap-3">
          {SUBJECTS.map((subject, idx) => (
            <span
              key={idx}
              className="px-6 py-3 rounded-full bg-surface border border-border text-sm font-medium text-white hover:border-primary/50 transition-colors cursor-default"
            >
              {subject}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
