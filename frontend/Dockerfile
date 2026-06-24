# PTES frontend — Vite dev server (source is bind-mounted by docker-compose)
FROM node:20-slim

WORKDIR /app

# Install deps in-image (musl/glibc-correct binaries); a named volume keeps
# /app/node_modules from being shadowed by the source bind-mount.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173

# --host 0.0.0.0 so the dev server is reachable through the published port.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
