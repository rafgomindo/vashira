import fs from 'node:fs';
import path from 'node:path';

/**
 * Main-process settings (v10.2), stored as <userData>/settings.json.
 *
 * Plain settings are things the main process itself must act on (e.g. whether
 * to announce imports on the LAN). Secrets (API keys) are encrypted with
 * Electron's safeStorage (DPAPI on Windows, Keychain on macOS, the OS keyring
 * on Linux) instead of sitting in plaintext localStorage.
 */

export type SettingKey = 'shareOnLan';
export type SecretName = 'oracle' | 'zotero' | 'openalex';
export const SETTING_KEYS: SettingKey[] = ['shareOnLan'];
export const SECRET_NAMES: SecretName[] = ['oracle', 'zotero', 'openalex'];

type SettingsFile = { [K in SettingKey]?: unknown } & { secrets?: Record<string, string> };

let cache: SettingsFile | null = null;

function settingsPath() {
  const { app } = require('electron');
  return path.join(app.getPath('userData'), 'settings.json');
}

function load(): SettingsFile {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(settingsPath(), 'utf8'));
  } catch {
    cache = {};
  }
  return cache as SettingsFile;
}

function save() {
  const file = settingsPath();
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(cache, null, 2));
  fs.renameSync(tmp, file); // atomic replace: a crash mid-write can't corrupt settings
}

export function getSetting(key: SettingKey): unknown {
  return load()[key];
}

export function setSetting(key: SettingKey, value: unknown) {
  load()[key] = value;
  save();
}

function safeStorage() {
  const { safeStorage } = require('electron');
  return safeStorage;
}

export function getSecret(name: SecretName): any {
  const stored = load().secrets?.[name];
  if (!stored) return null;
  try {
    const raw = Buffer.from(stored, 'base64');
    const json = safeStorage().isEncryptionAvailable() ? safeStorage().decryptString(raw) : raw.toString('utf8');
    return JSON.parse(json);
  } catch (e) {
    console.error(`[Settings] Could not read secret "${name}":`, e);
    return null;
  }
}

export function setSecret(name: SecretName, value: unknown) {
  const json = JSON.stringify(value);
  // Without an OS keyring (some Linux setups) safeStorage can't encrypt; fall back
  // to base64 so the app still works — no worse than the old plaintext localStorage.
  const stored = safeStorage().isEncryptionAvailable()
    ? safeStorage().encryptString(json).toString('base64')
    : Buffer.from(json, 'utf8').toString('base64');
  const settings = load();
  settings.secrets = { ...(settings.secrets || {}), [name]: stored };
  save();
}
