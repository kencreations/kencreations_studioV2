const fs = require('fs');

const transcriptFile = 'C:\\Users\\Ken\\.gemini\\antigravity-ide\\brain\\735480ef-c816-4175-8dfd-7624ad19dcdc\\.system_generated\\logs\\transcript_full.jsonl';
const lines = fs.readFileSync(transcriptFile, 'utf8').split('\n');

const finalLines = [];
let maxLine = 0;

for (const line of lines) {
    if (!line.trim()) continue;
    const obj = JSON.parse(line);
    if (obj.content && obj.content.includes('ClickerEditor.jsx') && obj.content.includes('Showing lines')) {
        // We only want the ones before 01:42:00Z to avoid the corrupted ones
        if (obj.content.includes('2026-07-19T01:41:03Z') || 
            obj.content.includes('2026-07-19T01:41:32Z') || 
            obj.content.includes('2026-07-19T01:41:46Z')) {
            
            const linesOfText = obj.content.split('\n');
            for (const l of linesOfText) {
                const match = l.match(/^(\d+):(.*)$/);
                if (match) {
                    const lineNum = parseInt(match[1]);
                    const content = match[2];
                    
                    let actualContent = content;
                    if (actualContent.startsWith(' ')) actualContent = actualContent.substring(1);
                    finalLines[lineNum - 1] = actualContent;
                    if (lineNum > maxLine) maxLine = lineNum;
                }
            }
        }
    }
}

// Check if we missed any lines
for (let i = 0; i < maxLine; i++) {
    if (finalLines[i] === undefined) {
        console.log(`Missing line ${i + 1}`);
        finalLines[i] = '';
    }
}

const finalFile = finalLines.join('\n');
fs.writeFileSync('c:\\Users\\Ken\\Desktop\\kencreations-v2\\src\\pages\\ClickerEditor.jsx', finalFile, 'utf8');
console.log('Recovered ClickerEditor.jsx, total lines: ' + finalLines.length);
