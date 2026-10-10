import fs from 'fs';
import path from 'path';

const pagesDir = 'c:/Users/Ken/Desktop/kencreations-v2/src/pages';
const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('Editor.jsx') || f.endsWith('Editor copy.jsx') || f.endsWith('Editor_backup.jsx'));

for (const file of files) {
    const filePath = path.join(pagesDir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    let changed = false;

    // Check if it uses allFonts from useProfile
    if (content.includes('const {') && content.includes('allFonts') && content.includes('useProfile')) {
        // Replace allFonts in useProfile destructuring
        content = content.replace(/const\s*{\s*([^}]*?)allFonts([^}]*?)\s*}\s*=\s*useProfile\(\);/, (match, p1, p2) => {
            const others = [p1, p2].join('').split(',').map(s => s.trim()).filter(Boolean).join(', ');
            if (others) {
                return `const { ${others} } = useProfile();\n    const { allFonts } = useFontStore();`;
            } else {
                return `const { allFonts } = useFontStore();`;
            }
        });

        if (!content.includes('useFontStore')) {
            // Add import after useProfile
            content = content.replace(/import { useProfile } from ['"]\.\.\/contexts\/ProfileContext['"];/, 
                `import { useProfile } from "../contexts/ProfileContext";\nimport { useFontStore } from "../hooks/useFontStore";`);
        }
        
        changed = true;
    }

    if (changed) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated ${file}`);
    }
}
