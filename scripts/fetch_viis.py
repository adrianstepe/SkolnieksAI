"""
fetch_viis.py — Download VIIS subject/course data from data.gov.lv and save as JSON.

Data source: Valsts izglītības informācijas sistēma (VIIS), CC0 license
Run from project root: python scripts/fetch_viis.py
Output: data/viis-subjects.json
"""

import json
import os
import sys
import requests
from io import StringIO

try:
    import pandas as pd
except ImportError:
    print("pandas not installed. Run: pip install pandas requests")
    sys.exit(1)

VIIS_URLS = {
    "subjects": "https://data.gov.lv/dati/dataset/f7fbd98b-6f14-4eef-b17b-809732a9373d/resource/d8abada6-95b4-444b-a93e-980f6434d5b9/download/klasif_viisesosiemacibuprieksmeti.csv",
    "courses": "https://data.gov.lv/dati/dataset/f7fbd98b-6f14-4eef-b17b-809732a9373d/resource/43fbad15-d26c-4b88-8804-4f1795738b38/download/klasif_viisesosiemacibuprieksmetukursi.csv",
}

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "viis-subjects.json")


def fetch_csv(url: str) -> pd.DataFrame:
    print(f"  Fetching {url.split('/')[-1]}...")
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    # Try UTF-8 first, fall back to latin-1
    try:
        return pd.read_csv(StringIO(r.content.decode("utf-8")))
    except UnicodeDecodeError:
        return pd.read_csv(StringIO(r.content.decode("latin-1")))


def build_json(subjects_df: pd.DataFrame, courses_df: pd.DataFrame) -> dict:
    # --- Subjects ---
    subjects = []
    for _, row in subjects_df.iterrows():
        oce_raw = row.get("OCE_indeksacijai", "")
        oce = str(oce_raw).strip() if pd.notna(oce_raw) and str(oce_raw).strip() not in ("", "nan") else None
        subjects.append({
            "id": int(row["Macibu_prieksmeta_ID"]),
            "name": str(row["Macibu_prieksmeta_nosaukums"]).strip(),
            "oceIndex": oce,
        })

    # --- Standard courses only (Skola2030-aligned, Autoriba = "Standarta kurss") ---
    standard_courses = []
    all_courses = []
    domains_seen = set()

    for _, row in courses_df.iterrows():
        course_id = int(row["Macibu_prieksmeta_ID"])
        name = str(row["Macibu_prieksmeta_kursa_nosaukums"]).strip()
        level = str(row.get("Kursa_veids", "")).strip()
        authority = str(row.get("Autoriba", "")).strip()
        domain = str(row.get("Macibu_joma", "")).strip()

        # Find parent subject name
        subject_match = subjects_df[subjects_df["Macibu_prieksmeta_ID"] == course_id]
        subject_name = subject_match.iloc[0]["Macibu_prieksmeta_nosaukums"].strip() if not subject_match.empty else ""

        course_obj = {
            "id": course_id,
            "name": name,
            "level": level,
            "authority": authority,
            "domain": domain if domain else None,
            "subjectName": subject_name,
        }
        all_courses.append(course_obj)

        if authority == "Standarta kurss" and domain:
            standard_courses.append(course_obj)
            domains_seen.add(domain)

    domains = sorted(domains_seen)

    return {
        "_comment": "Generated from VIIS data.gov.lv — CC0 license. Do not edit manually, run scripts/fetch_viis.py",
        "subjects": subjects,
        "standardCourses": standard_courses,
        "allCourses": all_courses,
        "domains": domains,
    }


def main():
    print("Fetching VIIS data from data.gov.lv...")
    subjects_df = fetch_csv(VIIS_URLS["subjects"])
    courses_df = fetch_csv(VIIS_URLS["courses"])

    print(f"  Subjects: {len(subjects_df)} rows")
    print(f"  Courses:  {len(courses_df)} rows")

    data = build_json(subjects_df, courses_df)

    print(f"\nStandard (Skola2030-aligned) courses: {len(data['standardCourses'])}")
    print(f"Domains: {len(data['domains'])} domains found")

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"\nSaved to: {os.path.abspath(OUTPUT_PATH)}")


if __name__ == "__main__":
    main()
