jest.mock('node-fetch', () => jest.fn());
const fetch = require('node-fetch');

let mockFirestoreInstance;

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: () => mockFirestoreInstance,
  FieldValue: { serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP') }
}));

const { calendar } = require('../src/modules/calendar/calendar');
const { sendDailySummaries } = require('../src/modules/notifications/notifications');

function createRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status: jest.fn(function (code) {
      this.statusCode = code;
      return this;
    }),
    set: jest.fn(function (h) {
      Object.assign(this.headers, h);
      return this;
    }),
    send: jest.fn(function (b) {
      this.body = b;
      return this;
    })
  };
  return res;
}

describe('calendar HTTP endpoint & sendDailySummaries cron', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('calendar validates missing id, 404 course, and 401 invalid token', async () => {
    const res400 = createRes();
    await calendar({ query: {} }, res400);
    expect(res400.statusCode).toBe(400);

    mockFirestoreInstance = {
      collection: () => ({
        doc: () => ({ get: async () => ({ exists: false }) })
      })
    };
    const res404 = createRes();
    await calendar({ query: { id: 'c1', token: 'tok' } }, res404);
    expect(res404.statusCode).toBe(404);

    mockFirestoreInstance = {
      collection: () => ({
        doc: () => ({
          get: async () => ({
            exists: true,
            data: () => ({ calendar_secret: 'GOOD_SECRET' })
          })
        })
      })
    };
    const res401 = createRes();
    await calendar({ query: { id: 'c1', token: 'BAD_SECRET' } }, res401);
    expect(res401.statusCode).toBe(401);
  });

  test('calendar generates VEVENTs from class_instances with special statuses and merges external_calendars', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:Evento Externo\r\nEND:VEVENT\r\nEND:VCALENDAR'
    });

    mockFirestoreInstance = {
      collection: () => ({
        doc: () => ({
          get: async () => ({
            exists: true,
            data: () => ({
              name: 'Ingeniería de Software',
              calendar_secret: 'CAL_SECRET_123',
              class_instances: [
                { date: '2026-04-01T18:00:00Z', type: 'Teórica', special_status: 'Feriado' },
                {
                  date: '2026-04-08T18:00:00Z',
                  type: 'Teórica',
                  special_status: 'Examen',
                  topic: 'Parcial 1',
                  presentation_url: 'https://slides.com/1',
                  recording_url: 'https://video.com/1'
                },
                { date: '2026-04-15T18:00:00Z', type: 'Práctica', special_status: 'Clase Remota' }
              ],
              external_calendars: ['https://calendar.google.com/public.ics']
            })
          })
        })
      })
    };

    const res = createRes();
    await calendar({ query: { id: 'c1', token: 'CAL_SECRET_123' } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('SUMMARY:[EXAMEN] Ingeniería de Software - Teórica');
    expect(res.body).toContain('SUMMARY:[REMOTA] Ingeniería de Software - Práctica');
    expect(res.body).toContain('SUMMARY:Evento Externo');
  });

  test('calendar generates RRULE VEVENTs when course uses start_date + schedules', async () => {
    mockFirestoreInstance = {
      collection: () => ({
        doc: () => ({
          get: async () => ({
            exists: true,
            data: () => ({
              name: 'Bases de Datos',
              sync_secret: 'SYNC_SECRET_123',
              start_date: '2026-03-16',
              duration_weeks: 16,
              schedules: [
                { day: 'Miércoles', time: '18:00', type: 'Teórica' },
                { day: 'DíaInexistente', time: '10:00', type: 'Práctica' }
              ]
            })
          })
        })
      })
    };

    const res = createRes();
    await calendar({ query: { id: 'c1', token: 'SYNC_SECRET_123' } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('RRULE:FREQ=WEEKLY;COUNT=16;BYDAY=WE');
  });

  test('sendDailySummaries aggregates pending daily notifications per student', async () => {
    const batchDelete = jest.fn();
    const batchSet = jest.fn();
    const batchCommit = jest.fn().mockResolvedValue(true);

    mockFirestoreInstance = {
      collection: () => ({
        where: () => ({
          get: async () => ({
            empty: false,
            docs: [
              { id: 'n1', data: () => ({ student_id: 'stu1', message: 'Nota 1' }) },
              { id: 'n2', data: () => ({ student_id: 'stu1', message: 'Nota 2' }) }
            ]
          })
        }),
        doc: (id) => ({ id: id || 'summary_doc' })
      }),
      batch: () => ({
        delete: batchDelete,
        set: batchSet,
        commit: batchCommit
      })
    };

    await sendDailySummaries({});
    expect(batchDelete).toHaveBeenCalledTimes(2);
    expect(batchSet).toHaveBeenCalledTimes(1);
    expect(batchCommit).toHaveBeenCalledTimes(1);
  });
});
