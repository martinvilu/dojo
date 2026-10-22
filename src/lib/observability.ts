/**
 * Qué recolecta Sentry (mejora 5.07): nada que identifique a estudiantes o
 * docentes. Se comparte entre servidor y navegador.
 */
export const PRIVATE_DATA_COLLECTION: {
  userInfo: boolean;
  cookies: boolean;
  httpHeaders: boolean;
  httpBodies: never[];
  urlQueryParams: boolean;
  databaseQueryData: boolean;
} = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  databaseQueryData: false,
};
