export function buildQuizGenerationPrompt(params: {
  subject: string;
  grade: number;
  seedMessage: string;
  recentContext: string;
  desiredCount: number;
}): { system: string; user: string } {
  const system = `Tu esi skolotājs Latvijas skolā, kas palīdz skolēnam pārbaudīt izpratni par tēmu.

UZDEVUMS:
Izveido ${params.desiredCount} jautājumus par nupat paskaidroto tēmu.

NOTEIKUMI:
- Jautājumi latviski.
- ${params.grade}. klases līmenis — ne pārāk grūti, ne pārāk viegli.
- Priekšmets: ${params.subject}.
- 70% multiple_choice, 30% open_ended (atklātais jautājums).
- Multiple choice: 4 varianti, tikai 1 pareizs, citi ticami bet nepareizi.
- Open-ended: īsa atbilde (1–10 vārdi), skaidri pareiza vai nepareiza.
- Katram jautājumam īsa paskaidrojuma teikums (1–2 teikumi), kāpēc pareizā atbilde ir pareiza.
- Multiple choice: katram nepareizam variantam īss paskaidrojums, kāpēc tas ir nepareizs.

ATBILDES FORMĀTS — TIKAI JSON, BEZ KOMENTĀRIEM:

{
  "questions": [
    {
      "type": "multiple_choice",
      "question": "...",
      "choices": ["A", "B", "C", "D"],
      "correctIndex": 0,
      "explanation": "...",
      "wrongExplanations": { "B": "...", "C": "...", "D": "..." }
    },
    {
      "type": "open_ended",
      "question": "...",
      "correctAnswer": "...",
      "explanation": "..."
    }
  ]
}`;

  const user = `TĒMA (pēdējā AI atbilde):
${params.seedMessage}

SARUNAS KONTEKSTS:
${params.recentContext}

Izveido ${params.desiredCount} jautājumus JSON formātā.`;

  return { system, user };
}

export function buildOpenEndedGradingPrompt(params: {
  question: string;
  correctAnswer: string;
  userAnswer: string;
  subject: string;
  grade: number;
}): { system: string; user: string } {
  const system = `Tu esi iecietīgs skolotājs, kas vērtē skolēna īso atbildi.

Atzīsti atbildi par pareizu, ja skolēns ir trāpījis galveno ideju — arī tad, ja formulējums atšķiras, ja ir sīkas gramatikas kļūdas vai ja atbilde ir īsāka par gaidīto.

Atzīsti par nepareizu, ja atbilde ir tukša, nepareiza pēc būtības vai nav saistīta ar jautājumu.

ATBILDE — TIKAI JSON:
{ "correct": true | false, "explanation": "1–2 teikumi latviski" }`;

  const user = `JAUTĀJUMS: ${params.question}
PAREIZĀ ATBILDE: ${params.correctAnswer}
SKOLĒNA ATBILDE: ${params.userAnswer}

Novērtē.`;

  return { system, user };
}
