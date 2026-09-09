# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json .npmrc ./
RUN --mount=type=secret,id=npm_token,required=true \
    npm config set --location=user '//npm.pkg.github.com/:_authToken' "$(cat /run/secrets/npm_token)" && \
    npm ci && \
    rm -f /root/.npmrc

COPY . .
RUN npm run build

FROM nginx:1.29-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
