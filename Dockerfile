FROM node:24-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Secret contents do not invalidate Docker's cache; the helper supplies a hash revision.
ARG BUILD_REVISION=initial
RUN --mount=type=secret,id=primeui_license_key,required=true \
    test -n "$BUILD_REVISION" && npm test && \
    PRIMEUI_LICENSE_KEY_FILE=/run/secrets/primeui_license_key npm run build

FROM nginxinc/nginx-unprivileged:stable-alpine@sha256:f5116ed4606f3eb015dd4a8e28cb9b351476dc0ad4bc6e9f93b19cec130cdf03
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/workplace-utilities/browser/ /usr/share/nginx/html/
RUN nginx -t
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
