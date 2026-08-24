#!/usr/bin/env python3
"""Enrich dirigeants.csv with a publicly-published company contact email.

Takes the CSV produced by recherche_dirigeants.py and, for each unique
company, uses the ScrapeGraph API (https://scrapegraphai.com) to:
  1. search for the company's official website,
  2. scrape its homepage/contact page,
  3. pull out any email address the company itself has published there.

This can only ever find a *generic* company address (contact@, info@,
sometimes a named one if the company chose to publish it) — never a
personal email that isn't already public. If nothing is published, the
column stays empty; this script does not guess or fabricate addresses.

Requires SGAI_API_KEY in the environment. Get one at
https://dashboard.scrapegraphai.com — never hardcode it in this file or
commit it anywhere.

Usage:
    export SGAI_API_KEY=sgai-xxxxxxxx
    python enrich_emails.py dirigeants.csv -o dirigeants_enrichis.csv
"""

from __future__ import annotations

import argparse
import csv
import os
import re
import sys
import time
from typing import Any, Iterator
from urllib.parse import urlparse

import httpx

API_BASE_URL = os.environ.get("SGAI_API_URL", "https://v2-api.scrapegraphai.com/api")

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
URL_RE = re.compile(r"https?://[^\s)\"'<>]+")

# Directories/aggregators/socials that are never the company's own site.
DOMAIN_BLOCKLIST = (
    "linkedin.com", "facebook.com", "twitter.com", "x.com", "instagram.com",
    "societe.com", "pappers.fr", "infogreffe.fr", "kompass.com", "europages.fr",
    "wikipedia.org", "google.com", "youtube.com", "annuaire-entreprises.data.gouv.fr",
)


def iter_strings(obj: Any) -> Iterator[str]:
    """Walk an arbitrary JSON structure and yield every string leaf.

    The exact response schema for /search and /scrape isn't pinned down here
    (untested against the live API from this environment — no outbound
    network access). Walking generically means this keeps working even if
    the result is nested differently than expected; run with --debug to
    inspect the raw shape on your first request.
    """
    if isinstance(obj, str):
        yield obj
    elif isinstance(obj, dict):
        for v in obj.values():
            yield from iter_strings(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from iter_strings(v)


def call_api(client: httpx.Client, path: str, body: dict[str, Any]) -> dict[str, Any]:
    resp = client.post(f"{API_BASE_URL}{path}", json=body)
    resp.raise_for_status()
    return resp.json()


def find_official_site(client: httpx.Client, entreprise: str, ville: str) -> str | None:
    query = f"site officiel {entreprise} {ville} France".strip()
    data = call_api(client, "/search", {
        "query": query,
        "numResults": 3,
        "format": "markdown",
        "mode": "prune",
    })
    for text in iter_strings(data):
        for url in URL_RE.findall(text):
            domain = urlparse(url).netloc.lower()
            if domain and not any(blocked in domain for blocked in DOMAIN_BLOCKLIST):
                return f"{urlparse(url).scheme}://{domain}"
    return None


def find_email_on_site(client: httpx.Client, site_url: str) -> str | None:
    domain = urlparse(site_url).netloc.lower().removeprefix("www.")
    candidates = [site_url, f"{site_url.rstrip('/')}/contact", f"{site_url.rstrip('/')}/mentions-legales"]
    for page_url in candidates:
        try:
            data = call_api(client, "/scrape", {
                "url": page_url,
                "formats": [{"type": "markdown", "mode": "normal"}],
            })
        except httpx.HTTPStatusError:
            continue
        emails = set()
        for text in iter_strings(data):
            emails.update(EMAIL_RE.findall(text))
        on_domain = [e for e in emails if domain in e.lower()]
        if on_domain:
            return sorted(on_domain)[0]
        if emails:
            return sorted(emails)[0]
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("input_csv", help="CSV produit par recherche_dirigeants.py")
    parser.add_argument("-o", "--output", default="dirigeants_enrichis.csv")
    parser.add_argument("--delay", type=float, default=1.0, help="Delai (s) entre entreprises, pour rester raisonnable")
    parser.add_argument("--debug", action="store_true", help="Affiche la reponse brute de la premiere requete")
    args = parser.parse_args()

    api_key = os.environ.get("SGAI_API_KEY")
    if not api_key:
        print("SGAI_API_KEY n'est pas definie. export SGAI_API_KEY=sgai-... puis reessayez.", file=sys.stderr)
        return 1

    with open(args.input_csv, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    if not rows:
        print("CSV d'entree vide.", file=sys.stderr)
        return 1

    fieldnames = list(rows[0].keys())
    for col in ("site_web", "email_public"):
        if col not in fieldnames:
            fieldnames.append(col)

    site_cache: dict[str, tuple[str | None, str | None]] = {}
    headers = {"SGAI-APIKEY": api_key}

    with httpx.Client(headers=headers, timeout=30) as client:
        for i, row in enumerate(rows):
            entreprise = row.get("entreprise", "")
            if not entreprise:
                continue
            if entreprise not in site_cache:
                print(f"[{i+1}/{len(rows)}] {entreprise}...", file=sys.stderr)
                try:
                    site = find_official_site(client, entreprise, row.get("ville", ""))
                    email = find_email_on_site(client, site) if site else None
                except httpx.HTTPError as exc:
                    print(f"  erreur API: {exc}", file=sys.stderr)
                    site, email = None, None
                site_cache[entreprise] = (site, email)
                time.sleep(args.delay)
            site, email = site_cache[entreprise]
            row["site_web"] = site or ""
            row["email_public"] = email or ""

    with open(args.output, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    found = sum(1 for r in rows if r.get("email_public"))
    print(f"Ecrit: {args.output} ({found}/{len(rows)} lignes avec un email public trouve)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
