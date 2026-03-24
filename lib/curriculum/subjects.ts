/**
 * VIIS subject/course data — sourced from data.gov.lv (CC0 license).
 * Used for subject routing, UI dropdowns, and meta-questions.
 * NOT used as RAG content.
 *
 * Re-generate the JSON by running: python scripts/fetch_viis.py
 */

import viisData from '../../data/viis-subjects.json'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ViisSubject {
  id: number
  name: string
  oceIndex: string | null
}

export interface ViisCourse {
  id: number
  name: string
  level: 'Pamatkurss' | 'Padziļinātais kurss' | 'Specializētais kurss' | string
  authority: string
  domain: string | null
  subjectName: string
}

// ─── Exported data ────────────────────────────────────────────────────────────

export const subjects: ViisSubject[] = viisData.subjects as ViisSubject[]
export const standardCourses: ViisCourse[] = viisData.standardCourses as ViisCourse[]
export const allCourses: ViisCourse[] = viisData.allCourses as ViisCourse[]
export const domains: string[] = viisData.domains

// ─── RAG filter key mapping ───────────────────────────────────────────────────
// Maps VIIS subject/course name fragments → RAG collection filter key (subject_id).
// These keys must match the SUBJECT_MAP in RAG.py and ingest_*.py scripts.

export const VIIS_TO_RAG_SUBJECT: Record<string, string> = {
  // Sciences
  'fizika': 'physics',
  'ķīmija': 'chemistry',
  'bioloģija': 'biology',
  'ģeogrāfija': 'geography',
  'dabaszinības': 'science',
  'astronomija': 'astronomy',

  // Math
  'matemātika': 'math',
  'diskrētās matemātikas': 'math',
  'kompleksie skaitļi': 'math',
  'projicēšanas metodes': 'math',

  // Social / Civic
  'vēsture': 'history',
  'sociālās zinātnes': 'social_sciences',
  'sociālās zinības': 'social_studies',
  'filozofija': 'social_sciences',
  'politika': 'social_studies',
  'uzņēmējdarbības': 'social_studies',
  'novadu mācība': 'social_studies',

  // Languages
  'latviešu valoda': 'latvian',
  'literatūra': 'latvian_literature',
  'latviešu valoda un literatūra': 'latvian_literature',
  'mazākumtautības valoda': 'russian',
  'svešvaloda': 'english',
  'radošā rakstīšana': 'latvian_literature',

  // Tech / CS
  'datorika': 'informatics',
  'programmēšana': 'programming',
  'robotika': 'engineering',
  'dizains un tehnoloģijas': 'design_tech',
  'digitālais dizains': 'design_tech',

  // Arts / Culture
  'kultūra un māksla': 'arts',
  'kultūras pamati': 'culture',
  'vizuāli plastiskā māksla': 'visual_arts',
  'kolektīvā muzicēšana': 'music',
  'teātris un drāma': 'theater',
  'publiskā uzstāšanās': 'arts',

  // Sports / Health
  'sports un veselība': 'sports',
  'valsts aizsardzības mācība': 'sports',
}

// ─── Lookup functions ─────────────────────────────────────────────────────────

/**
 * Returns all standard courses grouped under a given learning domain.
 */
export function getCoursesByDomain(domain: string): ViisCourse[] {
  return standardCourses.filter(c => c.domain === domain)
}

/**
 * Returns all standard courses for a given subject name (exact or partial match).
 */
export function getCoursesBySubject(subjectName: string): ViisCourse[] {
  const lower = subjectName.toLowerCase()
  return standardCourses.filter(c => c.subjectName.toLowerCase().includes(lower))
}

/**
 * Normalizes free-text student input to a RAG filter key.
 * e.g. "fizika" → "physics", "Matemātika II" → "math"
 * Returns null if no match — caller should skip subject filter.
 */
export function normalizeSubjectToRagKey(input: string): string | null {
  const lower = input.toLowerCase().trim()

  for (const [fragment, ragKey] of Object.entries(VIIS_TO_RAG_SUBJECT)) {
    if (lower.includes(fragment)) return ragKey
  }

  return null
}

/**
 * Returns the official VIIS course name closest to a student's input,
 * or null if no standard course matches.
 */
export function findOfficialCourseName(input: string): string | null {
  const lower = input.toLowerCase()
  const match = standardCourses.find(c =>
    c.name.toLowerCase().includes(lower) || lower.includes(c.subjectName.toLowerCase())
  )
  return match ? match.name : null
}

/**
 * Returns all unique learning domains from standard courses.
 */
export function getDomains(): string[] {
  return domains
}

/**
 * Detects whether a query is a meta-question about the curriculum
 * (structure, available courses, requirements) rather than content.
 * If true, the chain should answer from VIIS data directly (Path D).
 */
export function isMetaQuestion(query: string): boolean {
  const lower = query.toLowerCase()
  const metaPatterns = [
    'kādi kursi', 'kādus kursus', 'kādi priekšmeti', 'kādus priekšmetus',
    'vai .* ir obligāt', 'obligātais', 'padziļinātais vai',
    'kādā mācību jomā', 'mācību joma',
    'cik kursi', 'kāds kurss', 'standarta kurss',
    'skola2030', 'programmā ietilpst', 'mācību programmā',
  ]
  return metaPatterns.some(p => new RegExp(p).test(lower))
}

/**
 * Generates a plain-text answer to a meta-question from VIIS data.
 * Used in Path D — no LLM call needed.
 */
export function answerMetaQuestion(query: string): string | null {
  const lower = query.toLowerCase()

  // "kādi fizika kursi pastāv?"
  for (const [fragment, ragKey] of Object.entries(VIIS_TO_RAG_SUBJECT)) {
    if (lower.includes(fragment)) {
      const courses = standardCourses.filter(c =>
        c.name.toLowerCase().includes(fragment) ||
        c.subjectName.toLowerCase().includes(fragment)
      )
      if (courses.length === 0) return null

      const lines = courses.map(c => `• ${c.name} (${c.level})`)
      return `Standarta Skola2030 kursi šajā jomā:\n${lines.join('\n')}`
    }
  }

  // "kādi kursi ir Dabaszinātņu mācību jomā?"
  for (const domain of domains) {
    if (lower.includes(domain.toLowerCase().replace(' mācību joma', ''))) {
      const courses = getCoursesByDomain(domain)
      if (courses.length === 0) return null
      const lines = courses.map(c => `• ${c.name} (${c.level})`)
      return `Standarta kursi — ${domain}:\n${lines.join('\n')}`
    }
  }

  return null
}
