/**
 * Respaldo diario completo de Firestore a Cloud Storage (mejora 3.22).
 *
 * A diferencia del respaldo integrado (un documento con cursos, tareas y
 * perfiles), exporta TODAS las colecciones con el servicio administrado de
 * Firestore, sin límite de tamaño. Se restaura con
 * `gcloud firestore import gs://<bucket>/<prefijo>`.
 *
 * Requiere: BACKUP_BUCKET (p. ej. gs://jutsu-classroom-mrtin-backups) y que
 * la cuenta de servicio de Functions tenga roles/datastore.importExportAdmin
 * y permiso de escritura en el bucket. Sin BACKUP_BUCKET no hace nada.
 */
function exportPrefix(bucket, now = new Date()) {
    const base = String(bucket).replace(/\/+$/, '');
    return `${base.startsWith('gs://') ? base : `gs://${base}`}/firestore/${now.toISOString().slice(0, 10)}`;
}

async function exportFirestore({ projectId, bucket, client, logger, now = new Date() }) {
    if (!bucket) {
        if (logger) logger.info('[firestoreExport] BACKUP_BUCKET no configurado: se omite el export diario.');
        return null;
    }
    const outputUriPrefix = exportPrefix(bucket, now);
    const [operation] = await client.exportDocuments({
        name: client.databasePath(projectId, '(default)'),
        outputUriPrefix,
        collectionIds: [] // todas las colecciones
    });
    if (logger) logger.info('[firestoreExport] export iniciado', { outputUriPrefix, operation: operation.name });
    return { outputUriPrefix, operation: operation.name };
}

module.exports = { exportFirestore, exportPrefix };
