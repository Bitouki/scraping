#!/usr/bin/env python3
"""Find finance-sector decision makers from French public company registries.

Data source: recherche-entreprises.api.gouv.fr — the official French
government open-data API (free, no API key). It exposes RCS (Registre du
Commerce et des Societes) data, which by law includes each company's legal
representatives ("dirigeants": President, Directeur General, Gerant...).

What this does NOT do: guess, buy, or scrape personal email addresses. RCS
data has no email field. Use enrich_emails.py afterwards if you want to
attempt to attach a *company* contact address that the company itself
publishes on its own public website (still not a personal address).

Usage:
    python recherche_dirigeants.py --secteur assurance --limit 50 -o dirigeants.csv
    python recherche_dirigeants.py --naf 64.19Z 64.20Z --limit 50 --departement 75
"""

from __future__ import annotations

import argparse
import csv
import sys
import time
import unicodedata
from typing import Any

import httpx

API_URL = "https://recherche-entreprises.api.gouv.fr/search"

# NAF/APE codes (Rev. 2) covering the finance sector, grouped by sub-sector.
NAF_CODES: dict[str, list[str]] = {
    "banque": ["64.19Z", "64.20Z"],
    "assurance": ["65.11Z", "65.12Z", "66.22Z"],
    "gestion_actifs": ["64.30Z", "66.30Z"],
    "credit": ["64.91Z", "64.92Z"],
    "conseil_patrimoine": ["66.19A", "66.19B"],
    "finance_generale": [
        "64.19Z", "64.20Z", "64.30Z", "64.91Z", "64.92Z", "64.99Z",
        "65.11Z", "65.12Z", "66.19A", "66.19B", "66.22Z", "66.30Z",
    ],
}

DECISION_KEYWORDS = (
    "president", "directeur general", "directrice generale",
    "gerant", "gerante", "membre du directoire",
)
NON_DECISION_MARKERS = ("commissaire",)


def _norm(s: str | None) -> str:
    if not s:
        return ""
    decomposed = unicodedata.normalize("NFKD", s.strip().lower())
    return "".join(c for c in decomposed if not unicodedata.combining(c))


def is_decision_role(qualite: str | None) -> bool:
    q = _norm(qualite)
    if any(marker in q for marker in NON_DECISION_MARKERS):
        return False
    return any(keyword in q for keyword in DECISION_KEYWORDS)


def fetch_companies(naf_codes: list[str], limit: int, departement: str | None) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    page = 1
    per_page = 25
    with httpx.Client(timeout=20) as client:
        while len(results) < limit:
            params: dict[str, Any] = {
                "activite_principale": ",".join(naf_codes),
                "page": page,
                "per_page": per_page,
                "etat_administratif": "A",
            }
            if departement:
                params["departement"] = departement
            resp = client.get(API_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
            batch = data.get("results", [])
            if not batch:
                break
            results.extend(batch)
            total_pages = data.get("total_pages", page)
            if page >= total_pages:
                break
            page += 1
            time.sleep(0.3)
    return results[:limit]


def extract_dirigeants(companies: list[dict[str, Any]], only_decision_roles: bool) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for company in companies:
        siege = company.get("siege") or {}
        nom_entreprise = company.get("nom_complet") or company.get("nom_raison_sociale") or ""
        siren = company.get("siren", "")
        ville = siege.get("libelle_commune", "")
        naf = company.get("activite_principale", "")

        for dirigeant in company.get("dirigeants") or []:
            qualite = dirigeant.get("qualite", "")
            if only_decision_roles and not is_decision_role(qualite):
                continue
            rows.append({
                "prenom": dirigeant.get("prenoms", dirigeant.get("prenom", "")),
                "nom": dirigeant.get("nom", ""),
                "qualite": qualite,
                "entreprise": nom_entreprise,
                "siren": siren,
                "ville": ville,
                "code_naf": naf,
                "site_web": "",
                "email_public": "",
                "source": "recherche-entreprises.api.gouv.fr (RCS, donnee publique)",
            })
    return rows


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--secteur", choices=sorted(NAF_CODES), default="finance_generale",
                         help="Sous-secteur finance predefini (voir NAF_CODES)")
    parser.add_argument("--naf", nargs="+", help="Codes NAF explicites, remplace --secteur")
    parser.add_argument("--departement", help="Filtrer par departement (ex: 75)")
    parser.add_argument("--limit", type=int, default=50, help="Nombre d'entreprises a interroger")
    parser.add_argument("--all-roles", action="store_true",
                         help="Inclure tous les dirigeants, pas seulement les roles decisionnaires")
    parser.add_argument("-o", "--output", default="dirigeants.csv", help="Fichier CSV de sortie")
    args = parser.parse_args()

    naf_codes = args.naf if args.naf else NAF_CODES[args.secteur]

    print(f"Recherche sur recherche-entreprises.api.gouv.fr — NAF: {naf_codes}, limite: {args.limit}",
          file=sys.stderr)
    try:
        companies = fetch_companies(naf_codes, args.limit, args.departement)
    except httpx.HTTPError as exc:
        print(f"Erreur API: {exc}", file=sys.stderr)
        return 1

    print(f"{len(companies)} entreprises recuperees.", file=sys.stderr)
    rows = extract_dirigeants(companies, only_decision_roles=not args.all_roles)
    print(f"{len(rows)} dirigeants extraits.", file=sys.stderr)

    if not rows:
        print("Aucun resultat. Verifiez les codes NAF / le departement, ou lancez avec --all-roles.",
              file=sys.stderr)
        return 0

    fieldnames = list(rows[0].keys())
    with open(args.output, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Ecrit: {args.output}", file=sys.stderr)
    print("NB: pas d'email individuel dans cette source (donnee RCS). "
          "Utilisez enrich_emails.py pour ajouter un email public d'entreprise, s'il existe.",
          file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
