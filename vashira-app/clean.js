const fs = require('fs');
let txt = fs.readFileSync('src/index.css', 'utf8');
txt = txt.replace(/[\x00]/g, '');
const lines = txt.split('\n');
const cleanLines = lines.filter(line => !line.includes('W i n d') && !line.includes('o w   C o n'));
fs.writeFileSync('src/index.css', cleanLines.join('\n'), 'utf8');
