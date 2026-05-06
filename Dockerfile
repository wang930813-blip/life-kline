FROM node:20-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm ci --legacy-peer-deps

COPY . .

RUN npm run build \
  && npm prune --omit=dev --legacy-peer-deps \
  && npm cache clean --force

EXPOSE 3000

CMD ["node", "server/index.js"]
