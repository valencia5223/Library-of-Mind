import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 동행복권은 브라우저에서 바로 부를 수 없어서(CORS) 개발 서버가 /dh 로 대신 받아 준다.
// 앱은 public/draws.json(빌드할 때 갱신)을 먼저 읽고, /dh 가 되면 그 뒤 새 회차를 더 받는다.
const dhProxy = {
  '/dh': {
    target: 'https://www.dhlottery.co.kr',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/dh/, ''),
    headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0 (lotto-gacha)' }
  }
};

export default defineConfig({
  base: './',
  plugins: [react()],
  server: { proxy: dhProxy },
  preview: { proxy: dhProxy }
});
