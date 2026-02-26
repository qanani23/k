import fs from 'fs';

const content = fs.readFileSync('stabilization/audit_warnings.txt', 'utf-8');
const lines = content.split(/\r?\n/);

console.log('Total lines:', lines.length);
console.log('\nSearching for warning lines...\n');

let count = 0;
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.match(/warning:\s+/)) {
        count++;
        if (count <= 10) {
            console.log(`Line ${i}: ${line.substring(0, 100)}`);
        }
    }
}

console.log(`\nTotal lines with "warning:": ${count}`);
