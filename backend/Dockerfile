# Stage 1: Build
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /app
COPY gradle/ gradle/
COPY gradlew build.gradle.kts settings.gradle.kts ./
RUN ./gradlew dependencies --no-daemon || true
COPY src/ src/
RUN ./gradlew bootJar -x test --no-daemon

# Stage 2: Runtime
FROM eclipse-temurin:21-jre-alpine
RUN apk add --no-cache curl
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app
# Glob the jar so a version bump (1.3.0 → 1.4.x → …) doesn't break the
# build. The Gradle bootJar emits exactly one transit-display-hub-*.jar.
COPY --from=builder /app/build/libs/transit-display-hub-*.jar app.jar
RUN chown -R appuser:appgroup /app
USER appuser
EXPOSE 8080
# Lean on the actuator health probe Spring Boot already exposes; if
# anything inside the JVM is wedged the orchestrator will see it.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl --fail --silent --show-error http://localhost:8080/actuator/health || exit 1
ENTRYPOINT ["java", "-jar", "app.jar"]
