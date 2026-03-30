import * as GUI from '@babylonjs/gui';
import { TextLine, TextToken } from './markdownRenderer';

export function createControlForLine(line: TextLine, color: string, fontFamily: string, baseSize: number): GUI.StackPanel {
  const panel = new GUI.StackPanel();
  panel.isVertical = false;
  panel.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
  panel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
  panel.height = (baseSize * 1.5) + "px";

  let prefix = "";
  if (line.listType === 'bullet') prefix = "• ";
  else if (line.listType === 'number') prefix = `${line.listIndex}. `;

  if (prefix) {
    const tb = new GUI.TextBlock();
    tb.text = prefix;
    tb.color = color;
    tb.fontFamily = fontFamily;
    tb.fontSize = baseSize;
    tb.resizeToFit = true;
    tb.paddingLeft = "10px";
    tb.paddingRight = "10px";
    tb.paddingTop = "10px";
    tb.paddingBottom = "10px";
    panel.addControl(tb);
  }

  for (const token of line.tokens) {
    if (token.type === 'text' && token.content) {
      const tb = new GUI.TextBlock();
      tb.text = token.content;
      tb.color = color;
      tb.fontFamily = fontFamily;
      
      let size = baseSize;
      if (line.headerLevel > 0) {
        size = baseSize * (1 + (6 - line.headerLevel) * 0.2);
        tb.fontWeight = "bold";
      }
      tb.fontSize = size;

      if (token.bold) tb.fontWeight = "bold";
      if (token.italic) tb.fontStyle = "italic";

      tb.resizeToFit = true;
      tb.paddingLeft = "10px";
      tb.paddingRight = "10px";
      tb.paddingTop = "10px";
      tb.paddingBottom = "10px";
      panel.addControl(tb);
    } else if (token.type === 'wordlist') {
      const count = token.count || 1;
      for (let i = 0; i < count; i++) {
        const tb = new GUI.TextBlock();
        const words = token.words || [];
        const initialWord = words.length > 0 ? words[Math.floor(Math.random() * words.length)] : "";
        tb.text = initialWord + " "; 
        tb.color = color;
        tb.fontFamily = fontFamily;
        
        let size = baseSize;
        if (line.headerLevel > 0) {
          size = baseSize * (1 + (6 - line.headerLevel) * 0.2);
          tb.fontWeight = "bold";
        }
        tb.fontSize = size;

        if (token.bold) tb.fontWeight = "bold";
        if (token.italic) tb.fontStyle = "italic";
        tb.resizeToFit = true;
        tb.paddingLeft = "10px";
        tb.paddingRight = "10px";
        tb.paddingTop = "10px";
        tb.paddingBottom = "10px";
        
        (tb as any).wordListConfig = token;
        (tb as any).wordListTimer = 0;
        (tb as any).wordListIndexOffset = i;
        (tb as any).randomSeed = Math.random();
        
        panel.addControl(tb);
      }
    }
  }

  return panel;
}

export function createControlsForWords(line: TextLine, color: string, fontFamily: string, baseSize: number): GUI.Control[] {
  const controls: GUI.Control[] = [];
  
  let prefix = "";
  if (line.listType === 'bullet') prefix = "•";
  else if (line.listType === 'number') prefix = `${line.listIndex}.`;

  if (prefix) {
    const tb = new GUI.TextBlock();
    tb.text = prefix;
    tb.color = color;
    tb.fontFamily = fontFamily;
    tb.fontSize = baseSize;
    tb.resizeToFit = true;
    tb.paddingLeft = "10px";
    tb.paddingRight = "10px";
    tb.paddingTop = "10px";
    tb.paddingBottom = "10px";
    controls.push(tb);
  }

  for (const token of line.tokens) {
    if (token.type === 'text' && token.content) {
      const words = token.content.split(/\s+/).filter(w => w.length > 0);
      for (const word of words) {
        const tb = new GUI.TextBlock();
        tb.text = word;
        tb.color = color;
        tb.fontFamily = fontFamily;
        
        let size = baseSize;
        if (line.headerLevel > 0) {
          size = baseSize * (1 + (6 - line.headerLevel) * 0.2);
          tb.fontWeight = "bold";
        }
        tb.fontSize = size;

        if (token.bold) tb.fontWeight = "bold";
        if (token.italic) tb.fontStyle = "italic";

        tb.resizeToFit = true;
        tb.paddingLeft = "10px";
        tb.paddingRight = "10px";
        tb.paddingTop = "10px";
        tb.paddingBottom = "10px";
        controls.push(tb);
      }
    } else if (token.type === 'wordlist') {
      // For wordlists in scattered mode, we might want to create multiple controls based on 'count'
      const count = token.count || 1;
      for (let i = 0; i < count; i++) {
        const tb = new GUI.TextBlock();
        const words = token.words || [];
        const initialWord = words.length > 0 ? words[Math.floor(Math.random() * words.length)] : "";
        tb.text = initialWord + " "; 
        tb.color = color;
        tb.fontFamily = fontFamily;
        
        let size = baseSize;
        if (line.headerLevel > 0) {
          size = baseSize * (1 + (6 - line.headerLevel) * 0.2);
          tb.fontWeight = "bold";
        }
        tb.fontSize = size;

        if (token.bold) tb.fontWeight = "bold";
        if (token.italic) tb.fontStyle = "italic";
        tb.resizeToFit = true;
        tb.paddingLeft = "10px";
        tb.paddingRight = "10px";
        tb.paddingTop = "10px";
        tb.paddingBottom = "10px";
        
        (tb as any).wordListConfig = token;
        (tb as any).wordListTimer = 0;
        (tb as any).wordListIndexOffset = i; // To pick different words
        (tb as any).randomSeed = Math.random();
        
        controls.push(tb);
      }
    }
  }
  
  return controls;
}
