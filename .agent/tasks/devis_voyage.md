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
| Dépendances | Aucune (Node natif) | Démarre avec `node server.js`, rien à maintenir |
| Stockage | `data/db.json`, écriture atomique | Usage mono-poste ; sauvegarde = copier un fichier |
| Session | Cookie HttpOnly, mémoire serveur | Un seul compte ; redémarrage = reconnexion |
| PDF | Page dédiée + impression navigateur | Pas de bibliothèque, rendu fidèle, « Enregistrer en PDF » natif |
| Versions | Copie complète à la demande | La version envoyée reste lisible à l'identique |
| Marge | 0 / 5 / 10 / 15 / 20 % | Les trois valeurs demandées, plus les cas limites |

Le taux est saisi sous la forme **1 USD = X EUR** pour lever toute ambiguïté de sens.

## Modèle de données

```
clients   : id, firstName, lastName, email, phone, notes
providers : id, type, name, city, priceUsd, notes
quotes    : id, clientId, groupId, version, createdAt,
            header { firstName, lastName, startDate, endDate, exchangeRate, marginPct, title },
            days [ { id, dayNumber, date, city, title, description, hotel,
                     activities[], items[ { id, providerId, type, name, city, priceUsd, quantity } ] } ]
```

`groupId` regroupe les versions d'un même devis ; la version la plus élevée est la seule
modifiable. Les lignes du devis recopient nom / ville / prix du prestataire au lieu de le
référencer seulement : une hausse de tarif au catalogue ne réécrit pas un devis déjà envoyé.

## Calcul

```
total USD   = Σ (prix ligne × quantité)
EUR brut    = total USD × taux
marge       = EUR brut × marge%
prix vente  = EUR brut + marge
```

Calculé côté client pour l'affichage direct, recalculé côté serveur (`store.computeTotals`)
pour les listes et les documents imprimés.

## Étapes réalisées

1. Serveur, authentification, stockage, API REST.
2. Connexion, dossiers clients, page dossier.
3. Les trois fenêtres de prestataires (ajout, modification avec filtres, sélection).
4. Éditeur de devis : entête, journées, tableau des prestataires, totaux, versions.
5. Les deux documents imprimables.

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
