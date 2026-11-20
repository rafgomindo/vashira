// Installs the packaged app for everyday use on this Windows PC (run via `npm run install:local`):
// copies out/Vashira-win32-x64 to %LOCALAPPDATA%\Programs\Vashira and creates Start menu +
// desktop shortcuts. The library and settings live in %APPDATA%\Vashira either way, so the
// installed app and `npm start` share the same data.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

if (process.platform !== 'win32') {
  console.error('install:local is for Windows. On macOS/Linux, use the release downloads.');
  process.exit(1);
}

const src = path.resolve('out', 'Vashira-win32-x64');
const dest = path.join(process.env.LOCALAPPDATA, 'Programs', 'Vashira');
const exe = path.join(dest, 'Vashira.exe');

if (!fs.existsSync(path.join(src, 'Vashira.exe'))) {
  console.error(`No packaged app at ${src} — run "npm run package" first.`);
  process.exit(1);
}

try {
  fs.rmSync(dest, { recursive: true, force: true });
} catch (e) {
  console.error(`Could not replace ${dest}. Is Vashira still running? Close it and try again.`);
  process.exit(1);
}
fs.cpSync(src, dest, { recursive: true });

const shortcut = (lnk) =>
  `$s = (New-Object -ComObject WScript.Shell).CreateShortcut('${lnk}'); ` +
  `$s.TargetPath = '${exe}'; $s.WorkingDirectory = '${dest}'; $s.IconLocation = '${exe},0'; ` +
  `$s.Description = 'Vashira research hub'; $s.Save()`;

const startMenu = path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Vashira.lnk');
const desktop = path.join(execFileSync('powershell', ['-NoProfile', '-Command', "[Environment]::GetFolderPath('Desktop')"]).toString().trim(), 'Vashira.lnk');
for (const lnk of [startMenu, desktop]) {
  execFileSync('powershell', ['-NoProfile', '-Command', shortcut(lnk)]);
}

console.log(`Installed to ${dest}`);
console.log('Shortcuts: Start menu → Vashira, and "Vashira" on your desktop.');
