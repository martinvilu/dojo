#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { askJev } from './client.mjs';

const targetPath = process.argv[2];
if (!targetPath) {
  console.error(JSON.stringify({ error: 'Usage: node jev-doc-quality.mjs <file-path.md>' }));
  process.exit(1);
}

const absPath = resolve(process.cwd(), targetPath);
if (!existsSync(absPath)) {
  console.error(JSON.stringify({ error: `File not found: ${absPath}` }));
  process.exit(1);
}

const content = readFileSync(absPath, 'utf-8');
const docSnippet = content.length > 4000 ? content.slice(0, 4000) + '\n\n...[content truncated for analysis]...' : content;

async function run() {
  try {
    const res = await askJev({
      model: 'jev-latest',
      state: {
        documentPath: targetPath,
        content: docSnippet
      },
      questions: {
        pedagogicalClarity: {
          type: 'score',
          instructions: 'How clearly does this document explain concepts to a learner, using progressive learning and clear definitions?',
          criteria: [
            'Confusing, unstructured, or heavily laden with unexplained jargon',
            'Basic coverage but jumps abruptly between concepts without scaffolded progression',
            'Clear and instructive with sound progression and structured sections',
            'Exemplary educational quality with scaffolded learning, guidance, and intuitive explanations'
          ]
        },
        technicalCompleteness: {
          type: 'score',
          instructions: 'How complete and rigorous is the technical content (prerequisites, setup, commands, code examples, edge cases)?',
          criteria: [
            'Vague or incomplete with missing commands and ambiguous instructions',
            'Partially complete but misses prerequisites, error cases, or verification steps',
            'Solid technical documentation with clear commands, architecture, and verification',
            'Exhaustive, rigorous, and production-grade technical manual'
          ]
        },
        hasRunnableExamples: {
          type: 'noul',
          instructions: 'Does the document contain concrete, runnable code snippets, commands, or workflow examples?'
        },
        hasClearPrerequisites: {
          type: 'noul',
          instructions: 'Does the document clearly state prerequisites, target environment, or required dependencies?'
        },
        audienceLevel: {
          type: 'choice',
          instructions: 'What is the best-fit target audience level for this document?',
          criteria: {
            beginner: 'Introductory, beginner students or newcomers',
            intermediate: 'Intermediate developers or regular students',
            advanced: 'Advanced contributors, architects, or instructors',
            unfocused: 'Unclear or inconsistent target audience'
          }
        }
      }
    });

    const ans = res.answers;
    const pedScore = ans.pedagogicalClarity.score; // 0..3
    const techScore = ans.technicalCompleteness.score; // 0..3
    const runnable = ans.hasRunnableExamples.noul; // 0..1
    const prereqs = ans.hasClearPrerequisites.noul; // 0..1

    // Composite scoring calculation in deterministic code (0-100 index)
    // Pedagogical (35%) + Technical (35%) + Runnable Examples (15%) + Prerequisites (15%)
    const qualityIndex = Math.round(
      (pedScore / 3) * 35 +
      (techScore / 3) * 35 +
      runnable * 15 +
      prereqs * 15
    );

    const level = qualityIndex >= 80 ? 'EXCELENTE' : qualityIndex >= 60 ? 'BUENO' : qualityIndex >= 40 ? 'MEJORABLE' : 'DEFICIENTE';

    console.log(JSON.stringify({
      file: targetPath,
      overallQualityIndex: qualityIndex,
      qualityLevel: level,
      scores: {
        pedagogicalClarity: { score: pedScore, max: 3, confidence: ans.pedagogicalClarity.confidence },
        technicalCompleteness: { score: techScore, max: 3, confidence: ans.technicalCompleteness.confidence }
      },
      checks: {
        hasRunnableExamples: runnable > 0.6,
        hasRunnableExamplesProbability: runnable,
        hasClearPrerequisites: prereqs > 0.6,
        hasClearPrerequisitesProbability: prereqs
      },
      targetAudience: {
        level: ans.audienceLevel.choice,
        confidence: ans.audienceLevel.confidence
      }
    }, null, 2));

  } catch (err) {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  }
}

run();
