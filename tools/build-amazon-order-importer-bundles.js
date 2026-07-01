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

const asciiSafe = Array.from(combined, (char) => {
  const codePoint = char.codePointAt(0);
  if (char === '\r' || char === '\n' || char === '\t' || (codePoint >= 32 && codePoint <= 126)) {
    return char;
  }
  if (codePoint <= 0xFFFF) {
    return `\\u${codePoint.toString(16).toUpperCase().padStart(4, '0')}`;
  }
  const value = codePoint - 0x10000;
  const high = 0xD800 + (value >> 10);
  const low = 0xDC00 + (value & 0x3FF);
  return `\\u${high.toString(16).toUpperCase().padStart(4, '0')}\\u${low.toString(16).toUpperCase().padStart(4, '0')}`;
}).join('');

fs.writeFileSync(path.join(importerDir, 'Code.paste.ascii.gs'), asciiSafe, 'utf8');

console.log('Amazon order importer bundles rebuilt.');
