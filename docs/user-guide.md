# Guide Utilisateur

Ce guide explique comment utiliser l'interface
d'administration de Transit Display Hub.

---

## Connexion

### Se connecter

1. Ouvrez l'application dans votre navigateur
2. Entrez votre **nom d'utilisateur** et **mot de passe**
3. Cliquez sur **Se connecter**

### Comptes par defaut

| Utilisateur | Mot de passe | Role                        |
| ----------- | ------------ | --------------------------- |
| admin       | admin123     | Administrateur complet      |
| agent       | agent123     | Agent (messages uniquement) |

> **Important** : Changez les mots de passe par defaut
> en production.

### Roles

- **Administrateur** : Acces complet (lignes, arrets,
  itineraires, horaires, messages, appareils, utilisateurs)
- **Agent** : Gestion des messages broadcast, consultation
  du dashboard (messages et alertes), acces a la carte du
  reseau. Le menu lateral affiche uniquement Dashboard,
  Messages et Carte du reseau. Les listes de lignes et
  d'arrets sont accessibles en lecture seule pour le
  ciblage des messages (scope Ligne/Arret).

### Se deconnecter

Cliquez sur **Logout** dans le coin superieur droit.

---

## Dashboard

Le tableau de bord affiche un resume adapte a votre role.

### Vue Administrateur

- **Lignes** : Nombre total de lignes configurees
- **Arrets** : Nombre total d'arrets
- **Messages actifs** : Messages broadcast actuellement
  diffuses
- **Appareils en ligne** : Nombre d'ecrans connectes /
  total
- **Vue d'ensemble** : Apercu des lignes du reseau et
  sante des appareils
- **Actions rapides** : Acces direct a la gestion des
  lignes, arrets, horaires, appareils et utilisateurs

### Vue Agent

- **Messages actifs** : Messages broadcast actuellement
  diffuses
- **Actions rapides** : Creer un message, acceder a la
  carte du reseau

### Alertes

Les alertes (messages critiques et messages recents) sont
visibles par tous les roles. Les alertes d'appareils hors
ligne ne sont visibles que par les administrateurs.

---

## Gestion des Lignes

### Voir les lignes

1. Cliquez sur **Lignes** dans le menu lateral
2. La liste affiche toutes les lignes avec leur code,
   nom, type, couleur et nombre d'arrets
3. Utilisez la barre de recherche pour filtrer

### Creer une ligne

1. Cliquez sur **+ Nouvelle Ligne**
2. Remplissez les champs :
   - **Code** : Identifiant court (ex: M1, B2, T3)
   - **Nom** : Nom complet (ex: Metro Ligne 1 - Centre)
   - **Type** : Metro, Bus, Tram ou Train
   - **Couleur** : Choisissez une couleur d'identification
3. Cliquez sur **Creer**

### Modifier une ligne

1. Cliquez sur **Modifier** a cote de la ligne
2. Modifiez les informations
3. Cliquez sur **Enregistrer**

### Supprimer une ligne

1. Cliquez sur **Supprimer**
2. Confirmez la suppression

> **Attention** : Supprimer une ligne supprime egalement
> ses itineraires et horaires associes.

---

## Gestion des Arrets

### Voir les arrets

1. Cliquez sur **Arrets** dans le menu
2. Utilisez le filtre par ligne si necessaire

### Creer un arret

1. Cliquez sur **+ Nouvel Arret**
2. Entrez le **Nom** de l'arret
3. Selectionnez une ou plusieurs **Lignes** (un arret
   peut desservir plusieurs lignes)
4. Optionnellement, renseignez les coordonnees GPS
   (**Latitude** et **Longitude**)
5. Cliquez sur **Creer**

### Modifier un arret

1. Cliquez sur **Modifier**
2. Modifiez le nom, les lignes ou les coordonnees
3. Cliquez sur **Enregistrer**

### Supprimer un arret

1. Cliquez sur **Supprimer**
2. Confirmez

> Supprimer un arret supprime egalement tous ses horaires
> et retire les appareils associes.

---

## Gestion des Itineraires

Un itineraire represente un parcours ordonne d'arrets sur
une ligne, correspondant a une direction
(ex: "Direction Aeroport", "Direction Centre-Ville").

### Voir les itineraires

1. Cliquez sur **Itineraires** dans le menu
2. Filtrez par ligne si necessaire
3. Chaque itineraire affiche sa ligne, son nom et la
   liste ordonnee de ses arrets

### Creer un itineraire

1. Cliquez sur **+ Nouvel Itineraire**
2. Selectionnez la **Ligne**
3. Entrez le **Nom** (ex: Direction Aeroport)
4. Ajoutez les **Arrets** dans l'ordre du parcours
5. Cliquez sur **Creer**

### Modifier un itineraire

1. Cliquez sur **Modifier**
2. Modifiez le nom ou reordonnez les arrets
3. Cliquez sur **Enregistrer**

### Gerer les arrets d'un itineraire

- **Ajouter un arret** : Selectionnez un arret et sa
  position dans la sequence
- **Reordonner** : Modifiez l'ordre des arrets par
  glisser-deposer ou en changeant les positions
- **Retirer un arret** : Supprimez un arret de
  l'itineraire sans supprimer l'arret lui-meme

### Supprimer un itineraire

1. Cliquez sur **Supprimer**
2. Confirmez

> **Attention** : Supprimer un itineraire supprime
> egalement tous les horaires qui y font reference.

---

## Gestion des Horaires

### Acceder aux horaires

1. Cliquez sur **Horaires** dans le menu
2. Selectionnez un **Arret**

Les horaires de l'arret s'affichent tries par heure.

### Creer un horaire

1. Cliquez sur **+ Nouvel Horaire**
2. Remplissez :
   - **Heure de depart** : Format HH:MM
   - **Itineraire** : Selectionnez l'itineraire
     (determine la ligne et la direction)
3. Cliquez sur **Creer**

> L'itineraire selectionne determine automatiquement la
> ligne et le terminus affiche aux voyageurs.

### Modifier un horaire

1. Cliquez sur **Modifier**
2. Modifiez l'heure ou l'itineraire
3. Cliquez sur **Enregistrer**

### Supprimer un horaire

1. Cliquez sur **Supprimer**
2. Confirmez

---

## Messages Broadcast

Les messages broadcast permettent de communiquer avec
les voyageurs.

### Types de messages

| Severite     | Usage                 | Affichage                      |
| ------------ | --------------------- | ------------------------------ |
| **Info**     | Information generale  | Panneau lateral                |
| **Warning**  | Perturbation moderee  | Panneau lateral, mise en avant |
| **Critical** | Urgence, interruption | Banniere rouge clignotante     |

### Portee des messages

- **Reseau** : Affiche sur tous les ecrans
- **Ligne** : Affiche sur les arrets de cette ligne
- **Arret** : Affiche uniquement sur cet arret

### Creer un message

1. Cliquez sur **Messages** dans le menu
2. Cliquez sur **+ Nouveau Message**
3. Remplissez :
   - **Titre** : Resume court
   - **Contenu** : Details du message
   - **Severite** : Info, Warning ou Critical
   - **Portee** : Reseau, Ligne ou Arret
   - **Date de debut** : Quand le message apparait
   - **Date de fin** : Quand le message disparait
4. Cliquez sur **Creer**

### Exemple de messages

#### Info

- Titre : "Pensez a valider"
- Contenu : "N'oubliez pas de valider votre titre
  de transport."

#### Warning

- Titre : "Travaux en cours"
- Contenu : "Temps de trajet rallonge de 5 minutes
  sur la section Centre-Gare."

#### Critical

- Titre : "Service interrompu"
- Contenu : "Suite a un incident, aucun train ne
  circule entre Gare et Aeroport. Des bus de
  substitution sont en place."

### Filtrer les messages

- Filtrez par statut **Actifs uniquement** pour voir
  les messages en cours
- Filtrez par **Severite** pour cibler un type specifique

### Modifier un message

1. Cliquez sur **Modifier**
2. Modifiez les informations
3. Cliquez sur **Enregistrer**

### Supprimer un message

1. Cliquez sur **Supprimer**
2. Confirmez

---

## Gestion des Appareils

Les appareils sont les ecrans d'affichage installes aux
arrets.

### Voir les appareils

1. Cliquez sur **Appareils** dans le menu
2. Chaque carte affiche :
   - Nom de l'arret
   - Lignes desservies
   - Statut (En ligne / Hors ligne)
   - Derniere connexion

### Filtrer par statut

Utilisez le menu deroulant pour filtrer :

- **Tous** : Tous les appareils
- **En ligne** : Appareils connectes
- **Hors ligne** : Appareils deconnectes

### Enregistrer un appareil

1. Cliquez sur **+ Enregistrer un appareil**
2. Selectionnez l'**Arret**
3. Cliquez sur **Enregistrer**
4. **Copiez le token** affiche

> **Important** : Le token n'est affiche qu'une seule
> fois. Conservez-le precieusement.

### Configurer l'ecran

Sur l'appareil d'affichage, configurez l'URL :

```text
https://transit.example.com/display?token=VOTRE_TOKEN
```

Ou pour un acces direct par arret (test) :

```text
https://transit.example.com/display/STOP_ID
```

### Supprimer un appareil

1. Cliquez sur **Supprimer**
2. Confirmez

> L'ecran affichera une erreur jusqu'a ce qu'il soit
> reenregistre.

---

## Gestion des Utilisateurs

### Voir les utilisateurs

1. Cliquez sur **Utilisateurs** dans le menu
2. La liste affiche tous les comptes avec leur nom,
   role et statut

### Creer un utilisateur

1. Cliquez sur **+ Nouvel Utilisateur**
2. Remplissez :
   - **Nom d'utilisateur** : 3 a 50 caracteres
   - **Mot de passe** : 6 caracteres minimum
   - **Role** : Administrateur ou Agent
3. Cliquez sur **Creer**

### Modifier un utilisateur

1. Cliquez sur **Modifier**
2. Modifiez le role, le mot de passe ou
   activez/desactivez le compte
3. Cliquez sur **Enregistrer**

### Desactiver un compte

Pour empecher un utilisateur de se connecter sans
supprimer son compte :

1. Cliquez sur **Modifier**
2. Decochez **Active**
3. Cliquez sur **Enregistrer**

### Supprimer un utilisateur

1. Cliquez sur **Supprimer**
2. Confirmez

---

## Carte du Reseau

La carte du reseau offre une visualisation interactive
de l'ensemble du reseau de transport.

### Acceder a la carte

La carte est accessible publiquement a l'adresse `/map`
(pas d'authentification requise).

### Fonctionnalites

- **Vue schematique** : Visualisation claire du reseau
  avec les lignes et arrets
- **Informations arret** : Cliquez sur un arret pour
  voir les prochains departs et les lignes desservies
- **Recherche d'itineraire** : Utilisez la barre de
  recherche pour trouver un trajet entre deux arrets
- **Alertes actives** : Les messages d'alerte en cours
  sont affiches sur la carte

---

## Affichage Kiosque

L'ecran kiosque affiche les informations voyageurs.

### Elements affiches

1. **En-tete** : Nom de l'arret et lignes desservies
2. **Prochains departs** : Liste des prochaines courses
   avec :
   - Ligne et direction (terminus)
   - Heure programmee
3. **Messages** : Alertes et informations
4. **Pied de page** : Heure actuelle et statut de
   connexion

### Statut de connexion

- **Connecte** (vert) : Mises a jour en temps reel via
  WebSocket
- **Deconnecte** (rouge) : Tentative de reconnexion
  automatique

---

## Bonnes pratiques

### Messages (bonnes pratiques)

1. **Soyez concis** : Les voyageurs lisent rapidement
2. **Utilisez le bon niveau** : Reservez CRITICAL aux
   vraies urgences
3. **Definissez une fin** : Evitez les messages qui
   restent indefiniment

### Horaires (bonnes pratiques)

1. **Creez d'abord les itineraires** : Les horaires
   referencent un itineraire existant
2. **Un itineraire par direction** : Creez un itineraire
   "Direction A" et un "Direction B" pour chaque ligne

### Appareils (bonnes pratiques)

1. **Surveillez les deconnexions** : Un appareil hors
   ligne n'affiche pas les mises a jour
2. **Securisez les tokens** : Ne partagez pas les tokens
   publiquement

---

## Raccourcis clavier

| Raccourci | Action                     |
| --------- | -------------------------- |
| `Echap`   | Fermer la fenetre modale   |
| `Entree`  | Valider un formulaire      |

---

## FAQ

### L'ecran affiche "Chargement..."

1. Verifiez la connexion internet de l'appareil
2. Verifiez que le token est correct
3. Verifiez que le serveur backend fonctionne

### Un message n'apparait pas sur l'ecran

1. Verifiez la portee du message (Reseau/Ligne/Arret)
2. Verifiez les dates de debut et fin
3. Le message doit etre actif (entre debut et fin)

### Les horaires ne s'affichent pas

1. Verifiez que des horaires sont crees pour cet arret
2. Verifiez que l'heure de depart n'est pas deja passee
3. Verifiez que l'itineraire associe est bien configure

### Comment changer un mot de passe ?

1. Connectez-vous en tant qu'administrateur
2. Allez dans **Utilisateurs**
3. Cliquez sur **Modifier** a cote de l'utilisateur
4. Entrez le nouveau mot de passe
5. Cliquez sur **Enregistrer**

### Comment affecter un arret a plusieurs lignes ?

Lors de la creation ou modification d'un arret,
selectionnez plusieurs lignes. Un arret peut desservir
autant de lignes que necessaire (correspondance).
