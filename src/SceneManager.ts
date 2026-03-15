import { Engine, Scene, Vector3, HemisphericLight, ArcRotateCamera, MeshBuilder, Mesh, StandardMaterial, Color3, Texture, DynamicTexture, WebXRDefaultExperience, WebXRState, SceneLoader, TransformNode, ParticleSystem, ShaderMaterial, Effect, VertexBuffer, VideoTexture, WebXRSessionManager } from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import { SegmentConfig, MediaItem } from './timelineParser';

export class SceneManager {
  private engine: Engine;
  private scene: Scene;
  private camera: ArcRotateCamera;
  private xr: WebXRDefaultExperience | null = null;
  private xrUIPanel: Mesh | null = null;
  private xrUITexture: GUI.AdvancedDynamicTexture | null = null;
  private xrSegmentText: GUI.TextBlock | null = null;
  private xrProgressText: GUI.TextBlock | null = null;
  
  public onPlayPause?: () => void;
  public onNext?: () => void;
  public onPrev?: () => void;
  public onToggleMode?: () => void;
  public onVolumeUp?: () => void;
  public onVolumeDown?: () => void;

  private currentMeshes: any[] = [];
  private textPlane: any = null;
  private textTexture: GUI.AdvancedDynamicTexture | null = null;
  private textBackground: GUI.Rectangle | null = null;
  private textBlock: GUI.TextBlock | null = null;
  private auxTextPlane: any = null;
  private auxTextTexture: GUI.AdvancedDynamicTexture | null = null;
  private auxTextBackground: GUI.Rectangle | null = null;
  private auxTextBlock: GUI.TextBlock | null = null;
  private wordListMainBlock: GUI.TextBlock | null = null;
  private wordListAuxBlock: GUI.TextBlock | null = null;
  private currentWordList: import('./timelineParser').WordList | null = null;
  private mediaControls: GUI.Image[] = [];
  private mediaMeshes: any[] = [];
  private time: number = 0;
  private segmentDuration: number = 0;
  private currentConfig: SegmentConfig | null = null;
  private particleSystem: ParticleSystem | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, true);
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color3(0.05, 0.05, 0.05).toColor4(1);
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.03;
    this.scene.fogColor = new Color3(0.05, 0.05, 0.05);

    this.camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 15, Vector3.Zero(), this.scene);
    this.camera.attachControl(canvas, true);

    const light = new HemisphericLight("light", new Vector3(0, 1, 0), this.scene);
    light.intensity = 0.7;

    this.setupGUI();
    this.initXR();

    this.engine.runRenderLoop(() => {
      this.time += this.engine.getDeltaTime() * 0.001;
      if (this.time > this.segmentDuration) {
        this.mediaMeshes.forEach(m => {
          if (m.material && m.material.diffuseTexture instanceof VideoTexture) {
            m.material.diffuseTexture.video.pause();
          }
        });
      }
      this.updateCamera();
      this.updatePattern();
      this.updateTextAnimation();
      this.scene.render();
    });

    window.addEventListener("resize", () => {
      this.engine.resize();
    });
  }

  private async initXR() {
    // Check if WebXR is supported before attempting to initialize
    const isSupported = await WebXRSessionManager.IsSessionSupportedAsync('immersive-vr');
    if (!isSupported) {
      return;
    }

    try {
      this.xr = await this.scene.createDefaultXRExperienceAsync({
        uiOptions: {
          sessionMode: 'immersive-vr',
        }
      });

      if (this.xr) {
        this.xr.baseExperience.onStateChangedObservable.add((state) => {
          if (state === WebXRState.IN_XR) {
            this.setupXRUI();
          } else if (state === WebXRState.NOT_IN_XR) {
            if (this.xrUIPanel) {
              this.xrUIPanel.dispose();
              this.xrUIPanel = null;
            }
            if (this.xrUITexture) {
              this.xrUITexture.dispose();
              this.xrUITexture = null;
            }
          }
        });
      }
    } catch (e) {
      console.warn("XR not supported", e);
    }
  }

  private setupXRUI() {
    if (!this.xr) return;

    // Create a floating UI panel in front of the user
    const panel = MeshBuilder.CreatePlane("xrUI", { width: 5, height: 4 }, this.scene);
    
    // Position it in front of the camera
    const camera = this.xr.baseExperience.camera;
    const forward = camera.getForwardRay().direction;
    panel.position = camera.position.add(forward.scale(4));
    panel.lookAt(camera.position);
    panel.rotate(Vector3.Up(), Math.PI);
    
    this.xrUIPanel = panel;

    this.xrUITexture = GUI.AdvancedDynamicTexture.CreateForMesh(panel, 1024, 800);
    
    const mainContainer = new GUI.Rectangle();
    mainContainer.width = "100%";
    mainContainer.height = "100%";
    mainContainer.background = "rgba(15, 15, 20, 0.95)";
    mainContainer.cornerRadius = 40;
    mainContainer.thickness = 0;
    this.xrUITexture.addControl(mainContainer);

    const stackPanel = new GUI.StackPanel();
    stackPanel.width = "100%";
    stackPanel.height = "100%";
    stackPanel.paddingTop = "20px";
    stackPanel.paddingBottom = "20px";
    mainContainer.addControl(stackPanel);

    const header = new GUI.StackPanel();
    header.height = "100px";
    header.isVertical = false;
    stackPanel.addControl(header);

    const title = new GUI.TextBlock();
    title.text = "PERFECT CADENCE VR";
    title.width = "70%";
    title.color = "#10b981"; // Emerald 500
    title.fontSize = 48;
    title.fontWeight = "bold";
    title.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    title.paddingLeft = "40px";
    header.addControl(title);

    const closeBtn = GUI.Button.CreateSimpleButton("exit", "EXIT VR");
    closeBtn.width = "200px";
    closeBtn.height = "60px";
    closeBtn.color = "white";
    closeBtn.background = "#ef4444";
    closeBtn.cornerRadius = 10;
    closeBtn.fontSize = 24;
    closeBtn.onPointerUpObservable.add(() => this.xr?.baseExperience.exitXRAsync());
    header.addControl(closeBtn);

    // Current Segment Info
    const infoPanel = new GUI.Rectangle();
    infoPanel.height = "200px";
    infoPanel.width = "90%";
    infoPanel.background = "rgba(255,255,255,0.05)";
    infoPanel.cornerRadius = 20;
    infoPanel.thickness = 1;
    infoPanel.color = "rgba(255,255,255,0.2)";
    infoPanel.paddingTop = "20px";
    stackPanel.addControl(infoPanel);

    const segmentText = new GUI.TextBlock();
    segmentText.text = "Current Segment: " + (this.currentConfig?.pattern || "None");
    segmentText.color = "white";
    segmentText.fontSize = 32;
    segmentText.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
    segmentText.paddingTop = "20px";
    infoPanel.addControl(segmentText);
    this.xrSegmentText = segmentText;

    const progressText = new GUI.TextBlock();
    progressText.text = "0s / 0s";
    progressText.color = "#10b981";
    progressText.fontSize = 48;
    progressText.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    progressText.paddingBottom = "20px";
    infoPanel.addControl(progressText);
    this.xrProgressText = progressText;

    // Playback Controls
    const controlsTitle = new GUI.TextBlock();
    controlsTitle.text = "PLAYBACK CONTROLS";
    controlsTitle.height = "60px";
    controlsTitle.color = "#94a3b8";
    controlsTitle.fontSize = 24;
    controlsTitle.paddingTop = "30px";
    stackPanel.addControl(controlsTitle);

    const buttonContainer = new GUI.StackPanel();
    buttonContainer.isVertical = false;
    buttonContainer.height = "140px";
    stackPanel.addControl(buttonContainer);

    const createBtn = (text: string, color: string, callback?: () => void) => {
      const btn = GUI.Button.CreateSimpleButton(text, text);
      btn.width = "180px";
      btn.height = "100px";
      btn.color = "white";
      btn.background = color;
      btn.cornerRadius = 15;
      btn.fontSize = 28;
      btn.paddingRight = "15px";
      btn.paddingLeft = "15px";
      btn.thickness = 0;
      btn.hoverCursor = "pointer";
      if (callback) btn.onPointerUpObservable.add(callback);
      return btn;
    };

    const prevBtn = createBtn("PREV", "#334155", () => this.onPrev?.());
    buttonContainer.addControl(prevBtn);

    const playBtn = createBtn("PLAY/PAUSE", "#059669", () => this.onPlayPause?.());
    buttonContainer.addControl(playBtn);

    const nextBtn = createBtn("NEXT", "#334155", () => this.onNext?.());
    buttonContainer.addControl(nextBtn);

    // Volume Controls
    const volumeContainer = new GUI.StackPanel();
    volumeContainer.isVertical = false;
    volumeContainer.height = "100px";
    volumeContainer.paddingTop = "10px";
    stackPanel.addControl(volumeContainer);

    const volDownBtn = createBtn("VOL -", "#475569", () => this.onVolumeDown?.());
    volDownBtn.width = "150px";
    volDownBtn.height = "80px";
    volumeContainer.addControl(volDownBtn);

    const volUpBtn = createBtn("VOL +", "#475569", () => this.onVolumeUp?.());
    volUpBtn.width = "150px";
    volUpBtn.height = "80px";
    volumeContainer.addControl(volUpBtn);

    // Mode Toggle
    const modeBtn = createBtn("TOGGLE EDITOR", "#2563eb", () => this.onToggleMode?.());
    modeBtn.width = "400px";
    modeBtn.paddingTop = "20px";
    stackPanel.addControl(modeBtn);

    const footer = new GUI.TextBlock();
    footer.text = "Point and trigger to interact";
    footer.height = "60px";
    footer.color = "#64748b";
    footer.fontSize = 20;
    footer.paddingTop = "20px";
    stackPanel.addControl(footer);
  }

  private setupGUI() {
    // Create a plane for the text
    const plane = MeshBuilder.CreatePlane("textPlane", { width: 20, height: 10 }, this.scene);
    // Primary text is now in world space, NOT parented to camera
    plane.position = new Vector3(0, 0, 0); 
    this.textPlane = plane;

    // High resolution to avoid blocky glitches
    this.textTexture = GUI.AdvancedDynamicTexture.CreateForMesh(plane, 2048, 1024);
    this.textTexture.updateSamplingMode(Texture.TRILINEAR_SAMPLINGMODE);
    
    this.textBackground = new GUI.Rectangle();
    this.textBackground.width = 1;
    this.textBackground.height = 1;
    this.textBackground.thickness = 0;
    this.textBackground.background = "transparent";
    this.textTexture.addControl(this.textBackground);

    this.textBlock = new GUI.TextBlock();
    this.textBlock.text = "Welcome";
    this.textBlock.color = "white";
    this.textBlock.fontSize = 100;
    this.textBlock.textWrapping = true;
    this.textBlock.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.textBlock.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    
    // Default rainbow outline
    this.textBlock.outlineWidth = 8;
    
    this.textBackground.addControl(this.textBlock);

    // Create a plane for the aux text (blockquote)
    const auxPlane = MeshBuilder.CreatePlane("auxTextPlane", { width: 20, height: 10 }, this.scene);
    auxPlane.parent = this.camera;
    auxPlane.position = new Vector3(0, 0, 10);
    this.auxTextPlane = auxPlane;
    this.auxTextPlane.isVisible = false;

    this.auxTextTexture = GUI.AdvancedDynamicTexture.CreateForMesh(auxPlane, 2048, 1024);
    this.auxTextTexture.updateSamplingMode(Texture.TRILINEAR_SAMPLINGMODE);
    
    this.auxTextBackground = new GUI.Rectangle();
    this.auxTextBackground.width = 1;
    this.auxTextBackground.height = 1;
    this.auxTextBackground.thickness = 0;
    this.auxTextBackground.background = "transparent";
    this.auxTextTexture.addControl(this.auxTextBackground);

    this.auxTextBlock = new GUI.TextBlock();
    this.auxTextBlock.text = "";
    this.auxTextBlock.color = "white";
    this.auxTextBlock.fontSize = 100;
    this.auxTextBlock.textWrapping = true;
    this.auxTextBlock.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.auxTextBlock.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    this.auxTextBlock.outlineWidth = 8;
    
    this.auxTextBackground.addControl(this.auxTextBlock);

    // Create word list blocks on the same layers
    this.wordListMainBlock = new GUI.TextBlock();
    this.wordListMainBlock.text = "";
    this.wordListMainBlock.color = "white";
    this.wordListMainBlock.fontSize = 120;
    this.wordListMainBlock.textWrapping = true;
    this.wordListMainBlock.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.wordListMainBlock.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    this.wordListMainBlock.outlineWidth = 8;
    this.wordListMainBlock.isVisible = false;
    this.textBackground.addControl(this.wordListMainBlock);

    this.wordListAuxBlock = new GUI.TextBlock();
    this.wordListAuxBlock.text = "";
    this.wordListAuxBlock.color = "white";
    this.wordListAuxBlock.fontSize = 100;
    this.wordListAuxBlock.textWrapping = true;
    this.wordListAuxBlock.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.wordListAuxBlock.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    this.wordListAuxBlock.outlineWidth = 8;
    this.wordListAuxBlock.isVisible = false;
    this.auxTextBackground.addControl(this.wordListAuxBlock);
  }

  private applyMarkdownStyling(block: GUI.TextBlock, text: string, baseFontSize: number) {
    let cleanText = text;
    let isHeader = false;
    let isBold = false;
    let isItalic = false;

    if (/^#+\s/m.test(cleanText)) {
      isHeader = true;
      cleanText = cleanText.replace(/^#+\s/gm, '');
    }
    if (/\*\*(.*?)\*\*/g.test(cleanText)) {
      isBold = true;
      cleanText = cleanText.replace(/\*\*(.*?)\*\*/g, '$1');
    }
    if (/\*(.*?)\*/g.test(cleanText)) {
      isItalic = true;
      cleanText = cleanText.replace(/\*(.*?)\*/g, '$1');
    }
    if (/_(.*?)_/g.test(cleanText)) {
      isItalic = true;
      cleanText = cleanText.replace(/_(.*?)_/g, '$1');
    }

    block.text = cleanText.trim();
    block.fontWeight = (isHeader || isBold) ? "bold" : "normal";
    block.fontStyle = isItalic ? "italic" : "normal";
    block.fontSize = isHeader ? baseFontSize * 1.5 : baseFontSize;
  }

  public updateText(text: string, auxText?: string, wordList?: import('./timelineParser').WordList) {
    this.currentWordList = wordList || null;
    if (this.textBlock) {
      const baseSize = this.currentConfig?.textSize ?? 100;
      this.applyMarkdownStyling(this.textBlock, text, baseSize);
    }
    if (this.auxTextBlock && this.auxTextPlane) {
      const hasAuxContent = !!auxText || (wordList?.layer === 'aux');
      if (hasAuxContent) {
        const baseSize = this.currentConfig?.auxSize ?? 100;
        if (auxText) {
          this.applyMarkdownStyling(this.auxTextBlock, auxText, baseSize);
        } else {
          this.auxTextBlock.text = "";
        }
        this.auxTextPlane.isVisible = true;
      } else {
        this.auxTextBlock.text = "";
        this.auxTextPlane.isVisible = false;
      }
    }
  }

  public updateMedia(media: MediaItem[]) {
    if (!this.textBackground || !this.auxTextBackground) return;
    // Clear old media
    this.mediaControls.forEach(c => c.dispose());
    this.mediaControls = [];
    this.mediaMeshes.forEach(m => m.dispose());
    this.mediaMeshes = [];

    const hasAuxMedia = media.some(m => m.layer === 'aux');
    if (hasAuxMedia && this.auxTextPlane) {
      this.auxTextPlane.isVisible = true;
    }

    // Add new media
    media.forEach((m, i) => {
      if (m.type === 'image') {
        const img = new GUI.Image("media", m.url);
        img.alpha = m.opacity;
        if (m.layer === 'aux') {
          this.auxTextBackground!.addControl(img);
        } else {
          this.textBackground!.addControl(img);
        }
        this.mediaControls.push(img);
      } else if (m.type === 'video') {
        const plane = MeshBuilder.CreatePlane("video", { width: 20, height: 10, sideOrientation: Mesh.DOUBLESIDE }, this.scene);
        
        // Parent to the correct text plane to inherit its behavior (world space vs camera locked)
        if (m.layer === 'aux') {
          plane.parent = this.auxTextPlane;
        } else {
          plane.parent = this.textPlane;
        }
        
        // Position slightly behind the text plane (Z is local forward, so negative is behind)
        plane.position = new Vector3(0, 0, -0.01 - i * 0.01); 
        
        const mat = new StandardMaterial("videoMat", this.scene);
        const videoTexture = new VideoTexture("videoTex", m.url, this.scene, false, false, VideoTexture.TRILINEAR_SAMPLINGMODE, {
          autoPlay: true,
          autoUpdateTexture: true,
          loop: true,
          muted: m.volume === 0
        });
        
        if (videoTexture.video) {
          videoTexture.video.crossOrigin = "anonymous";
        }
        
        // Ensure video plays and handle potential autoplay blocks
        const playVideo = () => {
          if (videoTexture.video) {
            videoTexture.video.play().catch(e => {
              console.warn("Video autoplay blocked, retrying muted:", e);
              videoTexture.video.muted = true;
              videoTexture.video.play().catch(err => console.error("Video failed to play even when muted:", err));
            });
          }
        };

        // Try playing immediately
        playVideo();
        
        // Also try playing on next frame to ensure engine is ready
        setTimeout(playVideo, 100);
        
        if (m.volume !== undefined) {
          videoTexture.video.volume = m.volume;
        } else {
          videoTexture.video.volume = 1;
        }
        
        mat.diffuseTexture = videoTexture;
        mat.emissiveColor = Color3.White();
        mat.disableLighting = true;
        mat.alpha = m.opacity;
        plane.material = mat;
        this.mediaMeshes.push(plane);
      }
    });
  }

  public applyConfig(config: SegmentConfig) {
    const prevConfig = this.currentConfig;
    this.currentConfig = config;
    this.segmentDuration = config.duration;
    this.time = 0;

    if (this.xrSegmentText) {
      this.xrSegmentText.text = "Current Segment: " + (config.pattern || "None");
    }

    const patternChanged = !prevConfig || prevConfig.pattern !== config.pattern;
    const cameraChanged = !prevConfig || prevConfig.camera !== config.camera;
    
    if (patternChanged) {
      this.clearCurrentMeshes();
      switch (config.pattern) {
        case 'spiral':
          this.createSpiral();
          break;
        case 'tunnel':
          this.createTunnel();
          break;
        case 'fractal':
        case 'rings':
          this.createRings();
          break;
        case 'particles':
          this.createParticles();
          break;
        case 'mandala':
          this.createMandala();
          break;
        case 'kaleidoscope':
          this.createKaleidoscope();
          break;
        case 'waves':
          this.createWaves();
          break;
        case 'pulse':
          this.createPulse();
          break;
      }
    }

    // Apply text config
    if (this.textPlane) {
      // Primary text is now fixed at the world origin (pattern center)
      // instead of following the camera target.
      this.textPlane.position = Vector3.Zero();
      
      const dist = config.textDistance ?? 10;
      // We use dist to scale the text plane since it's at the origin now
      const scale = dist / 5;
      this.textPlane.scaling = new Vector3(scale, scale, scale);
    }
    
    if (this.textBlock) {
      this.textBlock.fontSize = config.textSize ?? 100;
      this.textBlock.fontFamily = config.textFont ?? 'sans-serif';

      if (config.textShading) {
        this.textBlock.shadowColor = "rgba(0,0,0,0.8)";
        this.textBlock.shadowBlur = 10;
        this.textBlock.shadowOffsetX = 5;
        this.textBlock.shadowOffsetY = 5;
      } else {
        this.textBlock.shadowBlur = 0;
        this.textBlock.shadowOffsetX = 0;
        this.textBlock.shadowOffsetY = 0;
      }

      if (this.wordListMainBlock) {
        this.wordListMainBlock.fontSize = this.textBlock.fontSize;
        this.wordListMainBlock.fontFamily = this.textBlock.fontFamily;
        this.wordListMainBlock.shadowColor = this.textBlock.shadowColor;
        this.wordListMainBlock.shadowBlur = this.textBlock.shadowBlur;
        this.wordListMainBlock.shadowOffsetX = this.textBlock.shadowOffsetX;
        this.wordListMainBlock.shadowOffsetY = this.textBlock.shadowOffsetY;
      }
    }
    
    if (this.textBackground) {
      this.textBackground.background = config.textBackdrop ? "rgba(0,0,0,0.5)" : "transparent";
    }

    // Apply aux text config
    if (this.auxTextPlane) {
      const dist = config.auxDistance ?? 10;
      this.auxTextPlane.position.z = dist;
      const scale = dist / 5;
      this.auxTextPlane.scaling = new Vector3(scale, scale, scale);
    }
    
    if (this.auxTextBlock) {
      this.auxTextBlock.fontSize = config.auxSize ?? 100;
      this.auxTextBlock.fontFamily = config.auxFont ?? 'sans-serif';

      if (config.auxShading) {
        this.auxTextBlock.shadowColor = "rgba(0,0,0,0.8)";
        this.auxTextBlock.shadowBlur = 10;
        this.auxTextBlock.shadowOffsetX = 5;
        this.auxTextBlock.shadowOffsetY = 5;
      } else {
        this.auxTextBlock.shadowBlur = 0;
        this.auxTextBlock.shadowOffsetX = 0;
        this.auxTextBlock.shadowOffsetY = 0;
      }

      if (this.wordListAuxBlock) {
        this.wordListAuxBlock.fontSize = this.auxTextBlock.fontSize;
        this.wordListAuxBlock.fontFamily = this.auxTextBlock.fontFamily;
        this.wordListAuxBlock.shadowColor = this.auxTextBlock.shadowColor;
        this.wordListAuxBlock.shadowBlur = this.auxTextBlock.shadowBlur;
        this.wordListAuxBlock.shadowOffsetX = this.auxTextBlock.shadowOffsetX;
        this.wordListAuxBlock.shadowOffsetY = this.auxTextBlock.shadowOffsetY;
      }
    }
    
    if (this.auxTextBackground) {
      this.auxTextBackground.background = config.auxBackdrop ? "rgba(0,0,0,0.5)" : "transparent";
    }

    // Apply advanced camera options
    if (config.cameraFov !== undefined && config.cameraFov > 0) {
      this.camera.fov = config.cameraFov * (Math.PI / 180);
    } else {
      this.camera.fov = 0.8; // Default
    }

    // Reset camera position based on mode
    if (patternChanged || cameraChanged) {
      const targetX = config.cameraTargetX ?? 0;
      const targetY = config.cameraTargetY ?? 0;
      const targetZ = config.cameraTargetZ ?? 0;
      
      if (config.camera === 'static' || config.camera === 'orbit') {
        this.camera.setTarget(new Vector3(targetX, targetY, targetZ));
        this.camera.alpha = -Math.PI / 2;
        this.camera.beta = config.cameraHeight !== undefined ? config.cameraHeight : Math.PI / 6;
        this.camera.radius = config.cameraRadius !== undefined ? config.cameraRadius : 15;
      } else if (config.camera === 'fly') {
        this.camera.setTarget(new Vector3(targetX, targetY, this.camera.target.z || 50));
        this.camera.alpha = -Math.PI / 2;
        this.camera.beta = config.cameraHeight !== undefined ? config.cameraHeight : Math.PI / 2;
        this.camera.radius = config.cameraRadius !== undefined ? config.cameraRadius : 5; // Closer to target
      } else if (config.camera === 'pan') {
        this.camera.setTarget(new Vector3(targetX, targetY, targetZ));
        this.camera.alpha = -Math.PI / 2;
        this.camera.beta = config.cameraHeight !== undefined ? config.cameraHeight : Math.PI / 2;
        this.camera.radius = config.cameraRadius !== undefined ? config.cameraRadius : 8; // Zoomed further in
      }
    } else {
      // If only advanced camera options changed, apply them without resetting alpha/beta if not static
      if (config.cameraRadius !== undefined) this.camera.radius = config.cameraRadius;
      if (config.cameraHeight !== undefined) this.camera.beta = config.cameraHeight;
      if (config.cameraTargetX !== undefined || config.cameraTargetY !== undefined || config.cameraTargetZ !== undefined) {
        if (config.camera !== 'fly' && config.camera !== 'pan') {
          this.camera.setTarget(new Vector3(config.cameraTargetX ?? 0, config.cameraTargetY ?? 0, config.cameraTargetZ ?? 0));
        }
      }
    }
  }

  private clearCurrentMeshes() {
    this.currentMeshes.forEach(m => m.dispose());
    this.currentMeshes = [];
    if (this.particleSystem) {
      this.particleSystem.dispose();
      this.particleSystem = null;
    }
  }

  private parseColor(hex?: string, defaultColor?: Color3): Color3 {
    if (!hex) return defaultColor || new Color3(1, 1, 1);
    try {
      return Color3.FromHexString(hex.startsWith('#') ? hex : `#${hex}`);
    } catch (e) {
      return defaultColor || new Color3(1, 1, 1);
    }
  }

  private createSpiral() {
    const type = this.currentConfig?.patternType || 'default';
    const complexity = this.currentConfig?.patternComplexity ?? 1;
    const scale = this.currentConfig?.patternScale ?? 1.0;
    
    const material = new StandardMaterial("spiralMat", this.scene);
    material.emissiveColor = this.parseColor(this.currentConfig?.patternColor1, new Color3(0.2, 0.8, 1.0));
    material.wireframe = true;
    material.alpha = 0.5;

    let arms = type === 'galaxy' ? 5 : (type === 'double' ? 2 : 1);
    if (type === 'vortex') arms = 8;
    if (type === 'infinite') arms = 3;
    
    arms = Math.max(1, Math.floor(arms * complexity));
    
    for (let a = 0; a < arms; a++) {
      const armOffset = (Math.PI * 2 / arms) * a;
      const paths = [];
      const numPaths = type === 'infinite' ? 40 : 20;
      const pathLength = type === 'vortex' ? 400 : 200;
      
      for (let i = 0; i < numPaths; i++) {
        const path = [];
        for (let j = 0; j < pathLength; j++) {
          const angle = j * 0.1 + (i * Math.PI * 2 / numPaths) + armOffset;
          let radius = type === 'galaxy' ? j * 0.05 : j * 0.05;
          if (type === 'vortex') radius = Math.pow(j * 0.02, 1.5);
          if (type === 'infinite') radius = Math.sin(j * 0.05) * 5 + j * 0.02;
          
          radius *= scale;
          
          let y = type === 'galaxy' ? (Math.sin(j * 0.1) * 2) : j * 0.05 - 5;
          if (type === 'vortex') y = -j * 0.1;
          
          y *= scale;
          
          path.push(new Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius));
        }
        paths.push(path);
      }

      const ribbon = MeshBuilder.CreateRibbon(`spiral_${a}`, { pathArray: paths, sideOrientation: 2 }, this.scene);
      ribbon.material = material;
      this.currentMeshes.push(ribbon);
    }
  }

  private createTunnel() {
    const scale = this.currentConfig?.patternScale ?? 1.0;
    const material = new StandardMaterial("tunnelMat", this.scene);
    material.emissiveColor = this.parseColor(this.currentConfig?.patternColor1, new Color3(1.0, 0.3, 0.8));
    material.wireframe = true;
    material.alpha = 0.3;
    material.backFaceCulling = false;

    const cylinder = MeshBuilder.CreateCylinder("tunnel", { height: 100 * scale, diameter: 15 * scale, tessellation: 32, subdivisions: 50 }, this.scene);
    cylinder.rotation.x = Math.PI / 2;
    cylinder.material = material;
    this.currentMeshes.push(cylinder);
  }

  private createRings() {
    const type = this.currentConfig?.patternType || 'default';
    const complexity = this.currentConfig?.patternComplexity ?? 1;
    const scale = this.currentConfig?.patternScale ?? 1.0;
    
    const material = new StandardMaterial("ringsMat", this.scene);
    material.emissiveColor = this.parseColor(this.currentConfig?.patternColor1, new Color3(0.5, 1.0, 0.5));
    material.wireframe = true;
    material.alpha = 0.6;
    
    const baseTorus = MeshBuilder.CreateTorus("base", { diameter: 2 * scale, thickness: 0.1 * scale, tessellation: 32 }, this.scene);
    baseTorus.material = material;
    this.currentMeshes.push(baseTorus);

    const count = Math.floor(100 * complexity);

    for (let i = 0; i < count; i++) {
      const instance = baseTorus.createInstance("i" + i);
      
      if (type === 'sphere') {
        const phi = Math.acos(-1 + (2 * i) / count);
        const theta = Math.sqrt(count * Math.PI) * phi;
        const r = 8 * scale;
        instance.position = new Vector3(r * Math.cos(theta) * Math.sin(phi), r * Math.sin(theta) * Math.sin(phi), r * Math.cos(phi));
        instance.scaling = new Vector3(0.5, 0.5, 0.5);
        instance.lookAt(Vector3.Zero());
      } else if (type === 'cylinder') {
        const angle = i * 0.5;
        const radius = 5 * scale;
        instance.position = new Vector3(Math.cos(angle) * radius, (i - count/2) * 0.2 * scale, Math.sin(angle) * radius);
        instance.scaling = new Vector3(1, 1, 1);
        instance.rotation.x = Math.PI / 2;
      } else if (type === 'sacred_geometry') {
        const angle = i * Math.PI * 2 / count;
        const radius = 6 * scale;
        instance.position = new Vector3(Math.cos(angle) * radius, Math.sin(angle * 3) * 2 * scale, Math.sin(angle) * radius);
        instance.rotation.x = angle;
        instance.rotation.y = angle * 2;
      } else {
        // default golden ratio
        const angle = i * Math.PI * 2 * 0.618033;
        const radius = Math.sqrt(i) * 0.4 * scale;
        instance.position = new Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, Math.sin(i * 0.05) * 5 * scale);
        instance.scaling = new Vector3(1 - i*0.005, 1 - i*0.005, 1 - i*0.005);
      }
      this.currentMeshes.push(instance);
    }
  }

  private createParticles() {
    const scale = this.currentConfig?.patternScale ?? 1.0;
    const complexity = this.currentConfig?.patternComplexity ?? 1;
    
    this.particleSystem = new ParticleSystem("particles", Math.floor(2000 * complexity), this.scene);
    this.particleSystem.particleTexture = new Texture("https://raw.githubusercontent.com/PatrickRyanMS/BabylonJStextures/master/ParticleSystems/Sun/T_Sunflare.png", this.scene);
    this.particleSystem.emitter = Vector3.Zero();
    this.particleSystem.minEmitBox = new Vector3(-5 * scale, -5 * scale, -5 * scale);
    this.particleSystem.maxEmitBox = new Vector3(5 * scale, 5 * scale, 5 * scale);
    this.particleSystem.color1 = this.parseColor(this.currentConfig?.patternColor1, new Color3(0.7, 0.8, 1.0)).toColor4(1);
    this.particleSystem.color2 = this.parseColor(this.currentConfig?.patternColor2, new Color3(0.2, 0.5, 1.0)).toColor4(1);
    this.particleSystem.colorDead = new Color3(0, 0, 0.2).toColor4(0);
    this.particleSystem.minSize = 0.1 * scale;
    this.particleSystem.maxSize = 0.5 * scale;
    this.particleSystem.minLifeTime = 1;
    this.particleSystem.maxLifeTime = 3;
    this.particleSystem.emitRate = Math.floor(500 * complexity);
    this.particleSystem.blendMode = ParticleSystem.BLENDMODE_ONEONE;
    this.particleSystem.gravity = new Vector3(0, 0, 0);
    this.particleSystem.direction1 = new Vector3(-1, -1, -1);
    this.particleSystem.direction2 = new Vector3(1, 1, 1);
    this.particleSystem.minAngularSpeed = 0;
    this.particleSystem.maxAngularSpeed = Math.PI;
    this.particleSystem.minEmitPower = 1;
    this.particleSystem.maxEmitPower = 3;
    this.particleSystem.updateSpeed = 0.005;
    this.particleSystem.start();
  }

  private createMandala() {
    const scale = this.currentConfig?.patternScale ?? 1.0;
    const complexity = this.currentConfig?.patternComplexity ?? 1;
    const type = this.currentConfig?.patternType || 'default';
    
    const material = new StandardMaterial("mandalaMat", this.scene);
    material.emissiveColor = this.parseColor(this.currentConfig?.patternColor1, new Color3(1.0, 0.5, 0.2));
    material.wireframe = true;
    material.alpha = 0.7;

    const layers = Math.floor(5 * complexity);
    const pointsPerLayer = type === 'hypnotic' ? 16 : 8;

    for (let l = 1; l <= layers; l++) {
      const radius = l * 2 * scale;
      const path = [];
      for (let i = 0; i <= pointsPerLayer; i++) {
        const angle = (i / pointsPerLayer) * Math.PI * 2;
        // Add some star-like variation
        const r = i % 2 === 0 ? radius : radius * 0.5;
        path.push(new Vector3(Math.cos(angle) * r, Math.sin(angle) * r, 0));
      }
      
      const lines = MeshBuilder.CreateLines(`mandala_${l}`, { points: path }, this.scene);
      lines.color = material.emissiveColor;
      this.currentMeshes.push(lines);
      
      // Add a rotating torus for each layer
      if (type === 'breathing') {
        const torus = MeshBuilder.CreateTorus(`mandala_t_${l}`, { diameter: radius * 2, thickness: 0.05, tessellation: 32 }, this.scene);
        torus.material = material;
        torus.rotation.x = Math.PI / 2;
        this.currentMeshes.push(torus);
      }
    }
  }

  private createKaleidoscope() {
    const scale = this.currentConfig?.patternScale ?? 1.0;
    const complexity = this.currentConfig?.patternComplexity ?? 1;
    
    const material = new StandardMaterial("kaleidoMat", this.scene);
    material.emissiveColor = this.parseColor(this.currentConfig?.patternColor1, new Color3(0.8, 0.2, 1.0));
    material.wireframe = true;
    material.alpha = 0.6;

    const segments = Math.floor(8 * complexity);
    const baseShape = MeshBuilder.CreateCylinder("baseShape", { diameterTop: 0, diameterBottom: 4 * scale, height: 6 * scale, tessellation: 3 }, this.scene);
    baseShape.material = material;
    baseShape.rotation.x = Math.PI / 2;
    this.currentMeshes.push(baseShape);

    for (let i = 1; i < segments; i++) {
      const instance = baseShape.createInstance("k_" + i);
      instance.rotation.z = (i / segments) * Math.PI * 2;
      instance.position.x = Math.cos(instance.rotation.z) * 2 * scale;
      instance.position.y = Math.sin(instance.rotation.z) * 2 * scale;
      this.currentMeshes.push(instance);
    }
  }

  private createWaves() {
    const scale = this.currentConfig?.patternScale ?? 1.0;
    const complexity = this.currentConfig?.patternComplexity ?? 1;
    
    const material = new StandardMaterial("wavesMat", this.scene);
    material.emissiveColor = this.parseColor(this.currentConfig?.patternColor1, new Color3(0.2, 0.5, 1.0));
    material.wireframe = true;
    material.alpha = 0.5;

    const size = 20 * scale;
    const subdivisions = Math.floor(40 * complexity);
    
    const ground = MeshBuilder.CreateGround("waves", { width: size, height: size, subdivisions }, this.scene);
    ground.material = material;
    
    // Store original positions for animation
    ground.updateFacetData();
    this.currentMeshes.push(ground);
  }

  private createPulse() {
    const scale = this.currentConfig?.patternScale ?? 1.0;
    const complexity = this.currentConfig?.patternComplexity ?? 1;
    
    const material = new StandardMaterial("pulseMat", this.scene);
    material.emissiveColor = this.parseColor(this.currentConfig?.patternColor1, new Color3(1.0, 0.2, 0.2));
    material.wireframe = true;
    material.alpha = 0.8;

    const count = Math.floor(5 * complexity);
    for (let i = 0; i < count; i++) {
      const sphere = MeshBuilder.CreateSphere(`pulse_${i}`, { diameter: (i + 1) * 2 * scale, segments: 32 }, this.scene);
      sphere.material = material;
      this.currentMeshes.push(sphere);
    }
  }

  private updateCamera() {
    if (!this.currentConfig) return;

    const speed = this.currentConfig.cameraSpeed ?? 1.0;

    switch (this.currentConfig.camera) {
      case 'orbit':
        this.camera.alpha += 0.01 * speed;
        break;
      case 'fly':
        this.camera.target.z += 0.05 * speed;
        this.camera.alpha = -Math.PI / 2; // Lock to point straight
        this.camera.beta = Math.PI / 2;   // Lock to point straight
        break;
      case 'pan':
        this.camera.target.x = Math.sin(this.time * 0.2 * speed) * 2;
        this.camera.target.y = Math.cos(this.time * 0.15 * speed) * 1.5;
        break;
      case 'static':
      default:
        break;
    }
  }

  private updatePattern() {
    if (!this.currentConfig) return;

    const animSpeed = this.currentConfig.patternSpeed ?? 1.0;
    const type = this.currentConfig.patternType || 'default';

    if (this.currentConfig.pattern === 'spiral' && this.currentMeshes.length > 0) {
      this.currentMeshes.forEach((m, i) => {
        m.rotation.y += 0.01 * animSpeed;
        if (type === 'breathing') {
          const scale = 1 + Math.sin(this.time * 2 * animSpeed) * 0.2;
          m.scaling = new Vector3(scale, scale, scale);
        } else {
          m.rotation.x = Math.sin(this.time * 0.5 * animSpeed) * 0.2;
        }
      });
    } else if (this.currentConfig.pattern === 'tunnel' && this.currentMeshes.length > 0) {
      this.currentMeshes[0].rotation.y += 0.002 * animSpeed;
      if (this.currentConfig.camera === 'fly') {
        this.currentMeshes[0].position.z = Math.floor(this.camera.target.z / 2) * 2;
      } else {
        this.currentMeshes[0].position.z = 0;
      }
    } else if (this.currentConfig.pattern === 'rings' || this.currentConfig.pattern === 'fractal') {
      this.currentMeshes.forEach((m, i) => {
        if (i > 0) { // Skip base mesh
          m.rotation.x += 0.01 * (i % 3 + 1) * animSpeed;
          m.rotation.y += 0.02 * (i % 2 + 1) * animSpeed;
          m.rotation.z += 0.015 * animSpeed;
        }
      });
    } else if (this.currentConfig.pattern === 'mandala') {
      this.currentMeshes.forEach((m, i) => {
        m.rotation.z += (i % 2 === 0 ? 0.01 : -0.01) * animSpeed;
        if (type === 'breathing') {
          const scale = 1 + Math.sin(this.time * animSpeed + i) * 0.1;
          m.scaling = new Vector3(scale, scale, scale);
        }
      });
    } else if (this.currentConfig.pattern === 'kaleidoscope') {
      this.currentMeshes.forEach((m, i) => {
        m.rotation.x += 0.02 * animSpeed;
        m.rotation.y += 0.01 * animSpeed;
      });
    } else if (this.currentConfig.pattern === 'waves' && this.currentMeshes.length > 0) {
      const ground = this.currentMeshes[0];
      const positions = ground.getVerticesData(VertexBuffer.PositionKind);
      if (positions) {
        for (let i = 0; i < positions.length; i += 3) {
          const x = positions[i];
          const z = positions[i + 2];
          positions[i + 1] = Math.sin(x * 0.5 + this.time * 2 * animSpeed) * Math.cos(z * 0.5 + this.time * 2 * animSpeed);
        }
        ground.updateVerticesData(VertexBuffer.PositionKind, positions);
      }
    } else if (this.currentConfig.pattern === 'pulse') {
      this.currentMeshes.forEach((m, i) => {
        const scale = 1 + Math.sin(this.time * 3 * animSpeed - i) * 0.2;
        m.scaling = new Vector3(scale, scale, scale);
      });
    }
  }

  private updateTextAnimation() {
    const config = this.currentConfig;
    const time = this.time;

    if (this.textBlock && this.textPlane) {
      // If not parented to camera, make it face the camera
      if (!this.textPlane.parent) {
        this.textPlane.lookAt(this.camera.position);
        this.textPlane.rotate(Vector3.Up(), Math.PI); // Flip to face correctly
      }

      // Text color
      this.textBlock.color = config?.textColor ?? "#ffffff";

      // Outline animation
      const outlineType = config?.textOutlineType ?? 'none';
      if (outlineType === 'rainbow') {
        const hue = Math.floor((time * 50) % 360);
        this.textBlock.outlineColor = `hsl(${hue}, 100%, 50%)`;
        this.textBlock.outlineWidth = 8;
      } else if (outlineType === 'solid') {
        this.textBlock.outlineColor = config?.textOutlineColor ?? '#000000';
        this.textBlock.outlineWidth = 8;
      } else {
        this.textBlock.outlineWidth = 0;
      }

      // Advanced animations
      const animType = config?.textAnimType ?? 'none';
      const animSpeed = config?.textAnimSpeed ?? 1.0;
      const animIntensity = config?.textAnimIntensity ?? 1.0;

      // Reset defaults
      this.textBlock.alpha = 1.0;
      this.textBlock.rotation = 0;
      this.textBlock.scaleX = 1.0;
      this.textBlock.scaleY = 1.0;
      
      const dist = config?.textDistance ?? 10;
      const baseScale = dist / 5;
      this.textPlane.scaling = new Vector3(baseScale, baseScale, baseScale);
      this.textPlane.position.y = 0;

      if (animType === 'zoom') {
        const s = 1.0 + Math.sin(time * 2 * animSpeed) * 0.2 * animIntensity;
        this.textPlane.scaling.scaleInPlace(s);
      } else if (animType === 'fade') {
        this.textBlock.alpha = 0.5 + Math.sin(time * 3 * animSpeed) * 0.5 * animIntensity;
      } else if (animType === 'float') {
        this.textPlane.position.y = Math.sin(time * 2 * animSpeed) * 0.5 * animIntensity;
      } else if (animType === 'warp') {
        this.textBlock.rotation = Math.sin(time * animSpeed) * 0.1 * animIntensity;
        this.textBlock.scaleX = 1.0 + Math.sin(time * 4 * animSpeed) * 0.1 * animIntensity;
        this.textBlock.scaleY = 1.0 + Math.cos(time * 4 * animSpeed) * 0.1 * animIntensity;
      } else if (animType === 'prism') {
        this.textBlock.shadowOffsetX = Math.sin(time * 5 * animSpeed) * 10 * animIntensity;
        this.textBlock.shadowOffsetY = Math.cos(time * 5 * animSpeed) * 10 * animIntensity;
        this.textBlock.shadowBlur = 15;
        this.textBlock.shadowColor = `hsla(${(time * 100) % 360}, 100%, 50%, 0.5)`;
      } else if (animType === 'glitch') {
        if (Math.random() > 0.9 - (0.1 * animIntensity)) {
          this.textPlane.position.x = (Math.random() - 0.5) * 0.5 * animIntensity;
          this.textPlane.position.y = (Math.random() - 0.5) * 0.5 * animIntensity;
          this.textBlock.alpha = Math.random();
          this.textBlock.color = Math.random() > 0.5 ? "cyan" : "magenta";
        } else {
          this.textPlane.position.x = 0;
          this.textPlane.position.y = 0;
          this.textBlock.alpha = 1.0;
          this.textBlock.color = "white";
        }
      }
    }

    if (this.auxTextBlock && this.auxTextPlane && this.auxTextPlane.isVisible) {
      // Aux Text color
      this.auxTextBlock.color = config?.auxColor ?? "#ffffff";

      // Outline animation
      const outlineType = config?.auxOutlineType ?? 'none';
      if (outlineType === 'rainbow') {
        const hue = Math.floor((time * 50) % 360);
        this.auxTextBlock.outlineColor = `hsl(${hue}, 100%, 50%)`;
        this.auxTextBlock.outlineWidth = 8;
      } else if (outlineType === 'solid') {
        this.auxTextBlock.outlineColor = config?.auxOutlineColor ?? '#000000';
        this.auxTextBlock.outlineWidth = 8;
      } else {
        this.auxTextBlock.outlineWidth = 0;
      }

      // Advanced animations
      const animType = config?.auxAnimType ?? 'none';
      const animSpeed = config?.auxAnimSpeed ?? 1.0;
      const animIntensity = config?.auxAnimIntensity ?? 1.0;

      // Reset defaults
      this.auxTextBlock.alpha = 1.0;
      this.auxTextBlock.rotation = 0;
      this.auxTextBlock.scaleX = 1.0;
      this.auxTextBlock.scaleY = 1.0;
      
      const dist = config?.auxDistance ?? 10;
      const baseScale = dist / 5;
      this.auxTextPlane.scaling = new Vector3(baseScale, baseScale, baseScale);
      // Offset aux text slightly below main text by default if not animated
      this.auxTextPlane.position.y = -2;

      if (animType === 'zoom') {
        const s = 1.0 + Math.sin(time * 2 * animSpeed) * 0.2 * animIntensity;
        this.auxTextPlane.scaling.scaleInPlace(s);
      } else if (animType === 'fade') {
        this.auxTextBlock.alpha = 0.5 + Math.sin(time * 3 * animSpeed) * 0.5 * animIntensity;
      } else if (animType === 'float') {
        this.auxTextPlane.position.y = -2 + Math.sin(time * 2 * animSpeed) * 0.5 * animIntensity;
      } else if (animType === 'warp') {
        this.auxTextBlock.rotation = Math.sin(time * animSpeed) * 0.1 * animIntensity;
        this.auxTextBlock.scaleX = 1.0 + Math.sin(time * 4 * animSpeed) * 0.1 * animIntensity;
        this.auxTextBlock.scaleY = 1.0 + Math.cos(time * 4 * animSpeed) * 0.1 * animIntensity;
      } else if (animType === 'prism') {
        this.auxTextBlock.shadowOffsetX = Math.sin(time * 5 * animSpeed) * 10 * animIntensity;
        this.auxTextBlock.shadowOffsetY = Math.cos(time * 5 * animSpeed) * 10 * animIntensity;
        this.auxTextBlock.shadowBlur = 15;
        this.auxTextBlock.shadowColor = `hsla(${(time * 100) % 360}, 100%, 50%, 0.5)`;
      } else if (animType === 'glitch') {
        if (Math.random() > 0.9 - (0.1 * animIntensity)) {
          this.auxTextPlane.position.x = (Math.random() - 0.5) * 0.5 * animIntensity;
          this.auxTextPlane.position.y = -2 + (Math.random() - 0.5) * 0.5 * animIntensity;
          this.auxTextBlock.alpha = Math.random();
          this.auxTextBlock.color = Math.random() > 0.5 ? "cyan" : "magenta";
        } else {
          this.auxTextPlane.position.x = 0;
          this.auxTextPlane.position.y = -2;
          this.auxTextBlock.alpha = 1.0;
          this.auxTextBlock.color = "white";
        }
      }
    }

    if (this.wordListMainBlock) this.wordListMainBlock.isVisible = false;
    if (this.wordListAuxBlock) this.wordListAuxBlock.isVisible = false;

    if (this.currentWordList) {
      const wl = this.currentWordList;
      const wordIndex = Math.floor(time / wl.interval);
      
      if (wordIndex < wl.words.length) {
        const activeBlock = wl.layer === 'aux' ? this.wordListAuxBlock : this.wordListMainBlock;
        if (activeBlock) {
          activeBlock.text = wl.words[wordIndex];
          activeBlock.isVisible = true;
          
          // Handle pattern
          if (wl.pattern === 'scatter') {
            // Use wordIndex to seed a pseudo-random position so it stays still for the duration of the word
            const seed = wordIndex * 123.456;
            const rx = (Math.sin(seed) - 0.5) * 500; // pixels instead of units
            const ry = (Math.cos(seed * 1.5) - 0.5) * 500;
            activeBlock.leftInPixels = rx;
            activeBlock.topInPixels = ry;
          } else if (wl.pattern === 'center') {
            activeBlock.leftInPixels = 0;
            activeBlock.topInPixels = 0;
          } else if (wl.pattern === 'random') {
            // Jitter every frame
            activeBlock.leftInPixels = (Math.random() - 0.5) * 500;
            activeBlock.topInPixels = (Math.random() - 0.5) * 500;
          } else {
            activeBlock.leftInPixels = 0;
            activeBlock.topInPixels = 0;
          }
        }
      }
    }
  }

  public updateXRProgress(elapsed: number, duration: number) {
    if (this.xrProgressText) {
      this.xrProgressText.text = `${elapsed}s / ${duration}s`;
    }
  }

  public dispose() {
    this.engine.dispose();
  }
}
