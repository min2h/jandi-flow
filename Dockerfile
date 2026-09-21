FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates tzdata \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev=false

COPY . .
RUN npm run build

ENV TZ=Asia/Seoul
EXPOSE 8787
VOLUME ["/app/data"]

CMD ["npm", "start"]
