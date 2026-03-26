# Vashira Headless Node - Docker Deployment
FROM node:18-slim

# Install sqlite3 runtime dependencies
RUN apt-get update && apt-get install -y python3 make g++

WORKDIR /vashira

# Copy files from both vashira-app and vashira-node as node needs database.ts
COPY ./vashira-app ./vashira-app
COPY ./vashira-node ./vashira-node

WORKDIR /vashira/vashira-node
RUN npm install
RUN npm run build

# Storage volume for the Sovereign Database
VOLUME /vashira/vashira-node/data
ENV VASHIRA_HUB_PATH=/vashira/vashira-node/data

# Ports:
# 3000: Status API
# 41234: UDP P2P Discovery
EXPOSE 3000
EXPOSE 41234/udp

CMD ["npm", "start"]
