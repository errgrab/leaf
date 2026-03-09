from node:25.8
workdir /app
copy package*.json .
run npm ci
copy . .
expose 5173
cmd ["npm", "run", "dev", "--", "--host"]
