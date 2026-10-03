###################################
# Deps Stage (cache-stable)      #
###################################
FROM node:22-bookworm-slim AS deps

WORKDIR /app
COPY package*.json ./
RUN npm ci

###################################
# Build Stage                     #
###################################
FROM node:22-bookworm-slim AS build

LABEL Maintainer="Mahdi Haghverdi <mahdihaghverdiliewpl@gmail.com>"

RUN apt-get update -y && \
    apt-get upgrade -y && \
    apt-get install -y --no-install-recommends openssl bash && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx tsoa spec-and-routes && \
    npx prisma generate --schema=./src/db/schema.prisma && \
    npx tsc && \
    npm prune --omit=dev

###################################
# Runtime Stage                   #
###################################
FROM node:22-bookworm-slim AS runtime

RUN apt-get update -y && \
    apt-get install -y --no-install-recommends openssl bash && \
    rm -rf /var/lib/apt/lists/* && \
    groupadd -r app && useradd -r -g app app

WORKDIR /app
COPY --from=build --chown=app:app /app/package*.json ./
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/build ./build
COPY --from=build --chown=app:app /app/src/db/schema.prisma ./src/db/schema.prisma
COPY --chown=app:app entrypoint.sh ./
RUN chmod 755 ./entrypoint.sh

USER app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://localhost:8000/health').then((r)=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
ENTRYPOINT ["./entrypoint.sh"]
CMD ["npm", "start"]
