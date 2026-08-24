# Finance decision-makers finder (données publiques)

Deux scripts, en deux temps :

1. **`recherche_dirigeants.py`** — interroge
   [recherche-entreprises.api.gouv.fr](https://recherche-entreprises.api.gouv.fr)
   (API officielle du gouvernement français, gratuite, sans clé) pour
   récupérer les dirigeants légaux (Président, DG, Gérant...) d'entreprises
   du secteur finance, à partir des codes NAF/APE. Ces données sont
   publiques par la loi (RCS).

2. **`enrich_emails.py`** — optionnel, nécessite une clé API ScrapeGraph
   (`SGAI_API_KEY`). Pour chaque entreprise trouvée, cherche son site
   officiel et tente d'y récupérer un email de contact **que l'entreprise a
   elle-même publié** (contact@, info@...). Ne devine ni n'achète aucune
   adresse.

## Ce que ça produit — et ce que ça ne produit pas

| Colonne | Contenu | Fiabilité |
|---|---|---|
| `prenom`, `nom`, `qualite` | Dirigeant légal (RCS) | Fiable, donnée publique officielle |
| `entreprise`, `siren`, `ville`, `code_naf` | Identité de l'entreprise | Fiable |
| `site_web` | Site officiel détecté (heuristique) | À vérifier — détection automatique, pas garantie |
| `email_public` | Email publié sur le site de l'entreprise | **Générique dans la majorité des cas**, pas une adresse nominative vérifiée |

Aucune de ces sources ne fournit d'adresse email personnelle vérifiée pour
un individu nommé — cette donnée n'est simplement pas publique. Pour une
adresse nominative fiable, il faut soit que la personne l'ait publiée
elle-même quelque part, soit passer par un fournisseur d'enrichissement B2B
dédié (Hunter.io, Apollo.io...) qui vérifie ses données.

## Installation

```bash
pip install -r requirements.txt
```

## Usage

```bash
# Étape 1 : dirigeants (gratuit, sans clé)
python recherche_dirigeants.py --secteur assurance --limit 50 -o dirigeants.csv

# Secteurs prédéfinis : banque, assurance, gestion_actifs, credit,
# conseil_patrimoine, finance_generale (par défaut)
# Ou codes NAF explicites :
python recherche_dirigeants.py --naf 64.19Z 64.20Z --limit 50 --departement 75

# Étape 2 (optionnelle) : enrichissement email public
export SGAI_API_KEY=sgai-xxxxxxxx   # ne jamais commiter cette clé
python enrich_emails.py dirigeants.csv -o dirigeants_enrichis.csv
```

## Limitations connues

- `enrich_emails.py` n'a pas pu être testé contre l'API ScrapeGraph en
  conditions réelles depuis l'environnement où il a été écrit (accès réseau
  sortant bloqué par la politique du sandbox). Le parsing des réponses
  `/search` et `/scrape` est fait de façon générique (parcours récursif du
  JSON) pour rester robuste si la forme exacte diffère de l'hypothèse —
  lancez avec `--debug` et vérifiez `dirigeants_enrichis.csv` sur un petit
  échantillon avant de lancer sur les 50 lignes.
- L'API recherche-entreprises.api.gouv.fr peut faire évoluer ses noms de
  champs ; si `recherche_dirigeants.py` ne renvoie aucun résultat, vérifiez
  la doc à jour : https://api.gouv.fr/documentation/api-recherche-entreprises

## RGPD

Les noms de dirigeants et emails d'entreprise récupérés ici sont publics.
Si vous les utilisez pour de la prospection (démarchage B2B), restez dans
le cadre légal : base légale d'intérêt légitime, information des
personnes, droit d'opposition simple (lien de désinscription), pas de
réutilisation pour un usage incompatible avec la source.
