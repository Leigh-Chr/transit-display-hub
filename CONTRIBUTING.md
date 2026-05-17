# Contributing Guide

Thank you for your interest in contributing to Transit Display Hub!

## Code of Conduct

This project and everyone participating in it are governed by our code of conduct. By participating, you agree to uphold this code.

## How to Contribute

### Reporting a Bug

1. Check that the bug has not already been reported
2. Create an issue with:
   - Clear description of the problem
   - Steps to reproduce
   - Expected vs observed behavior
   - Screenshots if applicable
   - Application version

### Proposing a Feature

1. Check that the feature does not already exist
2. Create an issue with:
   - Feature description
   - Use cases
   - Impact on existing functionality

### Submitting Code

1. Fork the repository
2. Create a branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Commit (`git commit -m 'Add my feature'`)
5. Push (`git push origin feature/my-feature`)
6. Open a Pull Request

## Code Standards

### Backend (Java)

- Follow standard Java conventions
- Use Lombok to reduce boilerplate
- Document public methods with Javadoc
- Write unit tests for new features

```java
/**
 * Creates a new transit line.
 *
 * @param request the line data
 * @return the created line
 * @throws IllegalArgumentException if the code is already in use
 */
public Line create(CreateLineRequest request) {
    // ...
}
```

### Frontend (TypeScript)

- Use TypeScript strict mode
- Follow Angular style guide
- Use Signals for reactivity
- Document components and services

```typescript
/**
 * Line management service.
 * Provides CRUD operations for transit lines.
 */
@Injectable({ providedIn: 'root' })
export class LineService {
    // ...
}
```

## Commit Messages

Use descriptive commit messages:

```
type(scope): short description

Detailed description if needed.

Refs: #123
```

Types:
- `feat`: new feature
- `fix`: bug fix
- `docs`: documentation
- `style`: formatting, no code changes
- `refactor`: refactoring
- `perf`: performance improvement (no functional change)
- `test`: adding or modifying tests
- `chore`: maintenance

## Review Process

1. The PR will be reviewed by at least one maintainer
2. Comments must be resolved before merging
3. CI tests must pass
4. Code must meet the standards

## Questions

For any questions, open an issue with the `question` label.
