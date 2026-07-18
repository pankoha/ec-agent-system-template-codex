const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const importerDir = path.join(root, 'apps-script', 'amazon-order-importer');
const code = fs.readFileSync(path.join(importerDir, 'Code.gs'), 'utf8').trimEnd();
const research = fs.readFileSync(path.join(importerDir, 'Research.gs'), 'utf8').trimEnd();
const combined = `${code}\n\n${research}\n`;

function toAsciiSafe(source) {
  return Array.from(source, (char) => {
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
}

function splitAtFunctionBoundaries(source, partCount) {
  const boundaries = [0];
  const functionPattern = /^function\s+/gm;
  let match;
  while ((match = functionPattern.exec(source)) !== null) {
    if (match.index > 0) boundaries.push(match.index);
  }
  boundaries.push(source.length);

  const selected = [0];
  for (let part = 1; part < partCount; part += 1) {
    const target = Math.round((source.length * part) / partCount);
    const candidates = boundaries.filter((index) => index > selected[selected.length - 1] && index < source.length);
    selected.push(candidates.reduce((best, index) => (
      Math.abs(index - target) < Math.abs(best - target) ? index : best
    ), candidates[0]));
  }
  selected.push(source.length);

  return selected.slice(0, -1).map((start, index) => source.slice(start, selected[index + 1]));
}

for (const name of ['Code.compact.gs', 'Code.paste.gs']) {
  fs.writeFileSync(path.join(importerDir, name), combined, 'utf8');
}

fs.writeFileSync(path.join(importerDir, 'Code.paste.ascii.gs'), toAsciiSafe(combined), 'utf8');

const pasteDir = path.join(root, 'tmp', 'apps-script-paste');
const researchParts = splitAtFunctionBoundaries(`${research}\n`, 4);
researchParts.forEach((part, index) => {
  const partNumber = index + 1;
  fs.writeFileSync(path.join(pasteDir, `Research_${partNumber}.gs`), part, 'utf8');
  fs.writeFileSync(path.join(pasteDir, `Research_${partNumber}.ascii.gs`), toAsciiSafe(part), 'utf8');
});

console.log('Amazon order importer bundles rebuilt.');
