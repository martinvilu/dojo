import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

export function resolveApiKey() {
  if (process.env.TYPESAFE_API_KEY) return process.env.TYPESAFE_API_KEY;
  const localEnv = resolve(process.cwd(), '.env.local');
  if (existsSync(localEnv)) {
    const match = readFileSync(localEnv, 'utf-8').match(/TYPESAFE_API_KEY=([^\r\n]+)/);
    if (match) return match[1].trim();
  }
  const homeEnv = resolve(homedir(), '.env');
  if (existsSync(homeEnv)) {
    const match = readFileSync(homeEnv, 'utf-8').match(/TYPESAFE_API_KEY=([^\r\n]+)/);
    if (match) return match[1].trim();
  }
  return undefined;
}

export async function askJev({ state, questions, model = 'jev-latest' }) {
  const apiKey = resolveApiKey();
  if (!apiKey) {
    throw new Error('TYPESAFE_API_KEY not found in env, .env.local, or ~/.env');
  }

  const res = await fetch('https://api.typesafe.ai/v1/systemone', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ state, model, questions })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`TypeSafe API error ${res.status}: ${errText}`);
  }

  return await res.json();
}
