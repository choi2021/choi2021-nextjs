import fs from 'fs';
import path from 'path';

const SRC_DIR = '/Users/troy/project/choi2021.github.io/contents/posts';
const DEST_DIR = '/Users/troy/project/choi2021-nextjs/data/blog';
const PUBLIC_IMG_DIR = '/Users/troy/project/choi2021-nextjs/public/static/images';

// Remove existing sample posts
if (fs.existsSync(DEST_DIR)) {
  fs.rmSync(DEST_DIR, { recursive: true, force: true });
}
fs.mkdirSync(DEST_DIR, { recursive: true });

const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];

const entries = fs.readdirSync(SRC_DIR, { withFileTypes: true });

let postCount = 0;

for (const entry of entries) {
  if (entry.isDirectory()) {
    const postDir = path.join(SRC_DIR, entry.name);
    const postName = entry.name;
    const indexPath = path.join(postDir, 'index.md');
    
    if (fs.existsSync(indexPath)) {
      let content = fs.readFileSync(indexPath, 'utf-8');
      
      // Fix frontmatter
      content = content.replace(/^description:/gm, 'summary:');
      content = content.replace(/^slug:.*$/gm, '');
      
      const destImgDir = path.join(PUBLIC_IMG_DIR, postName);
      let imgCopied = false;
      
      const filesInPostDir = fs.readdirSync(postDir);
      for (const file of filesInPostDir) {
        const ext = path.extname(file).toLowerCase();
        if (imageExts.includes(ext)) {
          if (!imgCopied) {
            fs.mkdirSync(destImgDir, { recursive: true });
            imgCopied = true;
          }
          fs.copyFileSync(path.join(postDir, file), path.join(destImgDir, file));
          
          const regexMd = new RegExp(`\\]\\(\\s*(\\.\\/)?${file}\\s*\\)`, 'g');
          content = content.replace(regexMd, `](/static/images/${postName}/${file})`);
          
          const regexHtml = new RegExp(`src=["'](\\.\\/)?${file}["']`, 'g');
          content = content.replace(regexHtml, `src="/static/images/${postName}/${file}"`);
        }
      }
      
      const destFile = path.join(DEST_DIR, `${postName}.mdx`);
      fs.writeFileSync(destFile, content);
      postCount++;
    }
  }
}

console.log(`Migrated ${postCount} posts.`);

try {
  const logoSrc = '/Users/troy/.gemini/antigravity/brain/066f250f-09a7-4053-a083-ced3f9d3ab5d/logo_png_1777737382520.png';
  if (fs.existsSync(logoSrc)) {
    fs.copyFileSync(logoSrc, '/Users/troy/project/choi2021-nextjs/public/static/images/logo.png');
    console.log('Logo copied.');
  } else {
    console.log('Logo source not found at', logoSrc);
  }
} catch (e) {
  console.error('Failed to copy logo:', e);
}

console.log('Migration completed successfully.');
