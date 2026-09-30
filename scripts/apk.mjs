// Gera o APK no seu computador: npm run apk
// Precisa do Android SDK (Android Studio) e do Java 21. O APK sai em apk/esquadrao-fc.apk.
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
if (!sdk && !existsSync('android/local.properties')) {
  console.error('Android SDK não encontrado. Instale o Android Studio e defina ANDROID_HOME\n' +
    '(ex.: Windows: %LOCALAPPDATA%\\Android\\Sdk · macOS: ~/Library/Android/sdk · Linux: ~/Android/Sdk).\n' +
    'Alternativa sem instalar nada: o GitHub Actions gera o APK a cada push (veja o README).');
  process.exit(1);
}
const run = (cmd, cwd = '.') => { console.log(`\n> ${cmd}`); execSync(cmd, { stdio: 'inherit', cwd }); };
run('npm run build');
run('npx cap sync android');
run(process.platform === 'win32' ? 'gradlew.bat assembleRelease' : './gradlew assembleRelease', 'android');
mkdirSync('apk', { recursive: true });
const out = join('apk', 'esquadrao-fc.apk');
copyFileSync(join('android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk'), out);
console.log(`\nAPK pronto: ${out}`);
