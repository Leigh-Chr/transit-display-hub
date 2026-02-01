# Guide de contribution

Merci de votre intérêt pour contribuer à Transit Display Hub !

## Code de conduite

Ce projet et toutes les personnes qui y participent sont régis par notre code de conduite. En participant, vous vous engagez à respecter ce code.

## Comment contribuer

### Signaler un bug

1. Vérifiez que le bug n'a pas déjà été signalé
2. Créez une issue avec :
   - Description claire du problème
   - Étapes pour reproduire
   - Comportement attendu vs observé
   - Captures d'écran si applicable
   - Version de l'application

### Proposer une fonctionnalité

1. Vérifiez que la fonctionnalité n'existe pas déjà
2. Créez une issue avec :
   - Description de la fonctionnalité
   - Cas d'usage
   - Impact sur l'existant

### Soumettre du code

1. Fork le repository
2. Créez une branche (`git checkout -b feature/ma-fonctionnalite`)
3. Faites vos modifications
4. Committez (`git commit -m 'Ajout de ma fonctionnalité'`)
5. Pushez (`git push origin feature/ma-fonctionnalite`)
6. Ouvrez une Pull Request

## Standards de code

### Backend (Java)

- Suivre les conventions Java standard
- Utiliser Lombok pour réduire le boilerplate
- Documenter les méthodes publiques avec Javadoc
- Écrire des tests unitaires pour les nouvelles fonctionnalités

```java
/**
 * Crée une nouvelle ligne de transport.
 *
 * @param request les données de la ligne
 * @return la ligne créée
 * @throws IllegalArgumentException si le code est déjà utilisé
 */
public Line create(CreateLineRequest request) {
    // ...
}
```

### Frontend (TypeScript)

- Utiliser TypeScript strict mode
- Suivre le style Angular
- Utiliser les Signals pour la réactivité
- Documenter les composants et services

```typescript
/**
 * Service de gestion des lignes.
 * Fournit les opérations CRUD pour les lignes de transport.
 */
@Injectable({ providedIn: 'root' })
export class LineService {
    // ...
}
```

## Messages de commit

Utilisez des messages de commit descriptifs :

```
type(scope): description courte

Description détaillée si nécessaire.

Refs: #123
```

Types :
- `feat` : nouvelle fonctionnalité
- `fix` : correction de bug
- `docs` : documentation
- `style` : formatage, pas de changement de code
- `refactor` : refactoring
- `test` : ajout ou modification de tests
- `chore` : maintenance

## Processus de revue

1. La PR sera revue par au moins un mainteneur
2. Les commentaires doivent être résolus avant le merge
3. Les tests CI doivent passer
4. Le code doit respecter les standards

## Questions

Pour toute question, ouvrez une issue avec le label `question`.
