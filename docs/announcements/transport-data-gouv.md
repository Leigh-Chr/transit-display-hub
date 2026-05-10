# Forum / Slack transport.data.gouv.fr

Le PAN français anime un Slack public et un forum d'entraide.
La cible : développeurs et collectivités qui produisent /
consomment du GTFS en France.

Slack: <https://transport-data-gouv-fr.slack.com> (canal
`#community` ou `#data-mobilites`).

Forum: <https://forum.transport.data.gouv.fr/>

## Sujet — version forum

**Titre :** `[Annonce] Transit Display Hub 1.0 — back-office GTFS open-source avec kiosk + carte schématique`

**Corps :**

```
Bonjour à tous,

Je viens de sortir la 1.0 de Transit Display Hub, un projet
open-source qui couvre toute la chaîne d'exploitation d'un
flux GTFS dans un seul stack déployable :

— Un back-office d'administration (import GTFS avec
   validation par le runner officiel MobilityData,
   navigation des entités, journal d'audit).
— Un kiosk d'affichage temps réel pour les arrêts, avec
   support GTFS-Realtime (alertes, retards, occupation).
— Une carte schématique interactive du réseau, avec
   filtres tarifaires, accessibilité PMR, ring TAD, et
   alternative tabulaire pour les utilisateurs clavier /
   lecteur d'écran.
— Un installeur Raspberry Pi (curl | bash) qui monte
   PostgreSQL + l'API + le frontend + Chromium en mode
   plein écran sur un Pi 4.

Couverture GTFS à 100 % de la spec mai 2026 : Schedule v1
(les 20 fichiers), Fares v1+v2, GTFS-flex (canonique 2024),
GTFS-Realtime (alertes + trips + véhicules + en-tête).

Côté tech : Spring Boot 4 + Java 21 + Angular 21 + Material
M3 + PostgreSQL. Bascule FR/EN runtime via Transloco.
38 ADR documentent les choix non-évidents (intégration
MobilityData en bibliothèque vs CLI, point-in-polygon en
mémoire vs JTS, etc).

Le repo : https://github.com/Leigh-Chr/transit-display-hub

Je serais content si quelqu'un teste contre un flux qui n'est
pas Grenoble — particulièrement si vous avez des spécificités
GTFS-flex ou des extensions Fares v2 qui pourraient révéler
des bords mal couverts. Issues GitHub bienvenues.

Bonne lecture !
```

## Message Slack — plus court

```
Bonjour 👋

Je viens de sortir la 1.0 de Transit Display Hub :
back-office GTFS open-source + kiosk temps réel + carte
schématique, 100% spec coverage validée par MobilityData,
WCAG 2.2 AA, installeur Raspberry Pi.

Repo : https://github.com/Leigh-Chr/transit-display-hub

Si quelqu'un teste contre un flux non-Grenoble je suis très
preneur de retours, particulièrement sur GTFS-flex et
Fares v2.
```

## Notes

- Le Slack PAN est public mais demande une inscription. Le
  channel `#community` est le bon endroit pour les annonces.
- Ne pas croiser les posts Slack et forum dans la même
  semaine — les habitués des deux verront le doublon.
- Si Cerema ou Cityway répondent : prendre le temps de
  répondre, ce sont les acteurs qui peuvent référencer le
  projet sur leurs canaux respectifs.
