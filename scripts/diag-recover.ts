/* eslint-disable no-console */
import { readFileSync } from 'node:fs';

const env = readFileSync('.env', 'utf8');
function get(k: string): string {
  const m = env.match(new RegExp(`^${k}\\s*=\\s*"?([^"\\r\\n]+)"?`, 'm'));
  if (!m) throw new Error(`missing ${k}`);
  return m[1];
}

const url = `${get('NEXT_PUBLIC_SUPABASE_URL')}/auth/v1/recover`;
const anon = get('NEXT_PUBLIC_SUPABASE_ANON_KEY');

async function test(email: string) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const text = await res.text();
  console.log(`${email}  ->  status=${res.status}`);
  console.log(`  body: ${text.slice(0, 800)}`);
}

async function main() {
  await test('datemric@gmail.com');
  console.log('---');
  await test('chishinmbachanda06@gmail.com');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
