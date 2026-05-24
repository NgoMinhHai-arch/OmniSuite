const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src');
const testsDir = path.join(__dirname, '../tests');

function walk(dir, callback) {
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next') {
        walk(fullPath, callback);
      }
    } else {
      if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
        callback(fullPath);
      }
    }
  });
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // 1. Move UI components -> @/shared/ui/
  content = content.replace(/@\/components\/ui\//g, '@/shared/ui/');
  content = content.replace(/['"]\.\.\/\.\.\/components\/ui\//g, "'@/shared/ui/");
  content = content.replace(/['"]\.\.\/components\/ui\//g, "'@/shared/ui/");
  
  // 2. Move Utils -> @/shared/utils/
  content = content.replace(/@\/utils\//g, '@/shared/utils/');
  // Some relative utils replacement
  content = content.replace(/['"]\.\.\/\.\.\/utils\//g, "'@/shared/utils/");
  content = content.replace(/['"]\.\.\/utils\//g, "'@/shared/utils/");

  // 3. Move context -> @/shared/lib/context/
  content = content.replace(/@\/context\//g, '@/shared/lib/context/');

  // 4. Move types -> @/shared/types/
  content = content.replace(/@\/types\//g, '@/shared/types/');

  // 5. Shared components directly under @/components/ (like Sidebar.tsx)
  content = content.replace(/@\/components\/Sidebar/g, '@/shared/ui/Sidebar');

  // 6. Components/features -> @/modules/seo/components/ (assuming all went here for now)
  content = content.replace(/@\/components\/features\//g, '@/modules/seo/components/');

  // 7. Services Mapping
  content = content.replace(/@\/services\/affiliateService/g, '@/modules/affiliate/services/affiliateService');
  content = content.replace(/@\/services\/agentService/g, '@/modules/core/services/agentService');
  content = content.replace(/@\/services\/aiProcessManager/g, '@/shared/lib/aiProcessManager');
  content = content.replace(/@\/services\/imageService/g, '@/modules/images/services/imageService');
  content = content.replace(/@\/services\/mapsService/g, '@/modules/maps/services/mapsService');
  content = content.replace(/@\/services\/seo_service/g, '@/modules/seo/services/seo_service');

  // Relative imports of services
  content = content.replace(/import \{ (.*?) \} from ['"]\.\.\/\.\.\/services\/seo_service['"]/g, "import { $1 } from '@/modules/seo/services/seo_service'");
  content = content.replace(/import \{ (.*?) \} from ['"]\.\.\/services\/seo_service['"]/g, "import { $1 } from '@/modules/seo/services/seo_service'");

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated paths in: ${filePath}`);
  }
}

console.log('Scanning directories for import replacements...');
if (fs.existsSync(srcDir)) walk(srcDir, processFile);
if (fs.existsSync(testsDir)) walk(testsDir, processFile);
console.log('Done.');
