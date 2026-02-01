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
| agent | agent123 | Agent (accès limité) |

> **Important** : Changez les mots de passe par défaut en production.

### Se déconnecter

Cliquez sur **Logout** dans le coin supérieur droit.

---

## Dashboard

Le tableau de bord affiche un résumé de votre réseau :

- **Lignes** : Nombre total de lignes configurées
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
2. La liste affiche toutes les lignes avec leur code, nom, couleur et nombre d'arrêts

### Créer une ligne

1. Cliquez sur **+ Nouvelle Ligne**
2. Remplissez les champs :
   - **Code** : Identifiant court (ex: L1, M2, T3)
   - **Nom** : Nom complet (ex: Ligne 1 - Centre)
   - **Couleur** : Choisissez une couleur d'identification
3. Cliquez sur **Créer**

### Modifier une ligne

1. Cliquez sur **Modifier** à côté de la ligne
2. Modifiez les informations
3. Cliquez sur **Enregistrer**

### Supprimer une ligne

1. Cliquez sur **Supprimer**
2. Confirmez la suppression

> **Attention** : Supprimer une ligne supprime également tous ses arrêts et horaires.

---

## Gestion des Arrêts

### Voir les arrêts

1. Cliquez sur **Arrêts** dans le menu
2. Utilisez le filtre par ligne si nécessaire

### Créer un arrêt

1. Cliquez sur **+ Nouvel Arrêt**
2. Sélectionnez la **Ligne**
3. Entrez le **Nom** de l'arrêt
4. Définissez la **Position** (ordre sur la ligne)
5. Cliquez sur **Créer**

### Modifier un arrêt

1. Cliquez sur **Modifier**
2. Modifiez le nom ou la position
3. Cliquez sur **Enregistrer**

> La ligne d'un arrêt ne peut pas être modifiée. Pour changer de ligne, supprimez et recréez l'arrêt.

### Supprimer un arrêt

1. Cliquez sur **Supprimer**
2. Confirmez

> Supprimer un arrêt supprime également tous ses horaires et retire l'appareil associé.

---

## Gestion des Horaires

### Accéder aux horaires

1. Cliquez sur **Horaires** dans le menu
2. Sélectionnez une **Ligne**
3. Sélectionnez un **Arrêt**

Les horaires de l'arrêt s'affichent triés par heure.

### Créer un horaire

1. Cliquez sur **+ Nouvel Horaire**
2. Remplissez :
   - **Heure de départ** : Format HH:MM
   - **Destination** : Terminus de cette course
   - **Jours** : Sélectionnez les jours de circulation
3. Cliquez sur **Créer**

### Raccourcis de sélection des jours

- **Jours ouvrés** : Lundi à Vendredi
- **Week-end** : Samedi et Dimanche
- **Tous les jours** : Lundi à Dimanche

### Modifier un horaire

1. Cliquez sur **Modifier**
2. Modifiez les informations
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

- Cochez **Actifs uniquement** pour voir seulement les messages en cours

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
   - Ligne associée
   - Statut (En ligne / Hors ligne / En attente)
   - Dernière connexion

### Filtrer par statut

Utilisez le menu déroulant pour filtrer :
- **Tous** : Tous les appareils
- **En ligne** : Appareils connectés
- **Hors ligne** : Appareils déconnectés
- **En attente** : Appareils jamais connectés

### Enregistrer un appareil

1. Cliquez sur **+ Enregistrer un appareil**
2. Sélectionnez la **Ligne**
3. Sélectionnez l'**Arrêt**
4. Cliquez sur **Enregistrer**
5. **Copiez le token** affiché

> **Important** : Le token n'est affiché qu'une seule fois. Conservez-le précieusement.

### Configurer l'écran

Sur l'appareil d'affichage, configurez l'URL :

```
https://transit.example.com/display?token=VOTRE_TOKEN
```

Ou pour un accès sans token (test) :

```
https://transit.example.com/display/STOP_ID
```

### Copier le token

Si vous avez besoin du token d'un appareil existant :
1. Cliquez sur **Copier le token**
2. Le token est copié dans le presse-papiers

### Supprimer un appareil

1. Cliquez sur **Supprimer**
2. Confirmez

> L'écran affichera une erreur jusqu'à ce qu'il soit réenregistré.

---

## Affichage Kiosque

L'écran kiosque affiche les informations voyageurs.

### Éléments affichés

1. **En-tête** : Nom de l'arrêt et ligne
2. **Prochains départs** : Liste des prochaines courses avec :
   - Destination
   - Temps d'attente (ou "MAINTENANT")
   - Heure programmée
3. **Messages** : Alertes et informations
4. **Pied de page** : Heure actuelle et statut de connexion

### Codes couleur du temps d'attente

- **Vert** : ≤ 5 minutes (départ imminent)
- **Jaune** : 6-10 minutes
- **Blanc** : > 10 minutes

### Statut de connexion

- **Connecté** (vert) : Mises à jour en temps réel
- **Déconnecté** (rouge) : Tentative de reconnexion

---

## Bonnes pratiques

### Messages

1. **Soyez concis** : Les voyageurs lisent rapidement
2. **Utilisez le bon niveau** : Réservez CRITICAL aux vraies urgences
3. **Définissez une fin** : Évitez les messages qui restent indéfiniment

### Horaires

1. **Vérifiez les jours** : Assurez-vous que les bons jours sont sélectionnés
2. **Destination claire** : Utilisez des noms reconnaissables

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
2. Vérifiez que le jour actuel est sélectionné
3. Vérifiez que l'heure de départ n'est pas déjà passée

### Comment changer mon mot de passe ?

Contactez l'administrateur système. La gestion des utilisateurs n'est pas disponible dans l'interface actuelle.
