// Web fallback for connection: does not import expo-sqlite so wa-sqlite.wasm is not bundled on web.

export async function getDatabase(): Promise<any> {
  throw new Error('SQLite database is supported on native mobile devices (Android / iOS). Please open this app using Expo Go on your phone or in an Android/iOS emulator.');
}

export async function initializeDatabase(): Promise<any> {
  return null;
}

export async function checkDatabaseIntegrity(): Promise<{ ok: boolean; message: string }> {
  return {
    ok: true,
    message: 'Web platform preview mode',
  };
}

export async function optimizeDatabase(): Promise<void> {}

export async function checkpointDatabase(): Promise<void> {}

export async function closeDatabase(): Promise<void> {}
