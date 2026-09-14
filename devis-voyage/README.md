# Devis Voyage — Graine de Voyageur

Logiciel interne de cotisation des voyages sur mesure. On saisit le voyage jour par jour,
on y accroche les prestataires (avec leur prix en dollars), et le logiciel calcule le prix
de vente final en euros, marge comprise.

## Démarrer

Une seule chose à installer au préalable : **Node.js**, à prendre sur <https://nodejs.org>
(version LTS, bouton de gauche). C'est gratuit et ça ne s'installe qu'une fois.

Ensuite, double-cliquer sur le lanceur correspondant à l'ordinateur :

- **Windows** : `DEMARRER-Windows.bat`
- **Mac** : `DEMARRER-Mac.command` — au tout premier lancement, faire un clic droit puis
  « Ouvrir », et confirmer : macOS demande cette autorisation une fois pour les fichiers
  téléchargés.

Le navigateur s'ouvre seul sur le logiciel. La fenêtre noire qui apparaît est le moteur :
la laisser ouverte pendant le travail, la fermer arrête le logiciel.

En ligne de commande, l'équivalent est :

```bash
cd devis-voyage
node server.js     # puis ouvrir http://localhost:3000
```

Aucune dépendance à installer : le serveur n'utilise que Node (18 ou plus récent) et les
données sont stockées dans `data/db.json`.

## Connexion

| | |
|---|---|
| E-mail | `info@grainedevoyageur.com` |
| Mot de passe | `GraineDeVoyageur2026` |

Ces identifiants sont surchargeables par variables d'environnement, ce qui est recommandé
en production pour ne pas laisser le mot de passe dans le code :

```bash
APP_EMAIL="info@grainedevoyageur.com" APP_PASSWORD="un-mot-de-passe-solide" PORT=8080 node server.js
```

## Comment ça marche

### 1. Les dossiers clients

La page d'accueil liste les dossiers. Un dossier = un client. On y entre en cliquant dessus.

### 2. Le catalogue de prestataires

Deux boutons, disponibles depuis l'accueil et depuis chaque dossier :

- **Ajouter un prestataire** — ouvre une fenêtre avec quatre champs : le type de prestation
  (Chauffeur, Hôtel, Guide…), le nom du prestataire, la ville et le prix en dollars.
  Une fois enregistré, le prestataire est réutilisable sur tous les devis.
- **Modifier un prestataire** — ouvre une fenêtre de recherche avec filtres (texte, type,
  ville). On clique sur un prestataire pour corriger son prix ou ses informations, ou pour
  le supprimer.

Le catalogue est commun à tous les dossiers : un prestataire saisi une fois se retrouve
partout.

### 3. Le devis

**Créer un nouveau devis** ouvre l'éditeur.

*L'entête* contient le prénom et le nom du client, les dates du voyage, le **taux de change**
(1 USD = combien d'euros) et la **marge** à appliquer (sans marge, 5, 10, 15 ou 20 %).
Taux et marge sont propres à chaque devis.

*Le corps* se remplit jour par jour. Chaque journée contient :

| Champ | Sert au devis | Sert à l'itinéraire client |
|---|---|---|
| Ville, date, titre | oui | oui |
| Descriptif | non | oui |
| Activités | non | oui |
| Hôtel | non | oui |
| Prestataires (nom, ville, prix, quantité) | oui | **non** |

Le bouton **+ Ajouter un prestataire** de chaque journée ouvre la recherche du catalogue ;
on clique sur un prestataire pour l'ajouter à la journée. Le prix arrive automatiquement et
reste modifiable ligne par ligne (le tarif du catalogue, lui, n'est pas touché).

*Les totaux* s'affichent en permanence en bas de l'écran :

```
Total USD  →  Total EUR brut (au taux)  →  Marge  →  Prix de vente EUR
```

### 4. Les deux documents

Deux boutons d'export, chacun ouvre une page prête à imprimer (« Imprimer / Enregistrer en PDF »
dans le navigateur produit le PDF) :

- **PDF Devis** — document interne. Le détail jour par jour de tous les prestataires avec
  leurs prix, les sous-totaux par journée, puis le total en dollars, le total en euros brut,
  et en dessous le prix avec la marge.
- **PDF Itinéraire** — document client. Le même voyage jour par jour avec les activités et
  les hôtels, **sans aucun prix et sans aucun nom de prestataire**.

### 5. Les versions

Un devis enregistré peut être modifié tant qu'il est la version courante. Pour envoyer une
offre révisée, on clique sur **Nouvelle version** : le logiciel recopie le devis en version
suivante et **fige définitivement la précédente**, qui reste consultable et imprimable telle
qu'elle a été envoyée. Le dossier client liste toutes les versions avec leur prix.

## Organisation du code

```
devis-voyage/
├── server.js            serveur HTTP et routes de l'API
├── lib/
│   ├── auth.js          connexion et sessions
│   └── store.js         lecture/écriture des données, calcul des totaux
├── public/
│   ├── index.html       page de connexion
│   ├── app.html         application
│   ├── print.html       page d'impression des deux documents
│   ├── css/             styles écran et styles d'impression
│   └── js/
│       ├── api.js       appels au serveur, formats monétaires
│       ├── ui.js        fenêtres modales, notifications, construction du DOM
│       ├── providers.js les trois fenêtres de prestataires
│       ├── quote.js     éditeur de devis et totaux
│       ├── app.js       navigation, dossiers clients
│       └── print.js     rendu du devis et de l'itinéraire
└── data/db.json         les données (créé au premier lancement)
```

## Sauvegarde

Tout est dans `data/db.json`. Copier ce fichier suffit à sauvegarder clients, prestataires
et devis ; le remettre en place restaure tout.
