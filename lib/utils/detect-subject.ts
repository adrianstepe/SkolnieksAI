const KEYWORDS: Record<string, string[]> = {
  math: [
    "vienādojums", "funkcija", "integrālis", "atvasinājums", "matrica",
    "trigonometrija", "sinuss", "kosinuss", "logaritms", "kvadrāts",
    "sakne", "skaitlis", "formulas", "aprēķins", "algebra",
    "ģeometrija", "laukums", "tilpums", "leņķis", "trijstūris",
    "riņķis", "statistika", "varbūtība", "procenti", "decimāldaļa",
  ],
  physics: [
    "spēks", "ātrums", "paātrinājums", "enerģija", "jauda",
    "viļņi", "elektrība", "magnētisms", "gaisma", "kodolfizika",
    "mehānika", "kinētiskā", "potenciālā", "frekvence", "pretestība",
    "spriegums", "strāva", "optika", "termodinamika", "masa",
    "blīvums", "gravitācija", "impulss", "moments", "newton",
  ],
  chemistry: [
    "atoms", "molekula", "reakcija", "elements", "savienojums",
    "skābe", "bāze", "sāls", "oksidēšana", "reducēšana",
    "periodiskā", "elektrons", "protons", "neitrons", "kovalentā",
    "jonu", "metāls", "nemetāls", "organiskā", "polimērs",
    "katalizators", "ph", "titrēšana", "formula", "viela",
  ],
  biology: [
    "šūna", "organisms", "evolūcija", "gēns", "dns",
    "fotosintēze", "hlorofils", "ekosistēma", "populācija", "sēnes",
    "baktērija", "vīruss", "augs", "dzīvnieks", "cilvēks",
    "elpošana", "asinsrite", "nervu", "imūnsistēma", "šūndalīšanās",
    "bioloģija", "vide", "sugas", "mutācija", "proteīns",
  ],
  history: [
    "karš", "revolūcija", "vēsture", "neatkarība", "okupācija",
    "impērija", "civilizācija", "kultūra", "politika", "viduslaiki",
    "padomju", "vācu", "krievu", "vēsturiskais", "valdnieks",
    "parlaments", "valsts", "hronoloģija", "notikums", "līgums",
    "reformācija", "pirmais pasaules", "otrais pasaules", "rīga", "latvija",
  ],
  geography: [
    "karte", "klimats", "kontinents", "okeāns", "upe",
    "kalns", "iedzīvotāji", "ekonomika", "reģions", "eiropa",
    "āzija", "āfrika", "laika apstākļi", "temperatūra", "nokrišņi",
    "augstums", "jūra", "ezers", "purvs", "mežs",
    "lauksaimniecība", "pilsēta", "robeža", "latvija", "karte",
  ],
  latvian: [
    "gramatika", "teikums", "darbības vārds", "lietvārds", "īpašības vārds",
    "sintakse", "locīšana", "konjugācija", "literatūra", "dzejolis",
    "romāns", "autors", "stilistika", "interpunkcija", "pareizrakstība",
    "morfoloģija", "fonētika", "dialekts", "teksts", "analīze",
    "saliktenis", "priedēklis", "piedēklis", "galotne", "raksturs",
  ],
  english: [
    "grammar", "tense", "vocabulary", "essay", "reading",
    "writing", "listening", "speaking", "verb", "noun",
    "adjective", "preposition", "passive", "conditional", "reported speech",
    "article", "phrasal verb", "idiom", "pronunciation", "angļu",
    "ingliz", "english", "tenses", "sentence", "spelling",
  ],
  informatics: [
    "algoritms", "programmēšana", "kods", "python", "java",
    "datu bāze", "tīkls", "internets", "skaitļošana", "mainīgais",
    "cikls", "masīvs", "klase", "objekts", "rekursija",
    "sql", "html", "css", "javascript", "operētājsistēma",
    "failu sistēma", "binārais", "šifrēšana", "datorzinātne", "funkcija",
  ],
  art: [
    "glezna", "zīmējums", "kompozīcija", "krāsa", "forma",
    "tekstūra", "māksla", "skulptūra", "grafika", "dizains",
    "fotogrāfija", "arhitektūra", "stils", "tehnika", "perspektīva",
    "kolorīts", "portrets", "ainava", "abstrakts", "mākslinieks",
    "glezniecība", "akvarele", "eļļas krāsas", "tēlniecība", "mozaīka",
  ],
};

export function detectSubject(text: string): string | null {
  const lower = text.toLowerCase();

  const scores: Record<string, number> = {};

  for (const [subject, keywords] of Object.entries(KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) score++;
    }
    scores[subject] = score;
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [first, second] = sorted;

  // Require score >= 2 and a clear winner (no tie at the top)
  if (!first || first[1] < 2) return null;
  if (second && second[1] === first[1]) return null;

  return first[0];
}
