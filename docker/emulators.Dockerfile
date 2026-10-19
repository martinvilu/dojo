# Emuladores de Firebase con versiones fijas de Node, Java y Firebase CLI
# (mejora 3.28): el mismo entorno en todas las máquinas y en CI.
FROM eclipse-temurin:21-jre-jammy AS java

FROM node:22-bookworm-slim
COPY --from=java /opt/java/openjdk /opt/java/openjdk
ENV JAVA_HOME=/opt/java/openjdk \
    PATH=/opt/java/openjdk/bin:$PATH \
    FIREBASE_CLI_EXPERIMENTS=webframeworks
ARG FIREBASE_TOOLS_VERSION=15.23.0
RUN npm install -g firebase-tools@${FIREBASE_TOOLS_VERSION} \
 && firebase setup:emulators:firestore \
 && firebase setup:emulators:ui
WORKDIR /workspace
EXPOSE 4000 4400 5001 8080 9099
CMD ["sh", "docker/start-emulators.sh"]
