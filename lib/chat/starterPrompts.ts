export interface StarterPrompt {
  text: string; // The Latvian question shown to user
  subject: string; // e.g. "Fizika"
  grades: number[]; // Which grades this is appropriate for
  subjectEmoji: string;
}

export const starterPrompts: StarterPrompt[] = [
  // Matemātika
  {
    text: "Kā atrisina kvadrātvienādojumu ar diskriminantu?",
    subject: "Matemātika",
    grades: [9, 10, 11],
    subjectEmoji: "📐",
  },
  {
    text: "Kāda ir Pitagora teorēma un kā to pielieto trīsstūros?",
    subject: "Matemātika",
    grades: [6, 7, 8],
    subjectEmoji: "📐",
  },
  {
    text: "Kā aprēķina funkcijas atvasinājumu un ko tas izsaka?",
    subject: "Matemātika",
    grades: [11, 12],
    subjectEmoji: "📐",
  },
  {
    text: "Ko nozīmē sinuss un kosinuss taisnleņķa trijstūrī?",
    subject: "Matemātika",
    grades: [8, 9, 10],
    subjectEmoji: "📐",
  },

  // Fizika
  {
    text: "Kas ir Ņūtona pirmais kustības likums un ko tas nozīmē praksē?",
    subject: "Fizika",
    grades: [8, 9, 10],
    subjectEmoji: "⚡",
  },
  {
    text: "Kā aprēķina elektrisko strāvu, izmantojot Oma likumu?",
    subject: "Fizika",
    grades: [9, 10, 11],
    subjectEmoji: "⚡",
  },
  {
    text: "Paskaidro brīvās krišanas paātrinājumu un kā to aprēķina",
    subject: "Fizika",
    grades: [8, 9, 10],
    subjectEmoji: "⚡",
  },
  {
    text: "Kas ir kinētiskā un potenciālā enerģija un kā tās savstarpēji pārveidojas?",
    subject: "Fizika",
    grades: [8, 9, 10, 11],
    subjectEmoji: "⚡",
  },

  // Ķīmija
  {
    text: "Kas ir ķīmiskā reakcija un kādi ir tās galvenie veidi?",
    subject: "Ķīmija",
    grades: [8, 9, 10],
    subjectEmoji: "🧪",
  },
  {
    text: "Kā darbojas oksidēšanās un reducēšanās reakcijas?",
    subject: "Ķīmija",
    grades: [10, 11, 12],
    subjectEmoji: "🧪",
  },
  {
    text: "Ko nozīmē vielas molmasa un kā to aprēķina?",
    subject: "Ķīmija",
    grades: [9, 10, 11],
    subjectEmoji: "🧪",
  },

  // Bioloģija
  {
    text: "Kā norit fotosintēze un kāpēc tā ir svarīga augu dzīvē?",
    subject: "Bioloģija",
    grades: [7, 8, 9, 10],
    subjectEmoji: "🌿",
  },
  {
    text: "Kas ir DNS un kādā veidā tā nosaka iedzimtību?",
    subject: "Bioloģija",
    grades: [10, 11, 12],
    subjectEmoji: "🌿",
  },
  {
    text: "Paskaidro, kā darbojas cilvēka asinsrites sistēma",
    subject: "Bioloģija",
    grades: [8, 9, 10],
    subjectEmoji: "🌿",
  },

  // Latvijas vēsture
  {
    text: "Kādi notikumi noveda pie Latvijas neatkarības pasludināšanas 1918. gadā?",
    subject: "Latvijas vēsture",
    grades: [8, 9, 10, 11, 12],
    subjectEmoji: "🏛️",
  },
  {
    text: "Kas bija 1991. gada barikādes un kāda bija to nozīme?",
    subject: "Latvijas vēsture",
    grades: [9, 10, 11, 12],
    subjectEmoji: "🏛️",
  },
  {
    text: "Kā notika Latvijas padomju okupācija 1940. gadā un kādas bija tās sekas?",
    subject: "Latvijas vēsture",
    grades: [9, 10, 11, 12],
    subjectEmoji: "🏛️",
  },

  // Latviešu valoda
  {
    text: "Kādi ir galvenie teikuma locekļi un kā tos atpazīt teikumā?",
    subject: "Latviešu valoda",
    grades: [6, 7, 8],
    subjectEmoji: "📝",
  },
  {
    text: "Kad teikumā pirms 'un' un 'bet' ir jāliek komats?",
    subject: "Latviešu valoda",
    grades: [7, 8, 9, 10],
    subjectEmoji: "📝",
  },
  {
    text: "Kāda ir atšķirība starp tiešo un netiešo runu?",
    subject: "Latviešu valoda",
    grades: [8, 9, 10],
    subjectEmoji: "📝",
  },

  // Dabaszinības
  {
    text: "Kā veidojas lietus un kāpēc mākoņi izskatās dažādi?",
    subject: "Dabaszinības",
    grades: [6, 7],
    subjectEmoji: "🌍",
  },
  {
    text: "Paskaidro ūdens aprites ciklu dabā",
    subject: "Dabaszinības",
    grades: [6, 7, 8],
    subjectEmoji: "🌍",
  },
  {
    text: "Kādas enerģijas veidi pastāv un kā viens pārveidojas otrā?",
    subject: "Dabaszinības",
    grades: [6, 7, 8],
    subjectEmoji: "🌍",
  },
];
