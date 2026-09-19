#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { TypeSafeClient, choice } from '@typesafe-ai/sdk';

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
  console.error(JSON.stringify({ error: 'TYPESAFE_API_KEY not found' }));
  process.exit(1);
}

const client = new TypeSafeClient({ apiKey });

const args = process.argv.slice(2);
const queryIdx = args.indexOf('--query');
if (queryIdx === -1 || !args[queryIdx + 1]) {
  console.error(JSON.stringify({ error: 'Usage: node jev-rerank.mjs --query "..." <file1> <file2>...' }));
  process.exit(1);
}

const query = args[queryIdx + 1];
const files = args.filter((_, i) => i !== queryIdx && i !== queryIdx + 1 && !args[i].startsWith('--'));

if (files.length === 0) {
  console.error(JSON.stringify({ error: 'No files provided for reranking' }));
  process.exit(1);
}

if (files.length === 1) {
  console.log(JSON.stringify({ selected: files[0], confidence: 1.0, reason: 'Single candidate' }));
  process.exit(0);
}

const criteria = {};
for (const file of files.slice(0, 15)) {
  criteria[file] = `Candidate file path: ${file}`;
}

async function run() {
  try {
    const res = await client.systemOne({
      model: 'jev-latest',
      state: {
        taskDescription: query,
        candidateFiles: Object.keys(criteria)
      },
      questions: {
        targetFile: choice(
          'Which candidate file is most directly responsible for the task described in taskDescription?',
          criteria
        )
      }
    });

    const ans = res.answers.targetFile;
    console.log(JSON.stringify({
      selected: ans.choice,
      confidence: ans.confidence,
      distribution: ans.distribution
    }, null, 2));
  } catch (err) {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  }
}

run();
