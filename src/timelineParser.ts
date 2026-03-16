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
  textOutlineType?: 'none' | 'rainbow' | 'solid';
  textOutlineColor?: string;
  textColor?: string;
  textShading?: boolean;
  textBackdrop?: boolean;
  textAnimType?: 'none' | 'zoom' | 'fade' | 'float' | 'warp' | 'prism' | 'glitch' | string;
  textAnimSpeed?: number;
  textAnimIntensity?: number;
  auxFont?: string;
  auxDistance?: number;
  auxSize?: number;
  auxOutlineType?: 'none' | 'rainbow' | 'solid';
  auxOutlineColor?: string;
  auxColor?: string;
  auxShading?: boolean;
  auxBackdrop?: boolean;
  auxAnimType?: 'none' | 'zoom' | 'fade' | 'float' | 'warp' | 'prism' | 'glitch' | string;
  auxAnimSpeed?: number;
  auxAnimIntensity?: number;
  binaural: 'off' | 'focus' | 'relax' | 'sleep' | 'custom' | string;
  carrierFreq?: number;
  beatFreq?: number;
  ampModulation?: number;
  metronome: number; // BPM, 0 for off
  audioUrl?: string; // Custom audio URL
  speech_synth?: boolean;
  speech_voice?: string;
  speech_speed?: number;
}

export interface MediaItem {
  type: 'image' | 'video';
  url: string;
  opacity: number;
  volume?: number;
  layer: 'main' | 'aux';
}

export interface WordList {
  interval: number;
  pattern: string;
  words: string[];
  layer: 'main' | 'aux';
}

export const PREBUILT_WORDLISTS: Record<string, string[]> = {
  relax: ["calm", "peace", "serene", "tranquil", "breathe", "drift", "float", "sink", "deep", "down", "heavy", "warm", "safe", "secure", "let go", "release", "soothe", "quiet", "still", "rest"],
  focus: ["attention", "concentrate", "sharp", "clear", "mind", "center", "now", "here", "present", "aware", "alert", "awake", "steady", "gaze", "fix", "point", "direct", "guide", "flow", "zone"],
  sleep: ["drowsy", "tired", "slumber", "dream", "night", "dark", "soft", "bed", "pillow", "blanket", "snug", "cozy", "yawn", "nod", "doze", "nap", "snooze", "restful", "deepen", "fade"],
  confidence: ["strong", "power", "bold", "brave", "sure", "certain", "proud", "tall", "stand", "speak", "voice", "clear", "loud", "firm", "solid", "rock", "base", "root", "grow", "shine"],
  energy: ["wake", "rise", "sun", "light", "bright", "spark", "fire", "heat", "move", "act", "do", "go", "fast", "quick", "speed", "rush", "surge", "pulse", "beat", "alive"]
};

export interface TimelineSegment {
  id: string;
  config: SegmentConfig;
  text: string;
  auxText?: string;
  media: MediaItem[];
  wordList?: WordList;
  rawMarkdown: string;
}

export const DEFAULT_MARKDOWN = `\`\`\`config
duration: 10
pattern: particles
patternType: default
patternComplexity: 1.0
patternScale:2
patternColor1: #ffffff
camera: orbit
cameraSpeed: 0.2
cameraRadius: 30
textSize: 24
textDistance: 20
textAnimType: fade
binaural: off
metronome: 0
\`\`\`

# Perfect Cadence
*Ready* **to** ***begin.***
> *Load* a **preset** or ***start typing.***

`;

export function parseSegmentContent(rawMarkdown: string) {
  let text = rawMarkdown;
  const media: MediaItem[] = [];
  let wordList: WordList | undefined;

  // Parse blockquote (auxText)
  const blockquoteRegex = /^>\s*(.*)$/gm;
  let auxTextLines = [];
  let bqMatch;
  while ((bqMatch = blockquoteRegex.exec(text)) !== null) {
    auxTextLines.push(bqMatch[1]);
  }
  let auxText = auxTextLines.length > 0 ? auxTextLines.join('\n') : undefined;
  text = text.replace(/^>\s*.*$/gm, '').trim();

  // Parse media regex
  const mediaRegex = /!\[(\d+)(?:,(\d+))?\]\((.*?)\)/g;

  // Parse media in main text
  let match;
  while ((match = mediaRegex.exec(text)) !== null) {
    const url = match[3];
    const hasVolume = match[2] !== undefined;
    media.push({
      type: hasVolume || url.match(/\.(mp4|webm|ogg)$/i) ? 'video' : 'image',
      opacity: parseInt(match[1]) / 100,
      url: url,
      layer: 'main',
      ...(hasVolume && { volume: parseInt(match[2]) / 100 }),
    });
    text = text.replace(match[0], '');
  }

  // Parse media in aux text
  if (auxText) {
    while ((match = mediaRegex.exec(auxText)) !== null) {
      const url = match[3];
      const hasVolume = match[2] !== undefined;
      media.push({
        type: hasVolume || url.match(/\.(mp4|webm|ogg)$/i) ? 'video' : 'image',
        opacity: parseInt(match[1]) / 100,
        url: url,
        layer: 'aux',
        ...(hasVolume && { volume: parseInt(match[2]) / 100 }),
      });
      auxText = auxText.replace(match[0], '');
    }
  }

  // Parse word list
  // !{interval,pattern}(list,of,words)
  const wordListRegex = /!\{([\d.]+),\s*([^}]+)\}\(([^)]+)\)/g;
  let wlMatch;
  
  // Check main text
  while ((wlMatch = wordListRegex.exec(text)) !== null) {
    const interval = parseFloat(wlMatch[1]);
    const pattern = wlMatch[2].trim();
    const wordsStr = wlMatch[3];
    let words = wordsStr.split(',').map(w => w.trim()).filter(w => w.length > 0);
    
    if (words.length === 1 && PREBUILT_WORDLISTS[words[0].toLowerCase()]) {
      words = PREBUILT_WORDLISTS[words[0].toLowerCase()];
    }

    wordList = {
      interval,
      pattern,
      words,
      layer: 'main'
    };
    text = text.replace(wlMatch[0], '');
  }

  // Check aux text
  if (auxText) {
    while ((wlMatch = wordListRegex.exec(auxText)) !== null) {
      const interval = parseFloat(wlMatch[1]);
      const pattern = wlMatch[2].trim();
      const wordsStr = wlMatch[3];
      let words = wordsStr.split(',').map(w => w.trim()).filter(w => w.length > 0);
      
      if (words.length === 1 && PREBUILT_WORDLISTS[words[0].toLowerCase()]) {
        words = PREBUILT_WORDLISTS[words[0].toLowerCase()];
      }

      wordList = {
        interval,
        pattern,
        words,
        layer: 'aux'
      };
      auxText = auxText.replace(wlMatch[0], '');
    }
    auxText = auxText.trim();
    if (auxText.length === 0) auxText = undefined;
  }

  return { text: text.trim(), auxText, media, wordList };
}

export function parseTimeline(markdown: string): TimelineSegment[] {
  const segments: TimelineSegment[] = [];
  const parts = markdown.split(/^\s*---\s*$/gm);

  let lastConfig: SegmentConfig = {
    duration: 10,
    pattern: 'spiral',
    patternType: 'default',
    camera: 'static',
    cameraSpeed: 1.0,
    cameraRadius: 30,
    textSize: 20,
    textDistance: 25,
    auxSize: 15,
    auxDistance: 25,
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
          if (k === 'duration' || k === 'metronome' || k === 'carrierFreq' || k === 'beatFreq' || k === 'ampModulation' || k === 'cameraSpeed' || k === 'patternSpeed' || k === 'patternScale' || k === 'patternComplexity' || k === 'cameraRadius' || k === 'cameraHeight' || k === 'cameraTargetX' || k === 'cameraTargetY' || k === 'cameraTargetZ' || k === 'cameraFov' || k === 'textDistance' || k === 'textSize' || k === 'textAnimSpeed' || k === 'textAnimIntensity' || k === 'auxDistance' || k === 'auxSize' || k === 'auxAnimSpeed' || k === 'auxAnimIntensity' || k === 'speech_speed') {
            (config as any)[k] = parseFloat(val);
          } else if (k === 'textShading' || k === 'textBackdrop' || k === 'auxShading' || k === 'auxBackdrop' || k === 'speech_synth') {
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

    const rawMarkdown = text.trim();
    const parsedContent = parseSegmentContent(rawMarkdown);

    segments.push({
      id: `seg-${index}`,
      config,
      text: parsedContent.text,
      auxText: parsedContent.auxText,
      media: parsedContent.media,
      wordList: parsedContent.wordList,
      rawMarkdown,
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
    
    const keys = ['duration', 'pattern', 'patternType', 'patternSpeed', 'patternScale', 'patternComplexity', 'patternColor1', 'patternColor2', 'camera', 'cameraSpeed', 'cameraRadius', 'cameraHeight', 'cameraTargetX', 'cameraTargetY', 'cameraTargetZ', 'cameraFov', 'textFont', 'textDistance', 'textSize', 'textOutlineType', 'textOutlineColor', 'textColor', 'textShading', 'textBackdrop', 'textAnimType', 'textAnimSpeed', 'textAnimIntensity', 'auxFont', 'auxDistance', 'auxSize', 'auxOutlineType', 'auxOutlineColor', 'auxColor', 'auxShading', 'auxBackdrop', 'auxAnimType', 'auxAnimSpeed', 'auxAnimIntensity', 'binaural', 'metronome', 'carrierFreq', 'beatFreq', 'ampModulation', 'audioUrl', 'speech_synth', 'speech_voice', 'speech_speed'];
    
    for (const key of keys) {
      if (c[key] !== undefined && (index === 0 || c[key] !== (lastConfig as any)[key])) {
        configStr += `${key}: ${c[key]}\n`;
      }
    }
    
    if (configStr.length > 0) {
      md += '\`\`\`config\n' + configStr + '\`\`\`\n\n';
    }
    
    lastConfig = { ...c };
    
    md += seg.rawMarkdown.trim() + '\n';
    return md;
  }).join('\n');
}
