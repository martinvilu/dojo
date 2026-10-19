const { exportFirestore, exportPrefix } = require('../src/modules/system/firestoreExport');

describe('dailyFirestoreExport (mejora 3.22)', () => {
  const now = new Date('2026-10-19T07:00:00Z');

  it('exports every collection under a dated prefix', async () => {
    const client = {
      databasePath: (p, d) => `projects/${p}/databases/${d}`,
      exportDocuments: jest.fn().mockResolvedValue([{ name: 'op/123' }])
    };
    const res = await exportFirestore({ projectId: 'jutsu', bucket: 'gs://jutsu-backups/', client, now });
    expect(client.exportDocuments).toHaveBeenCalledWith({
      name: 'projects/jutsu/databases/(default)',
      outputUriPrefix: 'gs://jutsu-backups/firestore/2026-10-19',
      collectionIds: []
    });
    expect(res).toEqual({ outputUriPrefix: 'gs://jutsu-backups/firestore/2026-10-19', operation: 'op/123' });
  });

  it('does nothing without a bucket', async () => {
    const client = { exportDocuments: jest.fn() };
    expect(await exportFirestore({ projectId: 'jutsu', bucket: '', client })).toBeNull();
    expect(client.exportDocuments).not.toHaveBeenCalled();
  });

  it('normalizes bucket names', () => {
    expect(exportPrefix('jutsu-backups', now)).toBe('gs://jutsu-backups/firestore/2026-10-19');
  });
});
