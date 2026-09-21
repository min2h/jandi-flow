FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev=false

COPY . .
RUN npm run build

EXPOSE 8787
VOLUME ["/app/data"]

CMD ["npm", "start"]
