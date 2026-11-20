import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerAppImage } from '@reforged/maker-appimage';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

import path from 'path';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    icon: path.join(__dirname, 'assets', 'icons', 'icon'), 
  },
  // better-sqlite3 >= 13 ships Node-API prebuilds for every platform (prebuilds/<platform>-<arch>.node),
  // which load in any Electron version — compiling it from source is unnecessary and needs a C++ toolchain.
  rebuildConfig: { ignoreModules: ['better-sqlite3'] },
  makers: [
    new MakerSquirrel({
      setupIcon: path.join(__dirname, 'assets', 'icons', 'icon.ico'), // Installer icon for Windows
    }),
    new MakerZIP({}, ['win32', 'darwin']),
    new MakerRpm({}),
    // Linux: .deb is the primary download (it installs Chromium's sandbox helper
    // correctly); the AppImage is the no-install alternative. Both are built on an
    // Ubuntu runner by .github/workflows/release.yml.
    // `bin`: the packaged executable is named after productName ("Vashira"), but
    // both Linux makers default to the lowercase package name.
    new MakerDeb({
      options: {
        bin: 'Vashira',
        icon: path.join(__dirname, 'assets', 'icons', '512x512.png'),
        categories: ['Education', 'Office'],
        homepage: 'https://github.com/rafgomindo/vashira',
      },
    }),
    new MakerAppImage({
      options: {
        bin: 'Vashira',
        icon: path.join(__dirname, 'assets', 'icons', '512x512.png'),
        categories: ['Education', 'Office'],
      },
    }, ['linux']),
  ],
  plugins: [
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: true,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: false,
    }),
  ],
};

export default config;
