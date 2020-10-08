FROM node:14.13.0-stretch-slim

RUN mkdir -p /app
# ENV ZEEBE_NODE_PUREJS=true
COPY ./package.json /app/package.json
RUN cd /app && npm install --production
ENV NODE_PATH=/app/node_modules

ENTRYPOINT ["node", "/app/server.js"]
