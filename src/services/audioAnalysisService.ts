import { pipeline, env } from '@huggingface/transformers';

// Disable local models, use CDN
env.allowLocalModels = false;
env.useBrowserCache = true;

export interface AudioSegment {
  start: number;
  end: number;
  text: string;
  sentiment: string;
}

let transcriber: any = null;
let sentimentAnalyzer: any = null;

async function initModels(onProgress?: (msg: string) => void) {
  if (!transcriber) {
    if (onProgress) onProgress("Loading Whisper model (this may take a minute)...");
    transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
  }
  if (!sentimentAnalyzer) {
    if (onProgress) onProgress("Loading Sentiment model...");
    sentimentAnalyzer = await pipeline('text-classification', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english');
  }
}

async function getAudioData(audioUrl: string): Promise<Float32Array> {
  const response = await fetch(audioUrl);
  const arrayBuffer = await response.arrayBuffer();
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  // Resample to 16kHz for Whisper
  const targetSampleRate = 16000;
  const offlineCtx = new OfflineAudioContext(1, Math.ceil(audioBuffer.duration * targetSampleRate), targetSampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);
  const renderedBuffer = await offlineCtx.startRendering();
  return renderedBuffer.getChannelData(0);
}

export async function transcribeAudio(audioUrl: string, onProgress?: (msg: string) => void): Promise<string> {
  try {
    await initModels(onProgress);
    if (onProgress) onProgress("Decoding and resampling audio...");
    const audioData = await getAudioData(audioUrl);
    
    if (onProgress) onProgress("Transcribing audio...");
    const result = await transcriber(audioData, {
      chunk_length_s: 30,
      stride_length_s: 5,
    });
    
    return result.text || "";
  } catch (error) {
    console.error("Transcription error:", error);
    return "Error transcribing audio.";
  }
}

export async function analyzeGlobalAudio(audioUrl: string, onProgress?: (msg: string) => void): Promise<AudioSegment[]> {
  try {
    await initModels(onProgress);
    
    if (onProgress) onProgress("Decoding and resampling audio...");
    const audioData = await getAudioData(audioUrl);
    
    if (onProgress) onProgress("Transcribing audio and generating timestamps...");
    const result = await transcriber(audioData, {
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: true,
    });
    
    const analyzedSegments: AudioSegment[] = [];
    const chunks = result.chunks || [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (onProgress) onProgress(`Analyzing sentiment for segment ${i + 1}/${chunks.length}...`);
      
      let sentiment = "neutral";
      if (chunk.text && chunk.text.trim().length > 0) {
        try {
          const sentimentResult = await sentimentAnalyzer(chunk.text);
          if (sentimentResult && sentimentResult.length > 0) {
            const label = sentimentResult[0].label.toLowerCase();
            if (label === 'positive') sentiment = 'positive';
            else if (label === 'negative') sentiment = 'negative';
          }
        } catch (e) {
          console.error("Sentiment analysis error:", e);
        }
      }
      
      analyzedSegments.push({
        start: chunk.timestamp[0],
        end: chunk.timestamp[1] || chunk.timestamp[0] + 5,
        text: chunk.text.trim(),
        sentiment
      });
    }
    
    return analyzedSegments;
  } catch (error) {
    console.error("Global analysis error:", error);
    return [];
  }
}
