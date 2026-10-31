FROM node:20-slim
WORKDIR /app

# Fonts for addresses in Malayalam, Hindi and other Indian scripts on the location stamp
RUN apt-get update && apt-get install -y --no-install-recommends fontconfig fonts-noto-core && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm install

COPY . .

CMD ["npm", "start"]

