# Playwright kører ikke på Renders almindelige Node-miljø: browseren har
# brug for et snes systembiblioteker, der ikke er der. Playwrights eget
# billede har dem, og versionen skal matche pakkens præcist — ellers
# leder Playwright efter en browser, der ikke findes i billedet.
FROM mcr.microsoft.com/playwright:v1.56.0-jammy

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

COPY src ./src

ENV NODE_ENV=production
EXPOSE 10000
CMD ["node", "src/server.js"]
