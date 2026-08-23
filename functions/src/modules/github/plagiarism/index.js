const logger = require("firebase-functions/logger");
const {
    isCodeFile,
    MAX_FILE_SIZE,
    fingerprintFiles,
    similarity,
} = require("./engine");

const DEFAULT_THRESHOLD = 60; // % jaccard to flag a pair
const MAX_FILES_PER_REPO = 40;

function parseRepoUrl(repoUrl) {
    const clean = String(repoUrl || '').trim().replace(/\/$/, '').replace(/\.git$/, '');
    const parts = clean.replace(/^https?:\/\/github\.com\//i, '').split('/');
    if (parts.length < 2 || !parts[0] || !parts[1]) return null;
    return { owner: parts[0], repo: parts[1] };
}

function githubHeaders(token) {
    return {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Jutsu-Classroom'
    };
}

async function fetchRepoFingerprint(repoUrl, token) {
    const parsed = parseRepoUrl(repoUrl);
    if (!parsed) return { error: "URL de repo inválida" };

    const headers = githubHeaders(token);
    const base = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`;

    const metaRes = await fetch(base, { headers });
    if (!metaRes.ok) return { error: `No se pudo acceder al repo (${metaRes.status})` };
    const branch = (await metaRes.json()).default_branch || 'main';

    const treeRes = await fetch(`${base}/git/trees/${branch}?recursive=1`, { headers });
    if (!treeRes.ok) return { error: `No se pudo leer el árbol del repo (${treeRes.status})` };
    const tree = (await treeRes.json()).tree || [];

    const candidates = tree
        .filter((n) => n.type === 'blob' && isCodeFile(n.path) && (n.size || 0) <= MAX_FILE_SIZE)
        .slice(0, MAX_FILES_PER_REPO);

    if (candidates.length === 0) return { error: "El repo no contiene archivos de código analizables" };

    const files = [];
    for (const node of candidates) {
        try {
            const raw = await fetch(
                `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${branch}/${node.path}`,
                { headers: { 'User-Agent': 'Jutsu-Classroom' } }
            );
            if (raw.ok) files.push({ path: node.path, content: await raw.text() });
        } catch (e) {
            logger.warn(`[plagiarism] fetch falló para ${node.path}:`, e.message);
        }
    }

    const fp = fingerprintFiles(files);
    if (fp.size === 0) return { error: "Sin contenido analizable" };
    return { fp, fileCount: files.length };
}

async function detectAssignmentPlagiarism(payload, context) {
    const { db, uid, getMyProfile } = context;
    const assignmentId = payload.assignmentId;
    const threshold = Math.min(100, Math.max(10, parseInt(payload.threshold, 10) || DEFAULT_THRESHOLD));

    if (!assignmentId) throw new Error("Falta el ID de la tarea");

    const profile = await getMyProfile();
    const aSnap = await db.collection('assignments').doc(assignmentId).get();
    if (!aSnap.exists) throw new Error("Tarea no encontrada");
    const assignment = aSnap.data();

    let authorized = profile?.role === 'admin';
    if (!authorized) {
        const tSnap = await db.collection('course_teachers').doc(`${assignment.course_id}_${uid}`).get();
        authorized = tSnap.exists;
    }
    if (!authorized) throw new Error("Solo el docente de la cátedra puede detectar plagio");

    const cSnap = await db.collection('courses').doc(assignment.course_id).get();
    const course = cSnap.exists ? cSnap.data() : {};
    if (!course.github_token) throw new Error("Configurá primero el token de GitHub de la cátedra en Ajustes.");

    const subsSnap = await db.collection('submissions')
        .where('assignment_id', '==', assignmentId).get();

    const analyzed = [];
    const skipped = [];

    for (const doc of subsSnap.docs) {
        const sub = doc.data();
        const label = sub.profiles?.full_name || sub.student_id;
        if (!sub.github_repo && !sub.repo_url) {
            skipped.push({ student: label, reason: "Entrega sin repositorio" });
            continue;
        }
        const url = sub.repo_url || sub.github_repo;
        try {
            const res = await fetchRepoFingerprint(url, course.github_token);
            if (res.error) skipped.push({ student: label, reason: res.error });
            else analyzed.push({
                submissionId: doc.id,
                studentId: sub.student_id,
                name: label,
                repo: url,
                fp: res.fp,
                fileCount: res.fileCount
            });
        } catch (e) {
            logger.error("[plagiarism] análisis falló:", url, e);
            skipped.push({ student: label, reason: e.message });
        }
    }

    const pairs = [];
    for (let i = 0; i < analyzed.length; i++) {
        for (let j = i + 1; j < analyzed.length; j++) {
            const sim = similarity(analyzed[i].fp, analyzed[j].fp);
            const score = Math.max(sim.jaccard, Math.min(sim.containmentA, sim.containmentB));
            pairs.push({
                a: { name: analyzed[i].name, studentId: analyzed[i].studentId, repo: analyzed[i].repo },
                b: { name: analyzed[j].name, studentId: analyzed[j].studentId, repo: analyzed[j].repo },
                jaccard: sim.jaccard,
                containment: Math.max(sim.containmentA, sim.containmentB),
                score,
                flagged: score >= threshold
            });
        }
    }
    pairs.sort((x, y) => y.score - x.score);

    return {
        threshold,
        analyzedCount: analyzed.length,
        skipped,
        flaggedCount: pairs.filter(p => p.flagged).length,
        pairs
    };
}

module.exports = { detectAssignmentPlagiarism };
