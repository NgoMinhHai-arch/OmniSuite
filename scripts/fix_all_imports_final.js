const fs = require('fs');
const path = require('path');

function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);
  arrayOfFiles = arrayOfFiles || [];
  files.forEach(function(file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
    } else {
      arrayOfFiles.push(path.join(dirPath, "/", file));
    }
  });
  return arrayOfFiles;
}

const srcDir = path.join(process.cwd(), 'src');
const files = getAllFiles(srcDir).filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));

const replacements = [
  // 1. General Aliased Paths (Global Standard)
  { from: /@\/components\/ui\//g, to: '@/shared/ui/' },
  { from: /@\/components\//g, to: '@/shared/ui/' },
  { from: /@\/lib\//g, to: '@/shared/lib/' },
  { from: /@\/types\//g, to: '@/shared/types/' },
  { from: /@\/utils\//g, to: '@/shared/utils/' },
  
  // 2. Clean up previously broken paths from recursive attempts
  { from: /@\/shared\/shared\//g, to: '@/shared/' },
  { from: /@\/shared\/types\/types\//g, to: '@/shared/types/' },
  { from: /@\/shared\/utils\/utils\//g, to: '@/shared/utils/' },
  { from: /@\/shared\/lib\/scrapers\//g, to: '@/shared/lib/scrapers/' },

  // 3. Fix Relative Paths in Modules (pointing to shared or other modules)
  // Cross-module imports (Agent -> Image Service)
  { from: /from\s+['"]\.\/imageService['"]/g, to: "from '@/modules/images/services/imageService'" },
  { from: /import\(['"]\.\/imageService['"]\)/g, to: "import('@/modules/images/services/imageService')" },
  { from: /import\(['"]\.\/aiProcessManager['"]\)/g, to: "import('@/shared/lib/aiProcessManager')" },

  // Module to Shared (up one level)
  { from: /from\s+['"]\.\.\/lib\//g, to: "from '@/shared/lib/" },
  { from: /from\s+['"]\.\.\/utils\//g, to: "from '@/shared/utils/" },
  { from: /from\s+['"]\.\.\/types\//g, to: "from '@/shared/types/" },
  
  // Module to Shared (up two levels)
  { from: /from\s+['"]\.\.\/\.\.\/lib\//g, to: "from '@/shared/lib/" },
  { from: /from\s+['"]\.\.\/\.\.\/utils\//g, to: "from '@/shared/utils/" },
  { from: /from\s+['"]\.\.\/\.\.\/types\//g, to: "from '@/shared/types/" },
  { from: /from\s+['"]\.\.\/\.\.\/components\/ui\//g, to: "from '@/shared/ui/" },
  { from: /from\s+['"]\.\.\/components\/ui\//g, to: "from '@/shared/ui/" },

  // API to Shared
  { from: /from\s+['"]\.\.\/\.\.\/lib\//g, to: "from '@/shared/lib/" },
  { from: /from\s+['"]\.\.\/\.\.\/\.\.\/lib\//g, to: "from '@/shared/lib/" },
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  replacements.forEach(r => {
    content = content.replace(r.from, r.to);
  });

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated: ${file}`);
  }
});

console.log('Final Refactor Complete.');
