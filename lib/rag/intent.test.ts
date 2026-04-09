import { describe, it, expect } from "vitest";
import { classifyIntent, shouldSkipRag, shouldSkipWebSearch, getWebSearchDomainStrategy } from "./intent";

// ── classifyIntent ───────────────────────────────────────────────────────────

describe("classifyIntent — GENERATIVE", () => {
  it("G1: arithmetic expression", () => {
    expect(classifyIntent("2 + 2 = ?").intent).toBe("GENERATIVE");
    expect(classifyIntent("2 + 2 = ?").matchedRule).toBe("G1:math_expr");
  });

  it("G2: LaTeX delimiters", () => {
    expect(classifyIntent("Atrisini $x^2 + 1 = 0$").intent).toBe("GENERATIVE");
  });

  it("G3: Unicode math symbol", () => {
    expect(classifyIntent("Aprēķini √144").intent).toBe("GENERATIVE");
    expect(classifyIntent("Kāda ir π vērtība?").intent).toBe("GENERATIVE");
  });

  it("G4: code fence", () => {
    expect(classifyIntent("```python\nprint('hello')\n```").intent).toBe("GENERATIVE");
  });

  it("G4: programming keyword", () => {
    expect(classifyIntent("Uzraksti function, kas saskaita divus skaitļus").intent).toBe("GENERATIVE");
  });

  it("G5: generative verb at start", () => {
    expect(classifyIntent("Uzraksti eseju par klimatu").intent).toBe("GENERATIVE");
    expect(classifyIntent("Atrisini vienādojumu 3x + 5 = 20").intent).toBe("GENERATIVE");
    expect(classifyIntent("Aprēķini laukumu").intent).toBe("GENERATIVE");
  });

  it("G6: short greeting", () => {
    expect(classifyIntent("sveiki").intent).toBe("GENERATIVE");
    expect(classifyIntent("čau").intent).toBe("GENERATIVE");
    expect(classifyIntent("labdien!").intent).toBe("GENERATIVE");
  });

  it("G7: assistant meta-question", () => {
    expect(classifyIntent("kas tu esi?").intent).toBe("GENERATIVE");
    expect(classifyIntent("kā tev iet šodien").intent).toBe("GENERATIVE");
  });
});

describe("classifyIntent — LATVIA_SPECIFIC", () => {
  it("L1: Latvian history term", () => {
    expect(classifyIntent("Kas bija deportācijas 1941. gadā?").intent).toBe("LATVIA_SPECIFIC");
    expect(classifyIntent("Pastāsti par barikādēm 1991. gadā").intent).toBe("LATVIA_SPECIFIC");
  });

  it("L2: Latvian literature author", () => {
    expect(classifyIntent("Kas ir Rainis?").intent).toBe("LATVIA_SPECIFIC");
    expect(classifyIntent("Apraksti Aspazijas daiļradi").intent).toBe("LATVIA_SPECIFIC");
  });

  it("L3: Latvian geography", () => {
    expect(classifyIntent("Cik gara ir Daugava?").intent).toBe("LATVIA_SPECIFIC");
    expect(classifyIntent("Kur atrodas Latgale?").intent).toBe("LATVIA_SPECIFIC");
  });

  it("L4: curriculum meta", () => {
    expect(classifyIntent("Kas ir Skola2030 reforma?").intent).toBe("LATVIA_SPECIFIC");
    expect(classifyIntent("VISC centralizētais eksāmens matemātikā").intent).toBe("LATVIA_SPECIFIC");
  });

  it("L5: civics / law", () => {
    expect(classifyIntent("Ko dara Saeima?").intent).toBe("LATVIA_SPECIFIC");
    expect(classifyIntent("Kas ir Latvijas Satversme?").intent).toBe("LATVIA_SPECIFIC");
  });
});

describe("classifyIntent — STEM_FACTUAL", () => {
  it("S1: Latvian STEM term", () => {
    expect(classifyIntent("Kā darbojas fotosintēze?").intent).toBe("STEM_FACTUAL");
    expect(classifyIntent("Paskaidro, kas ir atoms").intent).toBe("STEM_FACTUAL");
    expect(classifyIntent("Kas ir gravitācija?").intent).toBe("STEM_FACTUAL");
  });

  it("S2: English STEM term in mixed query", () => {
    expect(classifyIntent("Explain photosynthesis latviski").intent).toBe("STEM_FACTUAL");
    expect(classifyIntent("What is an atom").intent).toBe("STEM_FACTUAL");
  });

  it("S3: kas ir [STEM term] pattern", () => {
    expect(classifyIntent("Kas ir atoma uzbūve?").intent).toBe("STEM_FACTUAL");
    expect(classifyIntent("Kas ir molekulas masa?").intent).toBe("STEM_FACTUAL");
  });
});

describe("classifyIntent — AMBIGUOUS", () => {
  it("falls through to AMBIGUOUS for open-ended questions", () => {
    expect(classifyIntent("Kāpēc cilvēki grib būt laimīgi?").intent).toBe("AMBIGUOUS");
    expect(classifyIntent("Kā uzrakstīt labu eseju?").intent).toBe("AMBIGUOUS");
  });
});

// ── Routing helpers ──────────────────────────────────────────────────────────

describe("shouldSkipRag", () => {
  it("skips RAG only for GENERATIVE", () => {
    expect(shouldSkipRag("GENERATIVE")).toBe(true);
    expect(shouldSkipRag("STEM_FACTUAL")).toBe(false);
    expect(shouldSkipRag("LATVIA_SPECIFIC")).toBe(false);
    expect(shouldSkipRag("AMBIGUOUS")).toBe(false);
  });
});

describe("shouldSkipWebSearch", () => {
  it("skips web for GENERATIVE and STEM_FACTUAL regardless of RAG confidence", () => {
    expect(shouldSkipWebSearch("GENERATIVE", false)).toBe(true);
    expect(shouldSkipWebSearch("STEM_FACTUAL", true)).toBe(true);
    expect(shouldSkipWebSearch("STEM_FACTUAL", false)).toBe(true);
  });

  it("does NOT skip web for LATVIA_SPECIFIC or AMBIGUOUS", () => {
    expect(shouldSkipWebSearch("LATVIA_SPECIFIC", false)).toBe(false);
    expect(shouldSkipWebSearch("AMBIGUOUS", false)).toBe(false);
  });
});

describe("getWebSearchDomainStrategy", () => {
  it("returns allowlist only for LATVIA_SPECIFIC", () => {
    expect(getWebSearchDomainStrategy("LATVIA_SPECIFIC")).toBe("allowlist");
    expect(getWebSearchDomainStrategy("STEM_FACTUAL")).toBe("open");
    expect(getWebSearchDomainStrategy("GENERATIVE")).toBe("open");
    expect(getWebSearchDomainStrategy("AMBIGUOUS")).toBe("open");
  });
});
