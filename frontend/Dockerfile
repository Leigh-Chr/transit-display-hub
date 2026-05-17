# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Serve. Use nginx-unprivileged so the worker AND master
# processes run as a non-root user; bound to port 8080 (see nginx.conf)
# because non-root can't bind below 1024.
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY --from=build /app/dist/transit-display-hub/browser/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --spider http://localhost:8080/ || exit 1
