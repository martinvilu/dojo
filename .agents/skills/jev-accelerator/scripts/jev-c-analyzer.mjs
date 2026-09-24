#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';
import { execSync } from 'node:child_process';
import { askJev } from './client.mjs';

const targetDir = process.argv[2] || process.cwd();
const absDir = resolve(process.cwd(), targetDir);

if (!existsSync(absDir)) {
  console.error(JSON.stringify({ error: `Path does not exist: ${absDir}` }));
  process.exit(1);
}

// 1. Recursive finder for C sources and build files
function findCFiles(dir, depth = 0) {
  if (depth > 4) return [];
  let results = [];
  try {
    const list = readdirSync(dir);
    for (const file of list) {
      if (file.startsWith('.') || file === 'node_modules' || file === 'build' || file === 'bin') continue;
      const fullPath = join(dir, file);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        results = results.concat(findCFiles(fullPath, depth + 1));
      } else {
        const ext = extname(file).toLowerCase();
        if (ext === '.c' || ext === '.h' || file === 'Makefile' || file === 'makefile' || file === 'CMakeLists.txt') {
          results.push(fullPath);
        }
      }
    }
  } catch {
    // Ignore unreadable dirs
  }
  return results;
}

const allFiles = statSync(absDir).isDirectory() ? findCFiles(absDir) : [absDir];

if (allFiles.length === 0) {
  console.error(JSON.stringify({ error: `No C files (.c, .h, Makefile) found in ${absDir}` }));
  process.exit(1);
}

// 2. Extract git log history if it is a git repo
let gitHistory = [];
try {
  const gitLog = execSync('git log -n 12 --oneline 2>/dev/null', { cwd: statSync(absDir).isDirectory() ? absDir : resolve(absDir, '..') }).toString().trim();
  if (gitLog) {
    gitHistory = gitLog.split('\n');
  }
} catch {
  // Not a git repo or no commits
}

// 3. Static checks on code (pre-filters in deterministic code)
let mallocCount = 0;
let callocCount = 0;
let freeCount = 0;
const unsafeCalls = [];
const fileSummaries = [];

for (const file of allFiles) {
  const relPath = file.replace(absDir, '').replace(/^\//, '');
  const content = readFileSync(file, 'utf-8');
  
  if (file.endsWith('.c') || file.endsWith('.h')) {
    const mallocMatches = content.match(/\bmalloc\s*\(/g);
    const callocMatches = content.match(/\bcalloc\s*\(/g);
    const freeMatches = content.match(/\bfree\s*\(/g);
    
    if (mallocMatches) mallocCount += mallocMatches.length;
    if (callocMatches) callocCount += callocMatches.length;
    if (freeMatches) freeCount += freeMatches.length;

    if (/\bgets\s*\(/.test(content)) unsafeCalls.push({ file: relPath, fn: 'gets' });
    if (/\bstrcpy\s*\(/.test(content)) unsafeCalls.push({ file: relPath, fn: 'strcpy' });
    if (/\bsprintf\s*\(/.test(content)) unsafeCalls.push({ file: relPath, fn: 'sprintf' });

    fileSummaries.push({
      file: relPath,
      lines: content.split('\n').length,
      sample: content.slice(0, 1800) // Sample first ~1.8KB
    });
  } else {
    // Makefile
    fileSummaries.push({
      file: relPath,
      sample: content.slice(0, 1000)
    });
  }
}

const totalAlloc = mallocCount + callocCount;

// 4. Formulate System One State & Evaluation with Jev
async function run() {
  try {
    const res = await askJev({
      model: 'jev-latest',
      state: {
        repository: relPath(absDir),
        filesDiscovered: fileSummaries.map(f => f.file),
        staticMetrics: {
          totalAllocations: totalAlloc,
          totalFrees: freeCount,
          allocFreeBalanced: totalAlloc === freeCount,
          unsafeFunctionsDetected: unsafeCalls
        },
        gitCommitHistory: gitHistory.length > 0 ? gitHistory : "No git commit history available",
        codeExcerpts: fileSummaries
      },
      questions: {
        memorySafetyDiscipline: {
          type: 'score',
          instructions: 'Evaluate pointer and dynamic memory management discipline (malloc/calloc vs free, NULL checks, pointer safety).',
          criteria: [
            'Severe memory leaks, dangling pointers, unvalidated malloc returns, or critical buffer vulnerabilities',
            'Basic memory usage with minor leaks, missing free calls, or incomplete NULL checks',
            'Good memory hygiene with systematic NULL checks, balanced frees, and safe bounds',
            'Exemplary defensive C programming with robust error handling, valgrind-clean allocation pairs, and boundary safety'
          ]
        },
        architectureModularity: {
          type: 'score',
          instructions: 'Evaluate code modularity, header file interfaces (.h), prototypes, and separation of concerns.',
          criteria: [
            'Monolithic file, global variables abused, missing header guards, or logic crammed in main',
            'Basic division into files, but coupled implementations or incomplete header interfaces',
            'Clean separation between interface (.h with include guards) and implementation (.c), good encapsulation'
          ]
        },
        buildSystemQuality: {
          type: 'noul',
          instructions: 'Does the repository contain a clean, functional Makefile with standard compiler warnings (-Wall, -Wextra) and clean target?'
        },
        commitProgression: {
          type: 'choice',
          instructions: 'How would you classify the git development progression reflected in the commit messages?',
          criteria: {
            incremental_development: 'Iterative, step-by-step progress demonstrating genuine student coding and debugging',
            monolithic_dump: 'Single or two bulk commits dumping the entire solution with no evolutionary history',
            superficial_commits: 'Commits are superficial, trivial formatting touches, or don\'t match genuine progress',
            no_git_history: 'No git commit history was provided to evaluate'
          }
        },
        errorHandlingAndRobustness: {
          type: 'score',
          instructions: 'Evaluate system call and I/O error handling (fopen, scanf, malloc checks, exit codes).',
          criteria: [
            'Ignores return codes from I/O or system calls, leading to potential segmentation faults on error',
            'Checks primary errors but lacks clean resource unwinding on failure',
            'Robust error handling with proper exit codes, informative error messages, and graceful cleanup'
          ]
        }
      }
    });

    const ans = res.answers;
    const memScore = ans.memorySafetyDiscipline.score; // 0..3
    const archScore = ans.architectureModularity.score; // 0..2
    const errScore = ans.errorHandlingAndRobustness.score; // 0..2
    const buildOk = ans.buildSystemQuality.noul; // 0..1
    const commitType = ans.commitProgression.choice;

    // Progression multiplier: encourage iterative git discipline
    let commitWeight = 10;
    let commitPenalty = 0;
    if (commitType === 'monolithic_dump') commitPenalty = 8;
    if (commitType === 'superficial_commits') commitPenalty = 5;

    // Calculate Grade Index (0-100)
    // Memory Safety: 35% | Error Handling: 25% | Architecture: 20% | Build: 10% | Git Discipline: 10%
    const grade = Math.max(0, Math.min(100, Math.round(
      (memScore / 3) * 35 +
      (errScore / 2) * 25 +
      (archScore / 2) * 20 +
      buildOk * 10 +
      (commitWeight - commitPenalty)
    )));

    const assessment = grade >= 85 ? 'SOBRESALIENTE' : grade >= 70 ? 'NOTABLE' : grade >= 50 ? 'APROBADO' : 'INSUFICIENTE';

    console.log(JSON.stringify({
      target: absDir,
      gradeIndex: grade,
      assessment,
      dimensions: {
        memorySafety: {
          score: memScore,
          max: 3,
          confidence: ans.memorySafetyDiscipline.confidence,
          staticAllocCount: totalAlloc,
          staticFreeCount: freeCount,
          unsafeFunctions: unsafeCalls
        },
        errorHandling: {
          score: errScore,
          max: 2,
          confidence: ans.errorHandlingAndRobustness.confidence
        },
        modularity: {
          score: archScore,
          max: 2,
          confidence: ans.architectureModularity.confidence
        },
        buildSystem: {
          hasProperMakefile: buildOk > 0.6,
          probability: buildOk
        },
        gitAuthorshipProgression: {
          classification: commitType,
          confidence: ans.commitProgression.confidence
        }
      },
      filesAnalyzed: fileSummaries.map(f => f.file)
    }, null, 2));

  } catch (err) {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  }
}

function relPath(p) {
  return p.split('/').slice(-2).join('/');
}

run();
