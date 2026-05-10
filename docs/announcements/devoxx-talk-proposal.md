# Conference talk proposal

Three CFPs to target in 2027:

| Conference | CFP window | Audience size | Format expected |
|------------|------------|---------------|-----------------|
| Devoxx France | Q4 2026 → Jan 2027 | 3000+ | Talk 45 min + lightning 15 min |
| Mix-IT (Lyon) | Q1 2027 | 800 | Talk 45 min + workshop 3 h |
| Touraine Tech (Tours) | Q2 2027 | 400 | Talk 30 min |

## Talk title (FR)

> **GTFS de A à Z : construire un back-office, un kiosk et
> une carte schématique avec Spring Boot et Angular**

## Abstract (≤ 1500 caractères, FR)

```
GTFS — General Transit Feed Specification — est le format
qui décrit n'importe quel réseau de transport public dans
le monde. Sa spec a doublé de surface en cinq ans :
Fares v2, GTFS-flex pour le transport à la demande, et
GTFS-Realtime pour le temps réel. La quasi-totalité des
outils open-source s'arrêtent à un parser ou à un
validateur — il manque le pont entre "j'ai des données" et
"j'ai un kiosk déployé sur un Raspberry Pi à un arrêt".

Dans ce talk, je présente la conception et l'implémentation
de Transit Display Hub, un projet open-source qui couvre
toute la chaîne dans un seul stack : administration GTFS,
carte schématique interactive, kiosk temps réel,
installeur Pi. On verra ensemble :

1. Comment importer un flux GTFS de bout en bout (les 20
   fichiers + extensions Fares v2 et flex), avec validation
   par le runner canonique MobilityData en bibliothèque
   Java.
2. Comment dessiner une carte schématique sans Leaflet, en
   SVG pur, avec filtres tarifaires, accessibilité PMR,
   ring TAD, et alternative tabulaire WCAG 2.2 AA.
3. Comment hardener un kiosk pour 24/7 (reconnect WebSocket,
   high-contrast palette, Web Speech API, large-text mode).
4. Comment industrialiser le tout : ADR, JaCoCo, Vitest,
   Playwright smoke E2E, GitHub Actions, Docker multi-arch.

Le code est sur GitHub. Le talk se veut pragmatique : pas
de slides "comment marche un MaaS", mais des choix
concrets — bibliothèque vs sub-process, point-in-polygon
en mémoire vs JTS, Transloco vs @angular/localize.

Profil cible : développeurs Java + Angular qui veulent voir
comment construire un produit complet à partir d'une
spécification ouverte.
```

## Bio (≤ 600 caractères, FR)

```
Développeur full-stack passionné par les standards ouverts
et les transports publics. Auteur de Transit Display Hub,
projet open-source qui couvre toute la chaîne GTFS dans un
seul stack (back-office + kiosk + carte). Je code en Java
et Angular depuis [N] ans et j'aime particulièrement les
sujets à l'intersection de l'accessibilité, de la
performance et de l'observabilité.

[Adapter la bio avec la durée d'expérience et un lien
GitHub / LinkedIn personnel.]
```

## Lightning talk version (15 min — Devoxx)

> Titre : **Le validateur GTFS officiel comme bibliothèque
> Java : retour d'expérience**
>
> 12 minutes pour montrer comment intégrer le runner
> MobilityData en `gtfs-validator-main` + `-core` dans un
> Spring Boot, avec post-import automatique et UI admin
> servant le rapport HTML. ADR 0034 du repo comme contenu.

## Workshop version (3h — Mix-IT)

> Titre : **Construire un kiosk d'arrêt accessible en 3h —
> du flux GTFS au Raspberry Pi**
>
> Format hands-on : les participants partent du repo,
> branchent leur propre flux GTFS local (les organisateurs
> fournissent le flux Lyon TCL), et finissent avec un
> kiosk fullscreen sur leur poste. Couvre : import,
> network-map, kiosk, accessibilité, Docker compose.

## Notes

- Soumettre le talk principal en premier ; le lightning
  comme back-up si le talk principal n'est pas retenu.
- Les CFP demandent souvent une vidéo de talk précédent —
  filmer un meetup local ou un Devoxx Hour avant de
  postuler.
- Mentionner systématiquement que le projet est en
  open-source et que les slides + code seront publiés ;
  les comités favorisent ça.
