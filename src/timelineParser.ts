export interface SegmentConfig {
  duration: number; // in seconds
  pattern: 'spiral' | 'tunnel' | 'fractal' | 'particles' | 'rings' | 'mandala' | 'kaleidoscope' | 'waves' | 'pulse' | string;
  patternType?: string;
  patternSpeed?: number;
  patternScale?: number;
  patternComplexity?: number;
  patternColor1?: string;
  patternColor2?: string;
  camera: 'orbit' | 'fly' | 'static' | 'pan' | string;
  cameraSpeed?: number;
  cameraRadius?: number;
  cameraHeight?: number;
  cameraTargetX?: number;
  cameraTargetY?: number;
  cameraTargetZ?: number;
  cameraFov?: number;
  textFont?: string;
  textDistance?: number;
  textSize?: number;
  textOutline?: string;
  textShading?: boolean;
  textBackdrop?: boolean;
  textAnimType?: 'none' | 'zoom' | 'fade' | 'float' | 'warp' | 'prism' | 'glitch' | string;
  textAnimSpeed?: number;
  textAnimIntensity?: number;
  binaural: 'off' | 'focus' | 'relax' | 'sleep' | 'custom' | string;
  carrierFreq?: number;
  beatFreq?: number;
  ampModulation?: number;
  metronome: number; // BPM, 0 for off
  audioUrl?: string; // Custom audio URL
}

export interface TimelineSegment {
  id: string;
  config: SegmentConfig;
  text: string;
}

export const DEFAULT_MARKDOWN = `\`\`\`config
duration: 8
pattern: mandala
patternType: breathing
patternComplexity: 1.5
patternColor1: #00ffcc
camera: orbit
cameraSpeed: 0.5
cameraRadius: 12
textAnimType: zoom
textAnimSpeed: 0.5
binaural: focus
metronome: 60
\`\`\`

# HypnoFlow Pro
Experience the ultimate synchronization.
Breathe with the pulse.

---

\`\`\`config
duration: 10
pattern: kaleidoscope
patternComplexity: 2
patternColor1: #ff00ff
camera: fly
cameraSpeed: 2.0
cameraFov: 120
textAnimType: glitch
textAnimIntensity: 2.0
binaural: relax
metronome: 120
\`\`\`

# Warp Speed
Diving into the geometric void.
Reality is shifting.

---

\`\`\`config
duration: 12
pattern: spiral
patternType: vortex
patternScale: 2.0
patternColor1: #ffff00
camera: pan
cameraSpeed: 1.5
textAnimType: prism
textAnimSpeed: 2.0
binaural: custom
carrierFreq: 100
beatFreq: 4
metronome: 0
\`\`\`

# Deep Theta
Resonating at the frequency of rest.
Your mind is clear.

---

\`\`\`config
duration: 15
pattern: waves
patternComplexity: 1.2
patternColor1: #0088ff
camera: orbit
cameraSpeed: 0.2
cameraHeight: 0.5
textFont: serif
textAnimType: float
textShading: true
textBackdrop: true
binaural: sleep
\`\`\`

# Ocean of Calm
Drifting away on digital waves.
Peace is here.
`;

export function parseTimeline(markdown: string): TimelineSegment[] {
  const segments: TimelineSegment[] = [];
  const parts = markdown.split(/^\s*---\s*$/gm);

  let lastConfig: SegmentConfig = {
    duration: 10,
    pattern: 'spiral',
    patternType: 'default',
    camera: 'static',
    cameraSpeed: 1.0,
    binaural: 'off',
    metronome: 0,
  };

  parts.forEach((part, index) => {
    const configMatch = part.match(/\`\`\`config\s*[\r\n]+([\s\S]*?)[\r\n]+\`\`\`/);
    let config: SegmentConfig = { ...lastConfig };

    let text = part;

    if (configMatch) {
      text = part.replace(configMatch[0], '').trim();
      const configLines = configMatch[1].split(/[\r\n]+/);
      configLines.forEach(line => {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length > 0) {
          const val = valueParts.join(':').trim();
          const k = key.trim() as keyof SegmentConfig;
          if (k === 'duration' || k === 'metronome' || k === 'carrierFreq' || k === 'beatFreq' || k === 'ampModulation' || k === 'cameraSpeed' || k === 'patternSpeed' || k === 'patternScale' || k === 'patternComplexity' || k === 'cameraRadius' || k === 'cameraHeight' || k === 'cameraTargetX' || k === 'cameraTargetY' || k === 'cameraTargetZ' || k === 'cameraFov' || k === 'textDistance' || k === 'textSize' || k === 'textAnimSpeed' || k === 'textAnimIntensity') {
            (config as any)[k] = parseFloat(val);
          } else if (k === 'textShading' || k === 'textBackdrop') {
            (config as any)[k] = val === 'true';
          } else {
            (config as any)[k] = val;
          }
        }
      });
      lastConfig = { ...config };
    } else {
      text = part.trim();
    }

    segments.push({
      id: `seg-${index}`,
      config,
      text,
    });
  });

  return segments;
}

export function serializeTimeline(segments: TimelineSegment[]): string {
  let lastConfig: Partial<SegmentConfig> = {};
  
  return segments.map((seg, index) => {
    let md = '';
    if (index > 0) {
      md += '---\n\n';
    }
    
    let configStr = '';
    const c = seg.config as any;
    
    const keys = ['duration', 'pattern', 'patternType', 'patternSpeed', 'patternScale', 'patternComplexity', 'patternColor1', 'patternColor2', 'camera', 'cameraSpeed', 'cameraRadius', 'cameraHeight', 'cameraTargetX', 'cameraTargetY', 'cameraTargetZ', 'cameraFov', 'textFont', 'textDistance', 'textSize', 'textOutline', 'textShading', 'textBackdrop', 'textAnimType', 'textAnimSpeed', 'textAnimIntensity', 'binaural', 'metronome', 'carrierFreq', 'beatFreq', 'ampModulation', 'audioUrl'];
    
    for (const key of keys) {
      if (c[key] !== undefined && (index === 0 || c[key] !== (lastConfig as any)[key])) {
        configStr += `${key}: ${c[key]}\n`;
      }
    }
    
    if (configStr.length > 0) {
      md += '\`\`\`config\n' + configStr + '\`\`\`\n\n';
    }
    
    lastConfig = { ...c };
    
    md += seg.text.trim() + '\n';
    return md;
  }).join('\n');
}
