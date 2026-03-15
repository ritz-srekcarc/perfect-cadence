import LZString from 'lz-string';

const patterns = ['spiral', 'particles', 'mandala', 'pulse', 'grid', 'waves', 'vortex', 'tunnel'];
const binaurals = ['focus', 'relax', 'sleep', 'off'];
const cameras = ['orbit', 'static'];

function generateMarkdown() {
  let md = "# Ultimate Demo Experience\nWelcome to the full feature showcase.\n\n";
  let totalDuration = 0;
  const targetDuration = 180;
  let segmentCount = 0;

  while (totalDuration < targetDuration) {
    if (segmentCount > 0) {
      md += "---\n\n";
    }
    const duration = Math.min(targetDuration - totalDuration, 0.5 + Math.random() * 4.5);
    const pattern = patterns[Math.floor(Math.random() * patterns.length)];
    const camera = cameras[Math.floor(Math.random() * cameras.length)];
    
    md += `## Segment ${segmentCount + 1}\n`;
    
    const r = Math.random();
    if (r < 0.1) {
      md += `> This is an auxiliary layer (blockquote) for deep immersion. Segment ${segmentCount + 1}.\n`;
    } else if (r < 0.2) {
      md += `![100](https://picsum.photos/seed/${segmentCount}/800/600)\n`;
    } else if (r < 0.3) {
      md += `![100,100](https://www.w3schools.com/html/mov_bbb.mp4)\n`;
    } else if (r < 0.4) {
      md += `!{0.5,random}(Breathe,In,Hold,Out)\n`;
    } else {
      md += `Experience the ${pattern} pattern. This is segment ${segmentCount + 1}.\n`;
    }

    md += `\n\`\`\`config\nduration: ${duration.toFixed(1)}\npattern: ${pattern}\ncamera: ${camera}\npatternSpeed: ${(0.1 + Math.random() * 2).toFixed(2)}\ntextSize: 20\ntextDistance: 25\nauxSize: 15\nauxDistance: 25\ncameraRadius: 30\n\`\`\`\n\n`;
    
    totalDuration += duration;
    segmentCount++;
  }

  return md;
}

const markdown = generateMarkdown();
import fs from 'fs';
fs.writeFileSync('demo_markdown.txt', markdown);
