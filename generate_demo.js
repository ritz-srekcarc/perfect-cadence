import LZString from 'lz-string';

const patterns = ['spiral', 'particles', 'mandala', 'pulse', 'grid', 'waves', 'vortex', 'tunnel'];
const patternTypes = ['default', 'double', 'galaxy', 'sphere', 'cylinder', 'hypnotic', 'breathing', 'infinite', 'vortex', 'sacred_geometry'];
const binaurals = ['focus', 'relax', 'sleep', 'energy', 'off'];
const cameras = ['orbit', 'static', 'fly', 'pan'];
const textAnims = ['none', 'zoom', 'fade', 'float', 'warp', 'prism', 'glitch'];
const displayPatterns = ['center', 'scatter', 'random', 'spiral', 'march'];

const imageSources = [
  'https://picsum.photos/seed/',
  'https://unsplash.it/800/600?image=',
  'https://placehold.co/800x600?text='
];

const videoSources = [
  'https://vjs.zencdn.net/v/oceans.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
];

function generateMarkdown() {
  let md = "# Neural Synthesis Engine\nWelcome to the next generation of sensory immersion.\n\n";
  let totalDuration = 0;
  const targetDuration = 180;
  let segmentCount = 0;

  while (totalDuration < targetDuration) {
    if (segmentCount > 0) {
      md += "---\n\n";
    }
    const duration = Math.min(targetDuration - totalDuration, 3 + Math.random() * 7);
    const pattern = patterns[Math.floor(Math.random() * patterns.length)];
    const patternType = patternTypes[Math.floor(Math.random() * patternTypes.length)];
    const camera = cameras[Math.floor(Math.random() * cameras.length)];
    const binaural = binaurals[Math.floor(Math.random() * binaurals.length)];
    const textAnim = textAnims[Math.floor(Math.random() * textAnims.length)];
    const displayPattern = displayPatterns[Math.floor(Math.random() * displayPatterns.length)];
    
    const r = Math.random();
    if (r < 0.15) {
      md += `## ${pattern.charAt(0).toUpperCase() + pattern.slice(1)} State\n`;
      md += `> Deep immersion into the ${patternType} ${pattern} field.\n`;
    } else if (r < 0.3) {
      const src = imageSources[Math.floor(Math.random() * imageSources.length)];
      md += `![${Math.floor(20 + Math.random() * 60)}](${src}${segmentCount})\n`;
      md += `Visualizing neural pathways.\n`;
    } else if (r < 0.45) {
      const src = videoSources[Math.floor(Math.random() * videoSources.length)];
      md += `![${Math.floor(30 + Math.random() * 50)},0](${src})\n`;
      md += `Synchronizing with the kinetic stream.\n`;
    } else if (r < 0.6) {
      md += `!{${(0.5 + Math.random()).toFixed(1)},${Math.floor(1 + Math.random() * 3)}}(relax)\n`;
      md += `Harmonizing frequencies.\n`;
    } else {
      md += `## Phase ${segmentCount + 1}\n`;
      md += `Experience the ${patternType} ${pattern} pattern.\n`;
    }

    md += `\n\`\`\`config\nduration: ${duration.toFixed(1)}\npattern: ${pattern}\npatternType: ${patternType}\ncamera: ${camera}\npatternSpeed: ${(0.2 + Math.random() * 1.5).toFixed(2)}\ntextAnimType: ${textAnim}\ntextDisplayPattern: ${displayPattern}\ntextSize: ${Math.floor(20 + Math.random() * 100)}\ntextDistance: ${Math.floor(15 + Math.random() * 20)}\nbinaural: ${binaural}\nmetronome: ${Math.random() > 0.7 ? Math.floor(60 + Math.random() * 120) : 0}\n\`\`\`\n\n`;
    
    totalDuration += duration;
    segmentCount++;
  }

  return md;
}

const markdown = generateMarkdown();
import fs from 'fs';
const content = `export const DEMO_MARKDOWN = \`${markdown.replace(/`/g, '\\`').replace(/\${/g, '\\${')}\`;\n`;
fs.writeFileSync('src/demoPreset.ts', content);
console.log('Updated src/demoPreset.ts');
