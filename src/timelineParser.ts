/**
 * Timeline Parser
 * 
 * Handles the conversion between the markdown-based timeline format 
 * and the structured TimelineSegment objects used by the application.
 */

/**
 * Configuration for a single segment of the timeline.
 * Controls visuals, camera, text animations, and audio.
 */
export interface SegmentConfig {
  duration: number; // in seconds
  pattern: 'spiral' | 'tunnel' | 'fractal' | 'particles' | 'rings' | 'mandala' | 'kaleidoscope' | 'waves' | 'pulse' | string;
  patternType?: string;
  patternSpeed?: number;
  patternScale?: number;
  patternComplexity?: number;
  patternColor1?: string;
  patternColor2?: string;
  patternFaceCamera?: boolean;
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
  textDisplayPattern?: 'center' | 'scatter' | 'random' | 'spiral' | 'march' | string;
  textFaceCamera?: boolean;
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
  auxDisplayPattern?: 'center' | 'scatter' | 'random' | 'spiral' | 'march' | string;
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
  count: number;
  words: string[];
  layer: 'main' | 'aux';
}

export const PREBUILT_WORDLISTS: Record<string, string[]> = {
  relax: ["calm", "peace", "serene", "tranquil", "breathe", "drift", "float", "sink", "deep", "down", "heavy", "warm", "safe", "secure", "let go", "release", "soothe", "quiet", "still", "rest"],
  focus: ["attention", "concentrate", "sharp", "clear", "mind", "center", "now", "here", "present", "aware", "alert", "awake", "steady", "gaze", "fix", "point", "direct", "guide", "flow", "zone"],
  sleep: ["drowsy", "tired", "slumber", "dream", "night", "dark", "soft", "bed", "pillow", "blanket", "snug", "cozy", "yawn", "nod", "doze", "nap", "snooze", "restful", "deepen", "fade"],
  confidence: ["strong", "power", "bold", "brave", "sure", "certain", "proud", "tall", "stand", "speak", "voice", "clear", "loud", "firm", "solid", "rock", "base", "root", "grow", "shine"],
  energy: ["wake", "rise", "sun", "light", "bright", "spark", "fire", "heat", "move", "act", "do", "go", "fast", "quick", "speed", "rush", "surge", "pulse", "beat", "alive"],
  gratitude: ["gratitude", "thanks", "blessing", "love", "kindness", "joy", "heart", "open", "appreciate", "value", "gift", "grace", "warmth", "smile", "peace", "full", "enough", "content", "blessed", "share"]
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

const KEY_MAP: Record<string, string> = {
  duration: 'd',
  pattern: 'p',
  patternType: 'pt',
  patternSpeed: 'ps',
  patternScale: 'psc',
  patternComplexity: 'pc',
  patternColor1: 'c1',
  patternColor2: 'c2',
  patternFaceCamera: 'pfc',
  camera: 'ca',
  cameraSpeed: 'cs',
  cameraRadius: 'cr',
  cameraHeight: 'ch',
  cameraTargetX: 'tx',
  cameraTargetY: 'ty',
  cameraTargetZ: 'tz',
  cameraFov: 'fov',
  textFont: 'tf',
  textDistance: 'td',
  textSize: 'ts',
  textOutlineType: 'tot',
  textOutlineColor: 'toc',
  textColor: 'tc',
  textShading: 'tsh',
  textBackdrop: 'tbd',
  textAnimType: 'tat',
  textAnimSpeed: 'tas',
  textAnimIntensity: 'tai',
  textDisplayPattern: 'tdp',
  textFaceCamera: 'tfc',
  auxFont: 'af',
  auxDistance: 'ad',
  auxSize: 'as',
  auxOutlineType: 'aot',
  auxOutlineColor: 'aoc',
  auxColor: 'ac',
  auxShading: 'ash',
  auxBackdrop: 'abd',
  auxAnimType: 'aat',
  auxAnimSpeed: 'aas',
  auxAnimIntensity: 'aai',
  auxDisplayPattern: 'adp',
  binaural: 'bin',
  metronome: 'm',
  carrierFreq: 'cf',
  beatFreq: 'bf',
  ampModulation: 'am',
  audioUrl: 'au',
  speech_synth: 'ss',
  speech_voice: 'sv',
  speech_speed: 'ssp'
};

const VALUE_MAP: Record<string, string> = {
  spiral: 'sp',
  tunnel: 'tu',
  fractal: 'fr',
  particles: 'pa',
  rings: 'ri',
  mandala: 'man',
  kaleidoscope: 'ka',
  waves: 'wa',
  pulse: 'pu',
  orbit: 'or',
  fly: 'fl',
  static: 'st',
  pan: 'pn',
  'sans-serif': 'ss',
  serif: 'se',
  monospace: 'mo',
  cursive: 'cu',
  fantasy: 'fa',
  none: 'no',
  rainbow: 'rb',
  solid: 'so',
  zoom: 'zo',
  fade: 'fa',
  float: 'fl',
  warp: 'wa',
  prism: 'pr',
  glitch: 'gl',
  center: 'ce',
  scatter: 'sc',
  random: 'ra',
  march: 'mar',
  off: 'of',
  focus: 'fo',
  relax: 're',
  sleep: 'sl',
  custom: 'cu'
};

export const DEFAULT_MARKDOWN = `# Welcome to Perfect Cadence
Type your text here. Each line will be spoken and displayed.

Use markdown to format your timeline.
Separate segments with three dashes (---).

\`\`\`config
duration: 10
pattern: spiral
camera: orbit
\`\`\`

---

## Next Segment
You can change the visuals per segment.

\`\`\`config
pattern: particles
camera: fly
\`\`\`
`;

/**
 * Parses a single segment's markdown content to extract text, aux text, and media.
 */
export function parseSegmentContent(rawMarkdown: string) {
  let text = rawMarkdown;
  const media: MediaItem[] = [];

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
  const mediaRegex = /!\[\s*(\d+)\s*(?:,\s*(\d+)\s*)?\]\((.*?)\)/g;

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

  // Parse wordlist
  const wordlistRegex = /!\{\s*([\d.]+)\s*,\s*(\d+)\s*\}\(([^)]+)\)/g;
  let wordList: WordList | undefined = undefined;
  
  // Check main text first
  let wlMatch = wordlistRegex.exec(text);
  if (wlMatch) {
    wordList = {
      interval: parseFloat(wlMatch[1]),
      count: parseInt(wlMatch[2]),
      words: wlMatch[3].split(',').map(w => w.trim()),
      layer: 'main'
    };
    text = text.replace(wlMatch[0], '');
  } else if (auxText) {
    // Check aux text if not in main
    wlMatch = wordlistRegex.exec(auxText);
    if (wlMatch) {
      wordList = {
        interval: parseFloat(wlMatch[1]),
        count: parseInt(wlMatch[2]),
        words: wlMatch[3].split(',').map(w => w.trim()),
        layer: 'aux'
      };
      auxText = auxText.replace(wlMatch[0], '');
    }
  }

  return { text: text.trim(), auxText, media, wordList };
}


export const SYNTAX_DOCS = {
  timeline: "Segments are separated by '---'. Each segment can start with a ```config ... ``` block.",
  config: {
    duration: "number (seconds)",
    pattern: "string (spiral, tunnel, fractal, particles, rings, mandala, kaleidoscope, waves, pulse)",
    patternType: "string (default, double, galaxy, sphere, cylinder, hypnotic, breathing, infinite, vortex, sacred_geometry)",
    patternSpeed: "number (multiplier)",
    patternScale: "number (multiplier)",
    patternComplexity: "number (detail level)",
    patternColor1: "string (hex color)",
    patternColor2: "string (hex color)",
    patternFaceCamera: "boolean",
    camera: "string (orbit, fly, static, pan)",
    cameraSpeed: "number (multiplier)",
    cameraRadius: "number (distance from target)",
    cameraHeight: "number (beta angle in radians)",
    cameraTargetX: "number",
    cameraTargetY: "number",
    cameraTargetZ: "number",
    cameraFov: "number (field of view in degrees)",
    textFont: "string (sans-serif, serif, monospace, cursive, fantasy)",
    textDistance: "number",
    textSize: "number",
    textOutlineType: "string (none, rainbow, solid)",
    textOutlineColor: "string (hex color)",
    textColor: "string (hex color)",
    textShading: "boolean",
    textBackdrop: "boolean",
    textAnimType: "string (none, zoom, fade, float, warp, prism, glitch)",
    textAnimSpeed: "number",
    textAnimIntensity: "number",
    textDisplayPattern: "string (center, scatter, random, spiral, march)",
    textFaceCamera: "boolean",
    auxFont: "string",
    auxDistance: "number",
    auxSize: "number",
    auxOutlineType: "string",
    auxOutlineColor: "string",
    auxColor: "string",
    auxShading: "boolean",
    auxBackdrop: "boolean",
    auxAnimType: "string",
    auxAnimSpeed: "number",
    auxAnimIntensity: "number",
    auxDisplayPattern: "string (center, scatter, random, spiral, march)",
    binaural: "string (off, focus, relax, sleep, custom)",
    carrierFreq: "number (Hz)",
    beatFreq: "number (Hz)",
    ampModulation: "number (Hz)",
    metronome: "number (BPM, 0 for off)",
    audioUrl: "string (URL)",
    speech_synth: "boolean",
    speech_voice: "string",
    speech_speed: "number"
  },
  media: "![opacity,volume](url) - opacity 0-100, volume 0-100 (optional)",
  wordList: "!{interval,count}(list,of,words) or !{interval,count}(url_to_csv) - interval in seconds, count of words to display at once"
};

/**
 * Parses the entire markdown timeline into an array of TimelineSegment objects.
 * Handles configuration inheritance between segments.
 */
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

/**
 * Serializes an array of TimelineSegment objects back into the markdown format.
 * Optimizes the output by only including configuration changes between segments.
 */
export function serializeTimeline(segments: TimelineSegment[]): string {
  let lastConfig: Partial<SegmentConfig> = {};
  
  return segments.map((seg, index) => {
    let md = '';
    if (index > 0) {
      md += '---\n\n';
    }
    
    let configStr = '';
    const c = seg.config as any;
    
    const keys = ['duration', 'pattern', 'patternType', 'patternSpeed', 'patternScale', 'patternComplexity', 'patternColor1', 'patternColor2', 'patternFaceCamera', 'camera', 'cameraSpeed', 'cameraRadius', 'cameraHeight', 'cameraTargetX', 'cameraTargetY', 'cameraTargetZ', 'cameraFov', 'textFont', 'textDistance', 'textSize', 'textOutlineType', 'textOutlineColor', 'textColor', 'textShading', 'textBackdrop', 'textAnimType', 'textAnimSpeed', 'textAnimIntensity', 'textDisplayPattern', 'textFaceCamera', 'auxFont', 'auxDistance', 'auxSize', 'auxOutlineType', 'auxOutlineColor', 'auxColor', 'auxShading', 'auxBackdrop', 'auxAnimType', 'auxAnimSpeed', 'auxAnimIntensity', 'auxDisplayPattern', 'binaural', 'metronome', 'carrierFreq', 'beatFreq', 'ampModulation', 'audioUrl', 'speech_synth', 'speech_voice', 'speech_speed'];
    
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

/**
 * Minifies the markdown by removing extra whitespace and redundant configuration.
 * Uses aggressive substitution for keys and common values.
 */
export function minifyMarkdown(markdown: string): string {
  const segments = parseTimeline(markdown);
  let lastConfig: Partial<SegmentConfig> = {};
  
  return segments.map((seg, index) => {
    let md = '';
    if (index > 0) {
      md += '§\n'; // separator
    }
    
    let configStr = '';
    const c = seg.config as any;
    const keys = ['duration', 'pattern', 'patternType', 'patternSpeed', 'patternScale', 'patternComplexity', 'patternColor1', 'patternColor2', 'patternFaceCamera', 'camera', 'cameraSpeed', 'cameraRadius', 'cameraHeight', 'cameraTargetX', 'cameraTargetY', 'cameraTargetZ', 'cameraFov', 'textFont', 'textDistance', 'textSize', 'textOutlineType', 'textOutlineColor', 'textColor', 'textShading', 'textBackdrop', 'textAnimType', 'textAnimSpeed', 'textAnimIntensity', 'textDisplayPattern', 'textFaceCamera', 'auxFont', 'auxDistance', 'auxSize', 'auxOutlineType', 'auxOutlineColor', 'auxColor', 'auxShading', 'auxBackdrop', 'auxAnimType', 'auxAnimSpeed', 'auxAnimIntensity', 'auxDisplayPattern', 'binaural', 'metronome', 'carrierFreq', 'beatFreq', 'ampModulation', 'audioUrl', 'speech_synth', 'speech_voice', 'speech_speed'];
    
    for (const key of keys) {
      if (c[key] !== undefined && (index === 0 || c[key] !== (lastConfig as any)[key])) {
        const minKey = KEY_MAP[key] || key;
        const minVal = VALUE_MAP[c[key]] || c[key];
        configStr += `${minKey}:${minVal}\n`;
      }
    }
    
    if (configStr.length > 0) {
      md += '«\n' + configStr + '»\n';
    }
    
    lastConfig = { ...c };
    
    const segmentMd = seg.rawMarkdown
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');
      
    md += segmentMd;
    return md;
  }).join('\n');
}

/**
 * Reverses the aggressive minification to restore the original markdown format.
 */
export function unminifyMarkdown(minified: string): string {
  if (!minified) return '';
  
  // Reverse the mappings
  const REVERSE_KEY_MAP = Object.fromEntries(Object.entries(KEY_MAP).map(([k, v]) => [v, k]));
  const REVERSE_VALUE_MAP = Object.fromEntries(Object.entries(VALUE_MAP).map(([k, v]) => [v, k]));

  // Split by segments first to avoid global replacement issues
  const segments = minified.split(/^§$/gm);
  
  return segments.map(seg => {
    let segment = seg.trim();
    
    // Handle config blocks
    const configMatch = segment.match(/^«\s*[\r\n]+([\s\S]*?)[\r\n]+»/);
    if (configMatch) {
      const configLines = configMatch[1].split(/[\r\n]+/);
      const expandedLines = configLines.map(line => {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length > 0) {
          const val = valueParts.join(':').trim();
          const expandedKey = REVERSE_KEY_MAP[key.trim()] || key.trim();
          const expandedVal = REVERSE_VALUE_MAP[val] || val;
          return `${expandedKey}: ${expandedVal}`;
        }
        return line;
      });
      
      const expandedConfig = '```config\n' + expandedLines.join('\n') + '\n```';
      segment = segment.replace(configMatch[0], expandedConfig);
    }
    
    return segment;
  }).join('\n\n---\n\n');
}
