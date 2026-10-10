import fs from 'fs';
import path from 'path';

const pagesDir = 'c:/Users/Ken/Desktop/kencreations-v2/src/pages';
const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('Editor.jsx') || f.endsWith('Editor copy.jsx') || f.endsWith('Editor_backup.jsx'));

for (const file of files) {
    const filePath = path.join(pagesDir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // If it uses useFontStore but doesn't import it
    if (content.includes('useFontStore()') && !content.includes('import { useFontStore }')) {
        content = content.replace(/import { useProfile } from ['"]\.\.\/contexts\/ProfileContext['"];/, 
            `import { useProfile } from "../contexts/ProfileContext";\nimport { useFontStore } from "../hooks/useFontStore";`);
        
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Added import to ${file}`);
    }
}
