# Devis Voyage — état du système

Application interne de cotisation de voyages, indépendante du serveur MCP ScrapeGraph qui
occupe le reste du dépôt. Tout vit dans `devis-voyage/`.

## Pile technique

- Node 18+, modules ES, **aucune dépendance externe** (`node:http`, `node:fs`, `node:crypto`).
- Front en JavaScript natif servi en statique, sans étape de build.
- Données dans `devis-voyage/data/db.json` (hors dépôt).

Lancement : `cd devis-voyage && node server.js` → <http://localhost:3000>.

Variables d'environnement : `PORT`, `APP_EMAIL`, `APP_PASSWORD`, `DATA_DIR`.

## Structure

| Fichier | Rôle |
|---|---|
| `server.js` | Serveur HTTP, routage de l'API, service des fichiers statiques |
| `lib/auth.js` | Vérification des identifiants, sessions en mémoire, cookie |
| `lib/store.js` | Persistance JSON, CRUD clients / prestataires / devis, calcul des totaux |
| `public/index.html` | Page de connexion |
| `public/app.html` + `js/app.js` | Application, navigation par ancre |
| `public/js/providers.js` | Fenêtres ajouter / modifier / sélectionner un prestataire |
| `public/js/quote.js` | Éditeur de devis et barre de totaux |
| `public/js/print.js` + `print.html` | Rendu des deux documents imprimables |
| `public/js/ui.js` | Construction du DOM, fenêtres modales, notifications |
| `public/js/api.js` | Appels HTTP, formats monétaires et de dates |

## API

Tout est sous `/api`, en JSON. Hors `login`, `logout` et `session`, chaque route exige une
session valide et répond 401 sinon.

| Méthode | Route | Effet |
|---|---|---|
| POST | `/api/login` | Ouvre une session (cookie `gdv_session`) |
| POST | `/api/logout` | Ferme la session |
| GET | `/api/session` | Indique si la session est ouverte |
| GET/POST | `/api/clients` | Liste / crée un dossier client |
| GET/PUT/DELETE | `/api/clients/:id` | Lit / modifie / supprime un dossier |
| GET | `/api/providers?search=&type=&city=` | Catalogue filtré, plus les valeurs de filtres |
| POST | `/api/providers` | Crée un prestataire |
| PUT/DELETE | `/api/providers/:id` | Modifie / supprime un prestataire |
| GET/POST | `/api/clients/:id/quotes` | Devis du client, groupés par version / crée un devis |
| GET/PUT/DELETE | `/api/quotes/:id` | Lit / enregistre / supprime un devis |
| POST | `/api/quotes/:id/version` | Copie le devis en version suivante |

Enregistrer une version qui n'est plus la dernière renvoie **409** : les versions passées
sont en lecture seule, y compris si la requête vient d'ailleurs que de l'interface.

## Points de conception à connaître

**Versions.** `groupId` relie les versions d'un devis, `version` les ordonne. Seule la plus
récente est modifiable ; `POST /version` duplique tout (journées et lignes reçoivent de
nouveaux identifiants) et fige la précédente.

**Lignes de devis dénormalisées.** Une ligne recopie nom, ville et prix du prestataire.
Changer un tarif au catalogue n'altère donc aucun devis existant, et un prestataire supprimé
ne vide pas les devis où il figurait.

**Deux documents, une seule saisie.** Descriptif, activités et hôtel n'apparaissent que sur
l'itinéraire ; les lignes de prestataires n'apparaissent que sur le devis. `print.js` choisit
le rendu selon `?doc=devis|itineraire`.

**Totaux calculés deux fois.** Côté client pour l'affichage immédiat (`quote.js`), côté
serveur pour les listes et les documents (`store.computeTotals`). Les deux formules doivent
rester alignées.

**Rendu du DOM.** `ui.js/h()` ignore les enfants nuls, mais `replaceChildren()` afficherait
le texte « null » : passer par `ui.js/mount()` pour tout rendu de page.

**Écriture disque.** `store.persist()` écrit dans un fichier temporaire puis renomme, pour
qu'une coupure ne tronque jamais la base.

**Sessions en mémoire.** Redémarrer le serveur déconnecte ; les données, elles, sont sur
disque.

## Sécurité

- Mot de passe comparé en temps constant ; identifiants surchargeables par environnement.
- Cookie `HttpOnly`, `SameSite=Strict`, durée 12 h.
- Service statique confiné à `public/` (chemin résolu et vérifié).
- Texte inséré via `textContent`, jamais par concaténation de HTML.

## Tests

Un scénario de bout en bout sous Playwright couvre le parcours complet, de la connexion aux
deux documents, en vérifiant notamment que l'itinéraire ne contient ni prix, ni devise, ni
nom de prestataire. Il n'est pas versionné : le relancer suppose de le réécrire dans un
dossier de travail, serveur démarré sur une base vierge.
