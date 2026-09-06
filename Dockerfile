# Playwright image for the RacketBuddy browser automation service
FROM mcr.microsoft.com/playwright:v1.56.0-jammy

WORKDIR /app
COPY automation/package.json ./package.json
RUN npm install --omit=dev

COPY automation/src ./src

ENV NODE_ENV=production
EXPOSE 10000
CMD ["node", "src/server.js"]
