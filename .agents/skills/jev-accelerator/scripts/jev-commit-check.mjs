#!/usr/bin/env node
import { askJev } from './client.mjs';

const commitMessage = process.argv.slice(2).join(' ').trim();
if (!commitMessage) {
  console.error(JSON.stringify({ error: 'Usage: node jev-commit-check.mjs "<commit message>"' }));
  process.exit(1);
}

async function run() {
  try {
    const res = await askJev({
      model: 'jev-latest',
      state: {
        commitMessage,
        specification: 'Format must strictly match: <type>(<scope>): <description>. Allowed types: feat, fix, docs, style, refactor, chore.'
      },
      questions: {
        isValidConventionalCommit: {
          type: 'noul',
          instructions: 'Does commitMessage strictly follow the format <type>(<scope>): <description> using one of the allowed types (feat, fix, docs, style, refactor, chore)?'
        },
        inferredType: {
          type: 'choice',
          instructions: 'What is the primary conventional commit type for this message?',
          criteria: {
            feat: 'New features or additions',
            fix: 'Bug fixes',
            docs: 'Documentation changes',
            style: 'Formatting changes that do not affect code logic',
            refactor: 'Code restructuring without new features or fixes',
            chore: 'Maintenance, dependencies, tooling, or setup',
            invalid: 'Does not follow the conventional commit format'
          }
        }
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
