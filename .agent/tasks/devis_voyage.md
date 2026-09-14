# Devis Voyage — PRD et plan d'implémentation

## Contexte

Graine de Voyageur construit des voyages sur mesure. Les tarifs des prestataires locaux sont
négociés en dollars, la vente se fait en euros. Il fallait un outil interne pour chiffrer un
voyage jour par jour et sortir deux documents distincts : le devis détaillé pour l'agence et
l'itinéraire pour le client.

## Besoin exprimé

1. Application web, accès par une connexion unique à l'entreprise (le client n'y accède pas).
2. Page d'accueil : les dossiers clients, cliquables.
3. Dans un dossier : trois actions — ajouter un prestataire, modifier un prestataire, créer
   un nouveau devis — plus la liste des devis déjà faits.
4. Le catalogue de prestataires se saisit une fois (type, nom, ville, prix) et se retrouve
   ensuite par recherche filtrée.
5. Le devis se compose jour par jour, avec pour chaque journée un tableau prestataire / ville
   / prix.
6. L'entête du devis porte les informations client (nom, prénom, dates), le taux de change
   dollar → euro et la marge à appliquer (menu déroulant 5 / 10 / 15 %).
7. Modifier un devis ne doit pas altérer la version déjà envoyée.
8. Deux exports PDF : le devis complet avec prix, et l'itinéraire avec activités et hôtels
   mais sans prix ni nom de prestataire.

## Décisions

| Sujet | Choix | Raison |
|---|---|---|
| Type d'application | Web, servie sur une page | Accessible partout, rien à installer |
| Langage serveur | PHP sans framework | Cible o2switch (mutualisé cPanel) : on dépose le dossier et ça tourne |
| Dépendances | Aucune | Rien à installer ni à maintenir |
| Stockage | `data/db.json`, écriture atomique sous verrou | Pas de base à créer ; sauvegarde = télécharger un fichier |
| Session | Session PHP native, cookie HttpOnly | Un seul compte, comportement standard de l'hébergeur |
| Routage API | Point d'entrée unique en paramètre de requête | Marche en sous-dossier et sans `mod_rewrite` |
| PDF | Page dédiée + impression navigateur | Pas de bibliothèque, rendu fidèle, « Enregistrer en PDF » natif |
| Versions | Copie complète à la demande | La version envoyée reste lisible à l'identique |
| Marge | 0 / 5 / 10 / 15 / 20 % | Les trois valeurs demandées, plus les cas limites |
| Devise des prestataires | Saisie au choix en soles (PEN) ou en dollars, dollar toujours stocké | Les tarifs locaux se négocient en soles ; le dollar reste la seule devise que les calculs de devis manipulent |

Le taux est saisi sous la forme **1 USD = X EUR** pour lever toute ambiguïté de sens. De la
même façon, le taux d'un prestataire se saisit **1 USD = X PEN**.

## Modèle de données

```
clients   : id, firstName, lastName, email, phone, notes
providers : id, type, name, city, currency, priceSoles, penRate, priceUsd, notes
quotes    : id, clientId, groupId, version, createdAt,
            header { firstName, lastName, startDate, endDate, exchangeRate, marginPct, travelers, title },
            days [ { id, dayNumber, date, city, title, description, hotel,
                     activities[], items[ { id, providerId, type, name, city, priceUsd, quantity } ] } ]
```

`groupId` regroupe les versions d'un même devis ; la version la plus élevée est la seule
modifiable. Les lignes du devis recopient nom / ville / prix du prestataire au lieu de le
référencer seulement : une hausse de tarif au catalogue ne réécrit pas un devis déjà envoyé.

## Calcul

```
total USD    = Σ (prix ligne × quantité)
EUR brut     = total USD × taux
marge        = EUR brut × marge%
prix vente   = EUR brut + marge
prix/personne = prix vente ÷ nombre de participants
```

Le nombre de participants (`travelers`) est un champ de l'entête, minimum 1, propre à
chaque devis comme le taux et la marge.

Calculé côté client pour l'affichage direct, recalculé côté serveur (`store.computeTotals`)
pour les listes et les documents imprimés.

## Étapes réalisées

1. Serveur, authentification, stockage, API.
2. Connexion, dossiers clients, page dossier.
3. Les trois fenêtres de prestataires (ajout, modification avec filtres, sélection).
4. Éditeur de devis : entête, journées, tableau des prestataires, totaux, versions.
5. Les deux documents imprimables.
6. Portage du serveur de Node vers PHP pour l'hébergement mutualisé o2switch — le front
   est resté identique, seules les URL sont devenues relatives.

### Pourquoi PHP plutôt que Node

La première version tournait sur un serveur Node lancé à la main. Sur o2switch, Node
suppose de passer par « Setup Node.js App » dans cPanel : déclarer le dossier, le fichier
de démarrage, lancer le process et le surveiller. PHP y est servi nativement : déposer les
fichiers dans `public_html` suffit, ce qui correspond à la demande — l'agence installe
elle-même, sans intermédiaire technique.

## Vérification

Un test de bout en bout pilote un vrai navigateur (Playwright) et couvre : connexion,
création de dossier, ajout et modification d'un prestataire, composition d'un devis sur deux
journées, exactitude des totaux, enregistrement, contenu des deux documents — dont l'absence
de tout prix et de tout prestataire sur l'itinéraire —, gel de la version précédente et
listing des versions.

## Reste possible

- Duplication d'un devis vers un autre client.
- Dates par défaut sur les journées à partir de la date de départ.
- Plusieurs comptes utilisateurs si l'équipe s'agrandit.
