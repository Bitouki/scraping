# Devis Voyage — état du système

Application interne de cotisation de voyages, indépendante du serveur MCP ScrapeGraph qui
occupe le reste du dépôt. Tout vit dans `devis-voyage/`.

## Pile technique

- **PHP 7.4+**, sans framework ni dépendance (`json_*`, sessions natives, `flock`).
- Front en JavaScript natif (modules ES), sans étape de build.
- Données dans `devis-voyage/data/db.json` (hors dépôt).

Cible de déploiement : **hébergement mutualisé cPanel type o2switch**. On dépose le dossier
dans `public_html`, rien à configurer. En local : `php -S localhost:8080` depuis le dossier.

Le logiciel fonctionne indifféremment à la racine d'un domaine ou dans un sous-dossier :
toutes les URL du front sont relatives et l'API passe par un point d'entrée unique en
paramètre de requête, donc sans dépendance à `mod_rewrite`.

## Structure

| Fichier | Rôle |
|---|---|
| `index.php` | Page de connexion (redirige vers `app.php` si session ouverte) |
| `app.php` | Application, protégée par `require_page_auth()` |
| `print.php` | Page d'impression des deux documents, protégée de même |
| `api.php` | Routeur et handlers de l'API |
| `config.php` | Identifiants et nom de l'agence — le seul fichier que l'utilisateur édite |
| `lib/auth.php` | Session, vérification des identifiants |
| `lib/store.php` | Persistance JSON, CRUD, calcul des totaux |
| `js/app.js` | Navigation par ancre, dossiers clients |
| `js/providers.js` | Fenêtres ajouter / modifier / sélectionner un prestataire |
| `js/quote.js` | Éditeur de devis et barre de totaux |
| `js/print.js` | Rendu des deux documents imprimables |
| `js/ui.js` | Construction du DOM, fenêtres modales, notifications |
| `js/api.js` | Appels HTTP, formats monétaires et de dates |

## API

Un point d'entrée, `api.php?p=<route>`, en JSON. Hors `login`, `logout` et `session`, chaque
route exige une session valide et répond 401 sinon.

| Méthode | Route | Effet |
|---|---|---|
| POST | `p=login` | Ouvre une session (cookie `gdv_session`) |
| POST | `p=logout` | Ferme la session |
| GET | `p=session` | Indique si la session est ouverte |
| GET/POST | `p=clients` | Liste / crée un dossier client |
| GET/PUT/DELETE | `p=client&id=` | Lit / modifie / supprime un dossier |
| GET | `p=providers&search=&type=&city=` | Catalogue filtré, plus les valeurs de filtres |
| POST | `p=providers` | Crée un prestataire |
| PUT/DELETE | `p=provider&id=` | Modifie / supprime un prestataire |
| GET/POST | `p=quotes&client=` | Devis du client, groupés par version / crée un devis |
| GET/PUT/DELETE | `p=quote&id=` | Lit / enregistre / supprime un devis |
| POST | `p=quote_version&id=` | Copie le devis en version suivante |

Enregistrer une version qui n'est plus la dernière renvoie **409** : les versions passées
sont en lecture seule, y compris si la requête vient d'ailleurs que de l'interface.

## Points de conception à connaître

**Versions.** `groupId` relie les versions d'un devis, `version` les ordonne. Seule la plus
récente est modifiable ; `p=quote_version` duplique tout (journées et lignes reçoivent de
nouveaux identifiants) et fige la précédente.

**Lignes de devis dénormalisées.** Une ligne recopie nom, ville et prix du prestataire.
Changer un tarif au catalogue n'altère donc aucun devis existant, et un prestataire supprimé
ne vide pas les devis où il figurait.

**Deux documents, une seule saisie.** Descriptif, activités et hôtel n'apparaissent que sur
l'itinéraire ; les lignes de prestataires n'apparaissent que sur le devis. `print.js` choisit
le rendu selon `?doc=devis|itineraire`.

**Totaux calculés deux fois.** Côté client pour l'affichage immédiat (`quote.js`), côté
serveur pour les listes et les documents (`compute_totals`). Les deux formules doivent rester
alignées.

**Rendu du DOM.** `ui.js/h()` ignore les enfants nuls, mais `replaceChildren()` afficherait
le texte « null » : passer par `ui.js/mount()` pour tout rendu de page.

**Écriture disque.** `store_write()` écrit dans un fichier temporaire puis renomme, et
`store_mutate()` sérialise tout cycle lire-modifier-écrire sous `flock` exclusif — deux
onglets ouverts ne peuvent pas s'écraser.

**Recherche.** `fr_key()` neutralise casse et accents des deux côtés de la comparaison, pour
le filtrage comme pour les tris : « hotel » trouve « Hôtel ».

## Sécurité

- Mot de passe comparé avec `hash_equals` ; identifiants isolés dans `config.php`, lui-même
  refusé en accès direct par le `.htaccess` racine.
- Session régénérée à la connexion ; cookie `HttpOnly`, `SameSite=Strict`, `Secure` sous
  HTTPS, et limité au chemin de l'installation.
- `data/` et `lib/` bloqués en HTTP par un `.htaccess` (`Require all denied`, avec la
  variante Apache 2.2). Les tarifs ne sont pas lisibles depuis un navigateur.
- `app.php` et `print.php` vérifient la session avant d'émettre la moindre ligne de HTML.
- Texte inséré via `textContent` côté client et `htmlspecialchars` côté PHP.

## Tests

Un scénario de bout en bout sous Playwright couvre le parcours complet, de la connexion aux
deux documents, en vérifiant notamment que l'itinéraire ne contient ni prix, ni devise, ni
nom de prestataire, et qu'aucune page ne rend le texte « null ». Il a été passé dans les deux
configurations de déploiement : à la racine du domaine et dans un sous-dossier. Il n'est pas
versionné : le relancer suppose de le réécrire dans un dossier de travail, serveur démarré
sur une base vierge.

Le serveur intégré de PHP ne lit pas les `.htaccess` : le blocage de `data/` et `lib/` ne se
vérifie donc que sur un Apache réel, pas en local.
