import fs from 'fs';
import path from 'path';

const patterns = [
  { type: 'fascinator', name: 'flat spiral' },
  { type: 'fascinator', name: 'mandala' },
  { type: 'repetition', name: 'tunnel' },
  { type: 'repetition', name: 'pulse' },
  { type: 'topology', name: 'waves' },
  { type: 'cluster', name: 'galaxy' },
  { type: 'topology', name: 'vortex' },
  { type: 'fascinator', name: 'spiral' },
  { type: 'repetition', name: 'grid' },
  { type: 'cloud', name: 'particles' }
];

const cameras = ['static', 'orbit', 'fly', 'pan'];
const textAnims = ['none', 'zoom', 'fade', 'float', 'warp', 'prism', 'glitch'];
const textPatterns = ['center', 'scatter', 'random', 'spiral', 'march'];

const sentences = [
  "Visualizing neural pathways.",
  "Synchronizing with the kinetic stream.",
  "Deep immersion into the {pattern} field.",
  "Experience the {patternType} {pattern} pattern."
];

const images = [
  "https://picsum.photos/seed/9",
  "https://picsum.photos/seed/14",
  "https://picsum.photos/seed/27",
  "https://unsplash.it/800/600?image=4",
  "https://unsplash.it/800/600?image=22",
  "https://placehold.co/800x600?text=1",
  "https://placehold.co/800x600?text=8"
];

const videos = [
  "https://vjs.zencdn.net/v/oceans.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"
];

function randomItem(arr: any[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateSegment(index: number) {
  const pattern = randomItem(patterns);
  const camera = randomItem(cameras);
  const textAnim = randomItem(textAnims);
  const textPattern = randomItem(textPatterns);
  
  let text = "";
  let media = "";
  
  if (index === 0) {
    text = "## The Singularity\n> Focus on the single point of light.";
    return `${text}\n\n\`\`\`config\nduration: 10\npattern: flat spiral\npatternType: fascinator\npatternSpeed: 1.0\npatternScale: 1.5\npatternColor1: #ffffff\npatternColor2: #ffffaa\ncamera: static\ncameraHeight: 1.57\ncameraAlpha: -1.57\ncameraRadius: 30\ntextAnimType: fade\ntextDisplayPattern: center\ntextSize: 40\ntextDistance: 20\nbinaural: focus\nmetronome: 0\n\`\`\``;
  }
  
  const sentence = randomItem(sentences)
    .replace('{pattern}', pattern.name)
    .replace('{patternType}', pattern.type);
    
  if (Math.random() > 0.5) {
    text = `## ${pattern.name.charAt(0).toUpperCase() + pattern.name.slice(1)} State\n> ${sentence}`;
  } else {
    if (Math.random() > 0.5) {
      media = `![${Math.floor(Math.random() * 50 + 30)}](${randomItem(images)})`;
    } else {
      media = `![${Math.floor(Math.random() * 50 + 30)},0](${randomItem(videos)})`;
    }
    text = `${media}\n${sentence}`;
  }
  
  return `${text}\n\n\`\`\`config\nduration: ${(Math.random() * 8 + 2).toFixed(1)}\npattern: ${pattern.name}\npatternType: ${pattern.type}\ncamera: ${camera}\npatternSpeed: ${(Math.random() * 1.5 + 0.2).toFixed(2)}\ntextAnimType: ${textAnim}\ntextDisplayPattern: ${textPattern}\ntextSize: ${Math.floor(Math.random() * 100 + 20)}\ntextDistance: ${Math.floor(Math.random() * 20 + 15)}\nbinaural: off\nmetronome: 0\n\`\`\``;
}

let markdown = `# Neural Synthesis Engine\nWelcome to the next generation of sensory immersion.\n\n`;
for (let i = 0; i < 20; i++) {
  if (i > 0) markdown += `\n\n---\n\n`;
  markdown += generateSegment(i);
}

const fileContent = `export const DEMO_MARKDOWN = ${JSON.stringify(markdown)};\n`;
fs.writeFileSync(path.join(process.cwd(), 'src/demoPreset.ts'), fileContent);
console.log('Generated demoPreset.ts');
