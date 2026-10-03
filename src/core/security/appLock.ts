import { getDatabase } from '../db/connection';
import { sha256 } from './sha256';

export type LockType = 'none' | 'pin' | 'biometric';

export interface SecurityConfig {
  enabled: boolean;
  lockType: LockType;
  timeoutSeconds: number; // 0 = immediate, 60, 300, 900
  hasPin: boolean;
}

export class AppLockManager {
  private static failedAttempts = 0;
  private static lockoutUntil = 0;
  private static isLocked = false;
  private static backgroundTimestamp = 0;

  /**
   * Generates a random cryptographic salt.
   */
  private static generateSalt(): string {
    const chars = 'abcdef0123456789';
    let salt = '';
    for (let i = 0; i < 32; i++) {
      salt += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return salt;
  }

  /**
   * Loads current security configuration from SQLite database.
   */
  static async getConfig(): Promise<SecurityConfig> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ key: string; value: string }>(
      "SELECT key, value FROM settings WHERE key LIKE 'security.%'"
    );

    const map = new Map<string, string>();
    for (const r of rows) {
      map.set(r.key, r.value);
    }

    const enabled = map.get('security.enabled') === 'true';
    const lockType = (map.get('security.type') as LockType) || 'none';
    const timeoutSeconds = parseInt(map.get('security.timeout') || '0', 10);
    const hasPin = Boolean(map.get('security.pin_hash'));

    return {
      enabled,
      lockType: enabled ? lockType : 'none',
      timeoutSeconds,
      hasPin,
    };
  }

  /**
   * Sets or updates user PIN.
   */
  static async setPin(pin: string, lockType: LockType = 'pin'): Promise<void> {
    if (!pin || pin.length < 4) {
      throw new Error('PIN must be at least 4 digits');
    }

    const salt = this.generateSalt();
    const hash = sha256(pin + salt);

    const db = await getDatabase();
    await db.runAsync(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('security.pin_salt', ?)",
      [salt]
    );
    await db.runAsync(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('security.pin_hash', ?)",
      [hash]
    );
    await db.runAsync(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('security.enabled', 'true')"
    );
    await db.runAsync(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('security.type', ?)",
      [lockType]
    );

    this.failedAttempts = 0;
    this.lockoutUntil = 0;
  }

  /**
   * Disables security lock and removes PIN hash.
   */
  static async disableLock(): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('security.enabled', 'false')"
    );
    await db.runAsync(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('security.type', 'none')"
    );
    await db.runAsync("DELETE FROM settings WHERE key IN ('security.pin_hash', 'security.pin_salt')");

    this.isLocked = false;
    this.failedAttempts = 0;
    this.lockoutUntil = 0;
  }

  /**
   * Updates timeout setting (in seconds).
   */
  static async setTimeoutSeconds(seconds: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('security.timeout', ?)",
      [String(seconds)]
    );
  }

  /**
   * Verifies an entered PIN.
   */
  static async verifyPin(enteredPin: string): Promise<{ success: boolean; lockedOut: boolean; remainingSec: number }> {
    const now = Date.now();
    if (this.lockoutUntil > now) {
      const remainingSec = Math.ceil((this.lockoutUntil - now) / 1000);
      return { success: false, lockedOut: true, remainingSec };
    }

    const db = await getDatabase();
    const hashRow = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM settings WHERE key = 'security.pin_hash'"
    );
    const saltRow = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM settings WHERE key = 'security.pin_salt'"
    );

    if (!hashRow || !saltRow) {
      return { success: false, lockedOut: false, remainingSec: 0 };
    }

    const computedHash = sha256(enteredPin + saltRow.value);
    if (computedHash === hashRow.value) {
      this.failedAttempts = 0;
      this.lockoutUntil = 0;
      this.isLocked = false;
      return { success: true, lockedOut: false, remainingSec: 0 };
    }

    this.failedAttempts++;
    if (this.failedAttempts >= 5) {
      // 30 seconds lockout penalty
      this.lockoutUntil = Date.now() + 30000;
      return { success: false, lockedOut: true, remainingSec: 30 };
    }

    return { success: false, lockedOut: false, remainingSec: 0 };
  }

  /**
   * Records app going to background.
   */
  static onAppBackground(): void {
    this.backgroundTimestamp = Date.now();
  }

  /**
   * Evaluates if app should be locked upon resuming from background.
   */
  static async evaluateAppResume(): Promise<boolean> {
    const config = await this.getConfig();
    if (!config.enabled) {
      this.isLocked = false;
      return false;
    }

    if (this.backgroundTimestamp === 0) {
      this.isLocked = true;
      return true;
    }

    const elapsedSeconds = Math.floor((Date.now() - this.backgroundTimestamp) / 1000);
    if (elapsedSeconds >= config.timeoutSeconds) {
      this.isLocked = true;
      return true;
    }

    return this.isLocked;
  }

  static getIsLocked(): boolean {
    return this.isLocked;
  }

  static setLocked(locked: boolean): void {
    this.isLocked = locked;
  }
}
