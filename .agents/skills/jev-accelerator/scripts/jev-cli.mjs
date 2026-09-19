#!/usr/bin/env node
import { askJev } from './client.mjs';

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
  question = { type: 'choice', instructions: instruction, criteria };
} else if (qType === 'score') {
  if (!Array.isArray(criteria)) {
    console.error(JSON.stringify({ error: 'Score requires --criteria as a JSON array of strings indexed from zero' }));
    process.exit(1);
  }
  question = { type: 'score', instructions: instruction, criteria };
} else {
  // noul
  question = criteria ? { type: 'noul', instructions: instruction, criteria } : { type: 'noul', instructions: instruction };
}

async function main() {
  try {
    const res = await askJev({
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
