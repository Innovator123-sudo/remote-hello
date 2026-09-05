FROM node:20-alpine
WORKDIR /app
COPY tv-remote/package*.json ./tv-remote/
RUN cd tv-remote && npm ci --omit=dev --no-audit --no-fund
COPY tv-remote/ ./tv-remote/
COPY index.html test100.html test100.js app.js style.css ./
ENV PORT=8080
EXPOSE 8080
CMD ["node", "tv-remote/server.js"]
