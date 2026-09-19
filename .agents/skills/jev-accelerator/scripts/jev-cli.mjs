#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { TypeSafeClient, choice, noul, score } from '@typesafe-ai/sdk';

function resolveApiKey() {
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

const apiKey = resolveApiKey();
if (!apiKey) {
  console.error(JSON.stringify({ error: 'TYPESAFE_API_KEY not found in env, .env.local, or ~/.env' }));
  process.exit(1);
}

const client = new TypeSafeClient({ apiKey });

const args = process.argv.slice(2);
function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

const stateRaw = getArg('--state') || '';
const qType = getArg('--type') || 'noul';
const instruction = getArg('--instruction') || 'Evaluate the state';
const criteriaRaw = getArg('--criteria');

let state = stateRaw;
try {
  state = JSON.parse(stateRaw);
} catch {
  // string
}

let criteria = null;
if (criteriaRaw) {
  try {
    criteria = JSON.parse(criteriaRaw);
  } catch {
    criteria = criteriaRaw;
  }
}

let question;
if (qType === 'choice') {
  if (!criteria || typeof criteria !== 'object' || Array.isArray(criteria)) {
    console.error(JSON.stringify({ error: 'Choice requires --criteria as a JSON object mapping options to descriptions' }));
    process.exit(1);
  }
  question = choice(instruction, criteria);
} else if (qType === 'score') {
  if (!Array.isArray(criteria)) {
    console.error(JSON.stringify({ error: 'Score requires --criteria as a JSON array of strings indexed from zero' }));
    process.exit(1);
  }
  question = score(instruction, criteria);
} else {
  // noul
  question = criteria ? noul(instruction, criteria) : noul(instruction);
}

async function main() {
  try {
    const res = await client.systemOne({
      model: 'jev-latest',
      state,
      questions: { result: question }
    });
    console.log(JSON.stringify(res.answers.result, null, 2));
  } catch (err) {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  }
}

main();
