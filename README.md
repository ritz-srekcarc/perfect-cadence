# Perfect Cadence

Perfect Cadence is a professional-grade hypnotic visualizer and meditation tool designed to create immersive, synchronized experiences. It combines advanced 3D patterns, binaural audio, and AI-driven analysis to help users achieve specific mental states.

## Features

### 🌀 Immersive Visuals
- **Dynamic Patterns:** Choose from a variety of hypnotic patterns including Spiral, Tunnel, Rings, Particles, Mandala, Kaleidoscope, Waves, and Pulse.
- **Customizable Geometry:** Adjust pattern type (Galaxy, Sphere, Vortex, Sacred Geometry), speed, scale, and complexity.
- **Advanced Camera:** Control the perspective with Static, Orbit, Fly, and Pan modes, including FOV and target adjustments.

### 🎧 Synchronized Audio
- **Binaural Beats:** Integrated brainwave entrainment with presets for Focus, Relax, and Sleep, or fully custom frequency control.
- **Metronome:** Precise BPM tracking to anchor the experience.
- **Custom Audio Support:** Upload or link external audio files for each segment.

### 🤖 AI-Powered Analysis
- **Global Audio Importer:** Automatically generate a full visual timeline from an audio file. The system uses in-browser silence detection for segmentation and Gemini AI for transcription and sentiment analysis.
- **Per-Segment Transcription:** Quickly transcribe custom audio clips directly into the segment text.

### 📝 Timeline System
- **Markdown-Based:** Define your experience using a simple Markdown syntax with `---` separators.
- **Rich Text & Media:** Support for Markdown headers (`#`), emphasis (`**bold**`, `*italic*`), blockquotes (`> aux text`), images, and videos (`![opacity](url)`).
- **Wordlists:** Display a sequence of words with customizable intervals and patterns (`!{interval,pattern}(list,of,words)`). Includes pre-built hypnotic lists (`relax`, `focus`, `sleep`, `confidence`, `energy`).
- **Visual Editor:** A user-friendly interface to manage segments, colors, patterns, and audio without writing code. Now features a full Markdown editor with syntax highlighting for each segment.
- **Text Animations:** Bring your words to life with effects like Zoom, Fade, Float, Warp, Prism, and the high-energy Glitch animation.

## Getting Started

1. **Visual Editor:** Use the tabs to switch between the Visual Editor and the raw Markdown timeline.
2. **Import Audio:** Click the 🪄 (Wand) icon to import and analyze a full audio track.
3. **Play:** Hit the Play button to start the immersive experience.
4. **Share:** Use the Share button to generate a link to your current creation.

## More Information

- [Perfect Cadence MCP Server](https://staticmcp.com/docs/standard)
- [Contributing Guidelines](CONTRIBUTING.md)
- [License Information](LICENSE.md)

### MCP Server
Perfect Cadence includes a statically compiled MCP server. During the build process (`npm run build`), the MCP hierarchy is generated and nested under `/dist/mcp`. This allows AI models to access documentation about Perfect Cadence's syntax and features.

To use it, configure your MCP client to point to the `mcp.json` file in your deployed `dist/mcp` directory.
