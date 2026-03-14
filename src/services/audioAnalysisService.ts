import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface AudioSegment {
  start: number;
  end: number;
  text: string;
  sentiment: string;
}

export async function transcribeAudio(audioUrl: string): Promise<string> {
  try {
    const response = await fetch(audioUrl);
    const blob = await response.blob();
    const base64Data = await blobToBase64(blob);

    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          inlineData: {
            mimeType: blob.type || "audio/mpeg",
            data: base64Data,
          },
        },
        { text: "Transcribe this audio exactly. Return only the transcription text." },
      ],
    });

    return result.text || "";
  } catch (error) {
    console.error("Transcription error:", error);
    return "Error transcribing audio.";
  }
}

export async function analyzeGlobalAudio(audioUrl: string): Promise<AudioSegment[]> {
  try {
    const response = await fetch(audioUrl);
    const arrayBuffer = await response.arrayBuffer();
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // 1. In-browser analysis for segmentation (silence detection)
    const segments = detectSegments(audioBuffer);
    
    // 2. For each segment, get transcription and sentiment via Gemini
    const analyzedSegments: AudioSegment[] = [];
    
    for (const seg of segments) {
      const chunkBlob = await extractAudioChunk(audioBuffer, seg.start, seg.end);
      const base64Data = await blobToBase64(chunkBlob);
      
      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            inlineData: {
              mimeType: "audio/wav",
              data: base64Data,
            },
          },
          { 
            text: `Transcribe this audio segment and analyze its sentiment. 
            Return a JSON object with "text" and "sentiment" (one word: positive, negative, or neutral).` 
          },
        ],
        config: {
          responseMimeType: "application/json"
        }
      });
      
      try {
        const data = JSON.parse(result.text || "{}");
        analyzedSegments.push({
          start: seg.start,
          end: seg.end,
          text: data.text || "",
          sentiment: data.sentiment || "neutral"
        });
      } catch (e) {
        analyzedSegments.push({
          start: seg.start,
          end: seg.end,
          text: result.text || "",
          sentiment: "neutral"
        });
      }
    }
    
    return analyzedSegments;
  } catch (error) {
    console.error("Global analysis error:", error);
    return [];
  }
}

function detectSegments(buffer: AudioBuffer): { start: number; end: number }[] {
  const data = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const segments: { start: number; end: number }[] = [];
  
  const threshold = 0.02; // Silence threshold
  const minSilenceLen = 0.5 * sampleRate; // 0.5 seconds of silence to split
  const minSegmentLen = 1.0 * sampleRate; // 1 second minimum segment
  
  let inSegment = false;
  let segmentStart = 0;
  let silenceStart = 0;
  
  for (let i = 0; i < data.length; i++) {
    const amplitude = Math.abs(data[i]);
    
    if (!inSegment) {
      if (amplitude > threshold) {
        inSegment = true;
        segmentStart = i;
      }
    } else {
      if (amplitude < threshold) {
        if (silenceStart === 0) silenceStart = i;
        if (i - silenceStart > minSilenceLen) {
          if (i - segmentStart > minSegmentLen) {
            segments.push({
              start: segmentStart / sampleRate,
              end: silenceStart / sampleRate
            });
          }
          inSegment = false;
          silenceStart = 0;
        }
      } else {
        silenceStart = 0;
      }
    }
  }
  
  if (inSegment) {
    segments.push({
      start: segmentStart / sampleRate,
      end: data.length / sampleRate
    });
  }
  
  // If no segments found, treat whole thing as one
  if (segments.length === 0) {
    segments.push({ start: 0, end: buffer.duration });
  }
  
  return segments;
}

async function extractAudioChunk(buffer: AudioBuffer, start: number, end: number): Promise<Blob> {
  const sampleRate = buffer.sampleRate;
  const startOffset = Math.floor(start * sampleRate);
  const endOffset = Math.floor(end * sampleRate);
  const frameCount = endOffset - startOffset;
  
  const offlineCtx = new OfflineAudioContext(buffer.numberOfChannels, frameCount, sampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(offlineCtx.destination);
  source.start(0, start, end - start);
  
  const renderedBuffer = await offlineCtx.startRendering();
  return bufferToWav(renderedBuffer);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Simple WAV encoder
function bufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const outBuffer = new ArrayBuffer(length);
  const view = new DataView(outBuffer);
  const channels = [];
  let i;
  let sample;
  let offset = 0;
  let pos = 0;

  // write WAVE header
  setUint32(0x46464952);                         // "RIFF"
  setUint32(length - 8);                         // file length - 8
  setUint32(0x45564157);                         // "WAVE"

  setUint32(0x20746d66);                         // "fmt " chunk
  setUint32(16);                                 // length = 16
  setUint16(1);                                  // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan);  // avg. bytes/sec
  setUint16(numOfChan * 2);                      // block-align
  setUint16(16);                                 // 16-bit

  setUint32(0x61746164);                         // "data" - chunk
  setUint32(length - pos - 4);                   // chunk length

  // write interleaved data
  for (i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while (pos < length) {
    for (i = 0; i < numOfChan; i++) {             // interleave channels
      sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
      sample = (sample < 0 ? sample * 0x8000 : sample * 0x7FFF) | 0; // scale to 16-bit signed int
      view.setInt16(pos, sample, true);          // write 16-bit sample
      pos += 2;
    }
    offset++;                                     // next source sample
  }

  return new Blob([outBuffer], { type: "audio/wav" });

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
}
