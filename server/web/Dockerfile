# ── Build Stage ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --silent

COPY . .

# Use placeholder values — replaced at container startup by entrypoint
ARG REACT_APP_EMAILJS_PUBLIC_KEY
ENV REACT_APP_API_URL=__REACT_APP_API_URL__
ENV REACT_APP_RTC_URL=__REACT_APP_RTC_URL__
ENV REACT_APP_USE_HTTPS=__REACT_APP_USE_HTTPS__
ENV REACT_APP_EMAILJS_PUBLIC_KEY=$REACT_APP_EMAILJS_PUBLIC_KEY

RUN npm run build
#RUN npm run start

# ── Serve Stage ────────────────────────────────────────────────────────────────
FROM nginx:stable-alpine

RUN apk add --no-cache openssl && \
    mkdir -p /etc/nginx/certs && \
    openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
      -keyout /etc/nginx/certs/key.pem \
      -out    /etc/nginx/certs/cert.pem \
      -subj "/CN=localhost" \
      -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Entrypoint: replace placeholders in built JS with real runtime env vars
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 80 443

CMD ["/docker-entrypoint.sh"]
