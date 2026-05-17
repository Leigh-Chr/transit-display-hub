# Stage 1: Build
FROM eclipse-temurin:21-jdk-noble AS builder
WORKDIR /app
COPY gradle/ gradle/
COPY gradlew build.gradle.kts settings.gradle.kts ./
RUN ./gradlew dependencies --no-daemon
COPY src/ src/
RUN ./gradlew bootJar -x test --no-daemon

# Stage 2: Runtime
FROM eclipse-temurin:21-jre-noble
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
RUN groupadd --system appgroup && useradd --system --gid appgroup appuser
WORKDIR /app
# Glob the jar so a version bump (1.3.0 → 1.4.x → …) doesn't break the
# build. The Gradle bootJar emits exactly one transit-display-hub-*.jar.
COPY --from=builder /app/build/libs/transit-display-hub-*.jar app.jar
RUN chown -R appuser:appgroup /app
USER appuser
EXPOSE 8080
# Cap the heap so the container respects the cgroup memory limit on
# small hosts (Raspberry Pi kiosks). 75 % leaves room for native
# allocations (Netty buffers, JIT code cache, metaspace).
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:InitialRAMPercentage=50"
# Lean on the actuator health probe Spring Boot already exposes; if
# anything inside the JVM is wedged the orchestrator will see it.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl --fail --silent --show-error http://localhost:8080/actuator/health || exit 1
ENTRYPOINT ["java", "-jar", "app.jar"]
