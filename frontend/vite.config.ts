import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { vouchersDevPlugin } from './dev/vouchers-dev-plugin'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), vouchersDevPlugin()],
})
