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
  // Aliased paths
  { from: /@\/components\/ui\//g, to: '@/shared/ui/' },
  { from: /@\/components\//g, to: '@/shared/ui/' },
  { from: /@\/lib\//g, to: '@/shared/lib/' },
  { from: /@\/types\//g, to: '@/shared/types/' },
  { from: /@\/utils\//g, to: '@/shared/utils/' },
  
  // Specific relative paths that are known to be broken in modules
  { from: /from\s+['"]\.\.\/components\/ui\//g, to: "from '@/shared/ui/" },
  { from: /from\s+['"]\.\.\/\.\.\/components\/ui\//g, to: "from '@/shared/ui/" },
  { from: /from\s+['"]\.\.\/lib\//g, to: "from '@/shared/lib/" },
  { from: /from\s+['"]\.\.\/\.\.\/lib\//g, to: "from '@/shared/lib/" },
  { from: /from\s+['"]\.\.\/types\//g, to: "from '@/shared/types/" },
  { from: /from\s+['"]\.\.\/\.\.\/types\//g, to: "from '@/shared/types/" },
  { from: /from\s+['"]\.\.\/utils\//g, to: "from '@/shared/utils/" },
  { from: /from\s+['"]\.\.\/\.\.\/utils\//g, to: "from '@/shared/utils/" },
  
  // Dynamic imports
  { from: /import\(['"]\.\/aiProcessManager['"]\)/g, to: "import('@/shared/lib/aiProcessManager')" },
  { from: /import\(['"]\.\.\/aiProcessManager['"]\)/g, to: "import('@/shared/lib/aiProcessManager')" },
  
  // Cleanup previously broken type/utils paths
  { from: /@\/shared\/types\/types\//g, to: '@/shared/types/' },
  { from: /@\/shared\/utils\/utils\//g, to: '@/shared/utils/' },
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

console.log('Refactor complete.');
