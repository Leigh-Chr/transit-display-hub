# Guide Utilisateur

Ce guide explique comment utiliser l'interface d'administration de Transit Display Hub.

---

## Connexion

### Se connecter

1. Ouvrez l'application dans votre navigateur
2. Entrez votre **nom d'utilisateur** et **mot de passe**
3. Cliquez sur **Se connecter**

### Comptes par défaut

| Utilisateur | Mot de passe | Rôle |
|-------------|--------------|------|
| admin | admin123 | Administrateur complet |
| agent | agent123 | Agent (messages uniquement) |

> **Important** : Changez les mots de passe par défaut en production.

### Rôles

- **Administrateur** : Accès complet (lignes, arrêts, itinéraires, horaires, messages, appareils, utilisateurs)
- **Agent** : Gestion des messages broadcast uniquement

### Se déconnecter

Cliquez sur **Logout** dans le coin supérieur droit.

---

## Dashboard

Le tableau de bord affiche un résumé de votre réseau :

- **Lignes** : Nombre total de lignes configurées
- **Arrêts** : Nombre total d'arrêts
- **Messages actifs** : Messages broadcast actuellement diffusés
- **Appareils en ligne** : Nombre d'écrans connectés / total

### Alertes

Les alertes apparaissent quand :
- Un message **CRITIQUE** est actif
- Un appareil est **hors ligne**

---

## Gestion des Lignes

### Voir les lignes

1. Cliquez sur **Lignes** dans le menu latéral
2. La liste affiche toutes les lignes avec leur code, nom, type, couleur et nombre d'arrêts
3. Utilisez la barre de recherche pour filtrer

### Créer une ligne

1. Cliquez sur **+ Nouvelle Ligne**
2. Remplissez les champs :
   - **Code** : Identifiant court (ex: M1, B2, T3)
   - **Nom** : Nom complet (ex: Métro Ligne 1 - Centre)
   - **Type** : Métro, Bus, Tram ou Train
   - **Couleur** : Choisissez une couleur d'identification
3. Cliquez sur **Créer**

### Modifier une ligne

1. Cliquez sur **Modifier** à côté de la ligne
2. Modifiez les informations
3. Cliquez sur **Enregistrer**

### Supprimer une ligne

1. Cliquez sur **Supprimer**
2. Confirmez la suppression

> **Attention** : Supprimer une ligne supprime également ses itinéraires et horaires associés.

---

## Gestion des Arrêts

### Voir les arrêts

1. Cliquez sur **Arrêts** dans le menu
2. Utilisez le filtre par ligne si nécessaire

### Créer un arrêt

1. Cliquez sur **+ Nouvel Arrêt**
2. Entrez le **Nom** de l'arrêt
3. Sélectionnez une ou plusieurs **Lignes** (un arrêt peut desservir plusieurs lignes)
4. Optionnellement, renseignez les coordonnées GPS (**Latitude** et **Longitude**)
5. Cliquez sur **Créer**

### Modifier un arrêt

1. Cliquez sur **Modifier**
2. Modifiez le nom, les lignes ou les coordonnées
3. Cliquez sur **Enregistrer**

### Supprimer un arrêt

1. Cliquez sur **Supprimer**
2. Confirmez

> Supprimer un arrêt supprime également tous ses horaires et retire les appareils associés.

---

## Gestion des Itinéraires

Un itinéraire représente un parcours ordonné d'arrêts sur une ligne, correspondant à une direction (ex: "Direction Aéroport", "Direction Centre-Ville").

### Voir les itinéraires

1. Cliquez sur **Itinéraires** dans le menu
2. Filtrez par ligne si nécessaire
3. Chaque itinéraire affiche sa ligne, son nom et la liste ordonnée de ses arrêts

### Créer un itinéraire

1. Cliquez sur **+ Nouvel Itinéraire**
2. Sélectionnez la **Ligne**
3. Entrez le **Nom** (ex: Direction Aéroport)
4. Ajoutez les **Arrêts** dans l'ordre du parcours
5. Cliquez sur **Créer**

### Modifier un itinéraire

1. Cliquez sur **Modifier**
2. Modifiez le nom ou réordonnez les arrêts
3. Cliquez sur **Enregistrer**

### Gérer les arrêts d'un itinéraire

- **Ajouter un arrêt** : Sélectionnez un arrêt et sa position dans la séquence
- **Réordonner** : Modifiez l'ordre des arrêts par glisser-déposer ou en changeant les positions
- **Retirer un arrêt** : Supprimez un arrêt de l'itinéraire sans supprimer l'arrêt lui-même

### Supprimer un itinéraire

1. Cliquez sur **Supprimer**
2. Confirmez

> **Attention** : Supprimer un itinéraire supprime également tous les horaires qui y font référence.

---

## Gestion des Horaires

### Accéder aux horaires

1. Cliquez sur **Horaires** dans le menu
2. Sélectionnez un **Arrêt**

Les horaires de l'arrêt s'affichent triés par heure.

### Créer un horaire

1. Cliquez sur **+ Nouvel Horaire**
2. Remplissez :
   - **Heure de départ** : Format HH:MM
   - **Itinéraire** : Sélectionnez l'itinéraire (détermine la ligne et la direction)
3. Cliquez sur **Créer**

> L'itinéraire sélectionné détermine automatiquement la ligne et le terminus affiché aux voyageurs.

### Modifier un horaire

1. Cliquez sur **Modifier**
2. Modifiez l'heure ou l'itinéraire
3. Cliquez sur **Enregistrer**

### Supprimer un horaire

1. Cliquez sur **Supprimer**
2. Confirmez

---

## Messages Broadcast

Les messages broadcast permettent de communiquer avec les voyageurs.

### Types de messages

| Sévérité | Usage | Affichage |
|----------|-------|-----------|
| **Info** | Information générale | Panneau latéral |
| **Warning** | Perturbation modérée | Panneau latéral, mise en avant |
| **Critical** | Urgence, interruption | Bannière rouge clignotante |

### Portée des messages

- **Réseau** : Affiché sur tous les écrans
- **Ligne** : Affiché sur les arrêts de cette ligne
- **Arrêt** : Affiché uniquement sur cet arrêt

### Créer un message

1. Cliquez sur **Messages** dans le menu
2. Cliquez sur **+ Nouveau Message**
3. Remplissez :
   - **Titre** : Résumé court
   - **Contenu** : Détails du message
   - **Sévérité** : Info, Warning ou Critical
   - **Portée** : Réseau, Ligne ou Arrêt
   - **Date de début** : Quand le message apparaît
   - **Date de fin** : Quand le message disparaît
4. Cliquez sur **Créer**

### Exemple de messages

**Info** :
- Titre : "Pensez à valider"
- Contenu : "N'oubliez pas de valider votre titre de transport."

**Warning** :
- Titre : "Travaux en cours"
- Contenu : "Temps de trajet rallongé de 5 minutes sur la section Centre-Gare."

**Critical** :
- Titre : "Service interrompu"
- Contenu : "Suite à un incident, aucun train ne circule entre Gare et Aéroport. Des bus de substitution sont en place."

### Filtrer les messages

- Filtrez par statut **Actifs uniquement** pour voir les messages en cours
- Filtrez par **Sévérité** pour cibler un type spécifique

### Modifier un message

1. Cliquez sur **Modifier**
2. Modifiez les informations
3. Cliquez sur **Enregistrer**

### Supprimer un message

1. Cliquez sur **Supprimer**
2. Confirmez

---

## Gestion des Appareils

Les appareils sont les écrans d'affichage installés aux arrêts.

### Voir les appareils

1. Cliquez sur **Appareils** dans le menu
2. Chaque carte affiche :
   - Nom de l'arrêt
   - Lignes desservies
   - Statut (En ligne / Hors ligne)
   - Dernière connexion

### Filtrer par statut

Utilisez le menu déroulant pour filtrer :
- **Tous** : Tous les appareils
- **En ligne** : Appareils connectés
- **Hors ligne** : Appareils déconnectés

### Enregistrer un appareil

1. Cliquez sur **+ Enregistrer un appareil**
2. Sélectionnez l'**Arrêt**
3. Cliquez sur **Enregistrer**
4. **Copiez le token** affiché

> **Important** : Le token n'est affiché qu'une seule fois. Conservez-le précieusement.

### Configurer l'écran

Sur l'appareil d'affichage, configurez l'URL :

```
https://transit.example.com/display?token=VOTRE_TOKEN
```

Ou pour un accès direct par arrêt (test) :

```
https://transit.example.com/display/STOP_ID
```

### Supprimer un appareil

1. Cliquez sur **Supprimer**
2. Confirmez

> L'écran affichera une erreur jusqu'à ce qu'il soit réenregistré.

---

## Gestion des Utilisateurs

### Voir les utilisateurs

1. Cliquez sur **Utilisateurs** dans le menu
2. La liste affiche tous les comptes avec leur nom, rôle et statut

### Créer un utilisateur

1. Cliquez sur **+ Nouvel Utilisateur**
2. Remplissez :
   - **Nom d'utilisateur** : 3 à 50 caractères
   - **Mot de passe** : 6 caractères minimum
   - **Rôle** : Administrateur ou Agent
3. Cliquez sur **Créer**

### Modifier un utilisateur

1. Cliquez sur **Modifier**
2. Modifiez le rôle, le mot de passe ou activez/désactivez le compte
3. Cliquez sur **Enregistrer**

### Désactiver un compte

Pour empêcher un utilisateur de se connecter sans supprimer son compte :
1. Cliquez sur **Modifier**
2. Décochez **Activé**
3. Cliquez sur **Enregistrer**

### Supprimer un utilisateur

1. Cliquez sur **Supprimer**
2. Confirmez

---

## Carte du Réseau

La carte du réseau offre une visualisation interactive de l'ensemble du réseau de transport.

### Accéder à la carte

La carte est accessible publiquement à l'adresse `/map` (pas d'authentification requise).

### Fonctionnalités

- **Vue schématique** : Visualisation claire du réseau avec les lignes et arrêts
- **Informations arrêt** : Cliquez sur un arrêt pour voir les prochains départs et les lignes desservies
- **Recherche d'itinéraire** : Utilisez la barre de recherche pour trouver un trajet entre deux arrêts
- **Alertes actives** : Les messages d'alerte en cours sont affichés sur la carte

---

## Affichage Kiosque

L'écran kiosque affiche les informations voyageurs.

### Éléments affichés

1. **En-tête** : Nom de l'arrêt et lignes desservies
2. **Prochains départs** : Liste des prochaines courses avec :
   - Ligne et direction (terminus)
   - Heure programmée
3. **Messages** : Alertes et informations
4. **Pied de page** : Heure actuelle et statut de connexion

### Statut de connexion

- **Connecté** (vert) : Mises à jour en temps réel via WebSocket
- **Déconnecté** (rouge) : Tentative de reconnexion automatique

---

## Bonnes pratiques

### Messages

1. **Soyez concis** : Les voyageurs lisent rapidement
2. **Utilisez le bon niveau** : Réservez CRITICAL aux vraies urgences
3. **Définissez une fin** : Évitez les messages qui restent indéfiniment

### Horaires

1. **Créez d'abord les itinéraires** : Les horaires référencent un itinéraire existant
2. **Un itinéraire par direction** : Créez un itinéraire "Direction A" et un "Direction B" pour chaque ligne

### Appareils

1. **Surveillez les déconnexions** : Un appareil hors ligne n'affiche pas les mises à jour
2. **Sécurisez les tokens** : Ne partagez pas les tokens publiquement

---

## Raccourcis clavier

| Raccourci | Action |
|-----------|--------|
| `Échap` | Fermer la fenêtre modale |
| `Entrée` | Valider un formulaire |

---

## FAQ

### L'écran affiche "Chargement..."

1. Vérifiez la connexion internet de l'appareil
2. Vérifiez que le token est correct
3. Vérifiez que le serveur backend fonctionne

### Un message n'apparaît pas sur l'écran

1. Vérifiez la portée du message (Réseau/Ligne/Arrêt)
2. Vérifiez les dates de début et fin
3. Le message doit être actif (entre début et fin)

### Les horaires ne s'affichent pas

1. Vérifiez que des horaires sont créés pour cet arrêt
2. Vérifiez que l'heure de départ n'est pas déjà passée
3. Vérifiez que l'itinéraire associé est bien configuré

### Comment changer un mot de passe ?

1. Connectez-vous en tant qu'administrateur
2. Allez dans **Utilisateurs**
3. Cliquez sur **Modifier** à côté de l'utilisateur
4. Entrez le nouveau mot de passe
5. Cliquez sur **Enregistrer**

### Comment affecter un arrêt à plusieurs lignes ?

Lors de la création ou modification d'un arrêt, sélectionnez plusieurs lignes. Un arrêt peut desservir autant de lignes que nécessaire (correspondance).
