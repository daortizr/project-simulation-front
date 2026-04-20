# Project simulator (front)

## Run locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a .env file with the content of .env.example

3. Start the dev server:

   ```bash
   npm run dev
   ```

   Open the URL printed in the terminal (typically `http://localhost:5173`).

4. Have the **API** running on **port 3000** so proxied `/api` requests succeed, or adjust the proxy `target` in `vite.config.ts` to match your backend.

