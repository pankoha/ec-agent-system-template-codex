const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const importerDir = path.join(root, 'apps-script', 'amazon-order-importer');
const code = fs.readFileSync(path.join(importerDir, 'Code.gs'), 'utf8').trimEnd();
const research = fs.readFileSync(path.join(importerDir, 'Research.gs'), 'utf8').trimEnd();
const combined = `${code}\n\n${research}\n`;

for (const name of ['Code.compact.gs', 'Code.paste.gs']) {
  fs.writeFileSync(path.join(importerDir, name), combined, 'utf8');
}

console.log('Amazon order importer bundles rebuilt.');
