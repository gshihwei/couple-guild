import { cp, mkdir, rm, writeFile } from 'node:fs/promises';

const out = 'dist';
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp('index.html', `${out}/index.html`);
await cp('src', `${out}/src`, { recursive: true });
await cp('public', `${out}`, { recursive: true });

const config = `window.COUPLE_GUILD_CONFIG = ${JSON.stringify({
  SUPABASE_URL: supabaseUrl,
  SUPABASE_ANON_KEY: supabaseAnonKey,
}, null, 2)};\n`;

await writeFile(`${out}/config.js`, config, 'utf8');

console.log(`Static PWA build created in ${out}/`);
console.log(`Supabase config: ${supabaseUrl ? 'configured' : 'not configured (local/demo mode)'}`);
