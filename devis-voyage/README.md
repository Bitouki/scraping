# Devis Voyage — Graine de Voyageur

Logiciel interne de cotisation des voyages sur mesure. On saisit le voyage jour par jour,
on y accroche les prestataires (avec leur prix en dollars), et le logiciel calcule le prix
de vente final en euros, marge comprise. Deux documents en sortent : le devis détaillé pour
l'agence, l'itinéraire pour le client.

## Installation sur o2switch

Rien à configurer, rien à installer : le logiciel tourne en PHP, qui est déjà actif sur
l'hébergement.

1. Connectez-vous au **cPanel** o2switch, puis ouvrez le **Gestionnaire de fichiers**.
2. Allez dans le dossier `public_html`.
3. Envoyez le fichier `devis-voyage.zip` (bouton **Téléverser**), puis, de retour dans le
   gestionnaire, clic droit dessus → **Extraire**.
4. C'est terminé. Le logiciel répond sur `https://votre-domaine.fr/devis-voyage/`.

Pour l'avoir directement sur `https://votre-domaine.fr/`, déplacez le contenu du dossier
`devis-voyage` d'un cran vers le haut, dans `public_html` — les deux emplacements
fonctionnent, sans aucun réglage à changer.

Si le domaine est en HTTPS (c'est le cas par défaut chez o2switch), tout est chiffré, y
compris la connexion au logiciel.

### Connexion

| | |
|---|---|
| E-mail | `info@grainedevoyageur.com` |
| Mot de passe | `GraineDeVoyageur2026` |

Pour changer le mot de passe, ouvrez `config.php` dans le gestionnaire de fichiers
(clic droit → Modifier), remplacez le texte entre guillemets, enregistrez. C'est aussi là
que se change le nom de l'agence affiché sur les documents.

## Comment ça marche

### 1. Les dossiers clients

La page d'accueil liste les dossiers. Un dossier = un client. On y entre en cliquant dessus.

### 2. Le catalogue de prestataires

Deux boutons, disponibles depuis l'accueil et depuis chaque dossier :

- **Ajouter un prestataire** — ouvre une fenêtre avec le type de prestation (Chauffeur,
  Hôtel, Guide…), le nom, la ville, et le prix. Le prix se saisit **en soles péruviens**
  par défaut (le taux de change est mémorisé d'une fiche à l'autre) et se convertit
  automatiquement en dollars, qui restent la devise de référence pour tous les calculs de
  devis ; la devise se change en un clic si un prestataire facture directement en dollars.
  Une fois enregistré, le prestataire est réutilisable sur tous les devis.
- **Modifier un prestataire** — ouvre une fenêtre de recherche avec filtres (texte, type,
  ville). On clique sur un prestataire pour corriger son prix ou ses informations, ou pour
  le supprimer.

La recherche ignore les accents et la casse : taper « hotel » trouve « Hôtel ».

Le catalogue est commun à tous les dossiers : un prestataire saisi une fois se retrouve
partout.

### 3. Le devis

**Créer un nouveau devis** ouvre l'éditeur.

*L'entête* contient le prénom et le nom du client, les dates du voyage, le **taux de change**
(1 USD = combien d'euros), la **marge** à appliquer (sans marge, 5, 10, 15 ou 20 %) et le
**nombre de participants**. Taux, marge et nombre de participants sont propres à chaque
devis : un ancien devis garde le taux du jour où il a été fait.

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
Total USD  →  Total EUR brut (au taux)  →  Marge  →  Prix de vente EUR  →  Prix par personne
```

Le prix par personne divise le prix de vente (marge comprise) par le nombre de participants
renseigné dans l'entête.

### 4. Les deux documents

Deux boutons d'export, chacun ouvre une page prête à imprimer. Le bouton
« Imprimer / Enregistrer en PDF » produit le PDF via le navigateur :

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

## Sauvegarde

Toutes les données tiennent dans **`data/db.json`**, créé au premier enregistrement.

Pour sauvegarder : gestionnaire de fichiers → dossier `data` → clic droit sur `db.json` →
**Télécharger**. Pour restaurer, renvoyez le fichier au même endroit. Le faire de temps en
temps est une bonne habitude ; o2switch conserve par ailleurs ses propres sauvegardes.

Ce dossier est bloqué en accès web par un fichier `.htaccess` : personne ne peut lire vos
tarifs depuis un navigateur, même en connaissant l'adresse exacte.

## Organisation du code

```
devis-voyage/
├── index.php         page de connexion
├── app.php           application (protégée par la session)
├── print.php         page d'impression des deux documents
├── api.php           toute l'API, appelée en « api.php?p=… »
├── config.php        identifiants et nom de l'agence
├── lib/
│   ├── auth.php      connexion et session
│   └── store.php     lecture/écriture des données, calcul des totaux
├── css/              styles écran et styles d'impression
├── js/
│   ├── api.js        appels au serveur, formats monétaires
│   ├── ui.js         fenêtres modales, notifications, construction du DOM
│   ├── providers.js  les trois fenêtres de prestataires
│   ├── quote.js      éditeur de devis et totaux
│   ├── app.js        navigation, dossiers clients
│   └── print.js      rendu du devis et de l'itinéraire
└── data/             les données (créé au premier enregistrement)
```

Aucune bibliothèque externe, aucune base de données à créer, aucune dépendance à installer :
PHP 7.4 ou plus récent suffit.

## Essayer en local avant de l'envoyer en ligne

Avec PHP installé sur l'ordinateur :

```bash
cd devis-voyage
php -S localhost:8080
```

puis ouvrir <http://localhost:8080>.
