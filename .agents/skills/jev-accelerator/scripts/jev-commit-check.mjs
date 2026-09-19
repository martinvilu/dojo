#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { TypeSafeClient, noul, choice } from '@typesafe-ai/sdk';

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

const commitMessage = process.argv.slice(2).join(' ').trim();
if (!commitMessage) {
  console.error(JSON.stringify({ error: 'Usage: node jev-commit-check.mjs "<commit message>"' }));
  process.exit(1);
}

async function run() {
  try {
    const res = await client.systemOne({
      model: 'jev-latest',
      state: {
        commitMessage,
        specification: 'Format must strictly match: <type>(<scope>): <description>. Allowed types: feat, fix, docs, style, refactor, chore.'
      },
      questions: {
        isValidConventionalCommit: noul(
          'Does commitMessage strictly follow the format <type>(<scope>): <description> using one of the allowed types (feat, fix, docs, style, refactor, chore)?'
        ),
        inferredType: choice(
          'What is the primary conventional commit type for this message?',
          {
            feat: 'New features or additions',
            fix: 'Bug fixes',
            docs: 'Documentation changes',
            style: 'Formatting changes that do not affect code logic',
            refactor: 'Code restructuring without new features or fixes',
            chore: 'Maintenance, dependencies, tooling, or setup',
            invalid: 'Does not follow the conventional commit format'
          }
        )
      }
    });

    const valid = res.answers.isValidConventionalCommit.noul > 0.6;
    console.log(JSON.stringify({
      valid,
      probability: res.answers.isValidConventionalCommit.noul,
      inferredType: res.answers.inferredType.choice,
      confidence: res.answers.inferredType.confidence,
      commitMessage
    }, null, 2));

    if (!valid) {
      process.exit(1);
    }
  } catch (err) {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  }
}

run();
