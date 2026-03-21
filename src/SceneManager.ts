import { Engine, Scene, Vector3, HemisphericLight, ArcRotateCamera, MeshBuilder, Mesh, StandardMaterial, Color3, Texture, DynamicTexture, WebXRDefaultExperience, WebXRState, SceneLoader, TransformNode, ParticleSystem, ShaderMaterial, Effect, VertexBuffer, VideoTexture, WebXRSessionManager, SixDofDragBehavior, NoiseProceduralTexture } from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import { SegmentConfig, MediaItem } from './timelineParser';
import { parseMarkdownText } from './markdownRenderer';
import { createControlForLine, createControlsForWords } from './textRenderer';

/**
 * SceneManager
 * 
 * Responsible for managing the Babylon.js 3D engine, scene creation, 
 * WebXR integration, and real-time visual updates based on timeline configurations.
 */
export class SceneManager {
  // --- Core Babylon.js Components ---
  private engine: Engine;
  private scene: Scene;
  private camera: ArcRotateCamera;
  
  // --- WebXR Components ---
  private xr: WebXRDefaultExperience | null = null;
  private xrUIPanel: Mesh | null = null;
  private xrUITexture: GUI.AdvancedDynamicTexture | null = null;
  private xrSegmentText: GUI.TextBlock | null = null;
  private xrProgressText: GUI.TextBlock | null = null;
  
  // --- Public Callbacks (for UI integration) ---
  public onPlayPause?: () => void;
  public onNext?: () => void;
  public onPrev?: () => void;
  public onToggleMode?: () => void;
  public onVolumeUp?: () => void;
  public onVolumeDown?: () => void;

  // --- Internal State ---
  private currentMeshes: any[] = [];
  private patternRoot: Mesh | null = null;
  private textPlane: any = null;
  private textTexture: GUI.AdvancedDynamicTexture | null = null;
  private textBackground: GUI.Rectangle | null = null;
  private textControls: GUI.Control[] = [];
  private auxTextPlane: any = null;
  private auxTextTexture: GUI.AdvancedDynamicTexture | null = null;
  private auxTextBackground: GUI.Rectangle | null = null;
  private auxTextControls: GUI.Control[] = [];
  private mediaControls: GUI.Image[] = [];
  private mediaMeshes: any[] = [];
  private wordListCache: Record<string, string[]> = {};
  private time: number = 0;
  private segmentDuration: number = 0;
  private currentConfig: SegmentConfig | null = null;
  private particleSystem: ParticleSystem | null = null;
  private baseEmitRate: number = 0;

  public getScene(): Scene {
    return this.scene;
  }

  private resizeHandler = () => {
    this.engine.resize();
  };

  /**
   * Constructor
   * Initializes the engine, scene, camera, and starts the render loop.
   */
  constructor(canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: false });
    this.scene = new Scene(this.engine);
    this.scene.skipPointerMovePicking = true; // Optimization: don't pick on pointer move unless needed
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

    // Main Render Loop
    this.engine.runRenderLoop(() => {
      this.time += this.engine.getDeltaTime() * 0.001;
      
      // Pause videos if segment duration is exceeded
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

    window.addEventListener("resize", this.resizeHandler);
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

    // Create a floating UI panel
    const panel = MeshBuilder.CreatePlane("xrUI", { width: 5, height: 4 }, this.scene);
    
    // Create a repositioning handle
    const handle = MeshBuilder.CreateBox("xrUIHandle", { width: 5, height: 0.2, depth: 0.2 }, this.scene);
    const handleMat = new StandardMaterial("handleMat", this.scene);
    handleMat.diffuseColor = new Color3(0.3, 0.3, 0.3);
    handleMat.emissiveColor = new Color3(0.1, 0.1, 0.1);
    handle.material = handleMat;
    
    // Position panel relative to handle
    panel.parent = handle;
    panel.position.y = 2.1;
    
    // Add drag behavior to the handle, and disable dragging on its children (the panel)
    const dragBehavior = new SixDofDragBehavior();
    dragBehavior.draggableMeshes = [];
    handle.addBehavior(dragBehavior);
    
    // Position the handle on the floor facing upwards
    const camera = this.xr.baseExperience.camera;
    const forward = camera.getForwardRay().direction;
    forward.y = 0;
    if (forward.lengthSquared() === 0) {
        forward.z = 1;
    }
    forward.normalize();
    
    // Spawn on the floor (y = 0.1 to avoid z-fighting), 2 units in front
    handle.position = new Vector3(camera.position.x + forward.x * 2, 0.1, camera.position.z + forward.z * 2);
    
    // Face upwards
    handle.rotation.y = Math.atan2(forward.x, forward.z);
    handle.rotation.x = -Math.PI / 2;
    
    this.xrUIPanel = handle;

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
  }

  private async fetchWordList(url: string) {
    if (this.wordListCache[url]) return this.wordListCache[url];
    try {
      const response = await fetch(url);
      const text = await response.text();
      // Simple CSV parsing: split by comma or newline
      const words = text.split(/[,\n\r]+/).map(w => w.trim()).filter(w => w.length > 0);
      this.wordListCache[url] = words;
      return words;
    } catch (e) {
      console.error("Failed to fetch wordlist:", e);
      return [];
    }
  }

  private triggerWordListFetches(controls: GUI.Control[]) {
    const traverse = (c: GUI.Control) => {
      const wlConfig = (c as any).wordListConfig;
      if (wlConfig && wlConfig.url) {
        this.fetchWordList(wlConfig.url).then(words => {
          if (words.length > 0) {
            wlConfig.words = words;
            // Force update if it's currently displaying
            (c as any).wordListPeriod = -1; 
          }
        });
      }
      if (c instanceof GUI.Container) {
        c.children.forEach(traverse);
      }
    };
    controls.forEach(traverse);
  }

  public updateText(text: string, auxText?: string) {
    if (!this.textBackground || !this.auxTextBackground) return;

    // Clear old text controls
    this.textControls.forEach(c => c.dispose());
    this.textControls = [];
    this.auxTextControls.forEach(c => c.dispose());
    this.auxTextControls = [];

    const config = this.currentConfig;
    const baseSize = config?.textSize ?? 100;
    const auxBaseSize = config?.auxSize ?? 100;
    const textColor = config?.textColor ?? "#ffffff";
    const auxColor = config?.auxColor ?? "#ffffff";
    const textFont = config?.textFont ?? 'sans-serif';
    const auxFont = config?.auxFont ?? 'sans-serif';
    
    const textDisplayPattern = config?.textDisplayPattern ?? 'center';
    const auxDisplayPattern = config?.auxDisplayPattern ?? 'center';

    if (text) {
      const lines = parseMarkdownText(text);
      if (textDisplayPattern === 'center') {
        const stack = new GUI.StackPanel();
        stack.isVertical = true;
        stack.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        stack.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
        this.textBackground.addControl(stack);
        this.textControls.push(stack);

        for (const line of lines) {
          const lineControl = createControlForLine(line, textColor, textFont, baseSize);
          stack.addControl(lineControl);
        }
      } else {
        // scatter, random, spiral, march
        for (const line of lines) {
          const words = createControlsForWords(line, textColor, textFont, baseSize);
          for (const word of words) {
            this.textBackground.addControl(word);
            this.textControls.push(word);
          }
        }
      }
    }

    if (auxText) {
      this.auxTextPlane.isVisible = true;
      const lines = parseMarkdownText(auxText);
      if (auxDisplayPattern === 'center') {
        const stack = new GUI.StackPanel();
        stack.isVertical = true;
        stack.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        stack.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
        this.auxTextBackground.addControl(stack);
        this.auxTextControls.push(stack);

        for (const line of lines) {
          const lineControl = createControlForLine(line, auxColor, auxFont, auxBaseSize);
          stack.addControl(lineControl);
        }
      } else {
        // scatter, random, spiral, march
        for (const line of lines) {
          const words = createControlsForWords(line, auxColor, auxFont, auxBaseSize);
          for (const word of words) {
            this.auxTextBackground.addControl(word);
            this.auxTextControls.push(word);
          }
        }
      }
    } else {
      this.auxTextPlane.isVisible = false;
    }

    // Trigger wordlist fetches
    this.triggerWordListFetches([...this.textControls, ...this.auxTextControls]);
  }

  public updateMedia(media: MediaItem[]) {
    if (!this.textBackground || !this.auxTextBackground) return;
    // Clear old media
    this.mediaControls.forEach(c => c.dispose());
    this.mediaControls = [];
    this.mediaMeshes.forEach(m => {
      if (m.material) {
        const mat = m.material as StandardMaterial;
        if (mat.diffuseTexture) {
          mat.diffuseTexture.dispose();
        }
        mat.dispose();
      }
      m.dispose();
    });
    this.mediaMeshes = [];

    const hasAuxMedia = media.some(m => m.layer === 'aux');
    if (hasAuxMedia && this.auxTextPlane) {
      this.auxTextPlane.isVisible = true;
    }

    const packMedia = (items: MediaItem[], layer: 'main' | 'aux') => {
      const N = items.length;
      if (N === 0) return;

      const cols = Math.ceil(Math.sqrt(N));
      const rows = Math.ceil(N / cols);

      let localW = 0;
      let localH = 0;

      if (layer === 'aux') {
        const dist = Math.max(0.1, this.currentConfig?.auxDistance ?? 10);
        const fov = this.camera.fov;
        const aspectRatio = this.engine.getAspectRatio(this.camera);
        const visibleHeight = 2 * dist * Math.tan(fov / 2);
        const visibleWidth = visibleHeight * aspectRatio;
        // The auxTextPlane is scaled by dist / 5, so we divide by that to get local size
        localW = visibleWidth / (dist / 5);
        localH = visibleHeight / (dist / 5);
      } else {
        const dist = Math.max(0.1, this.currentConfig?.textDistance ?? 10);
        // Fit inside pattern: say 15x10 world size
        localW = 15 / (dist / 5);
        localH = 10 / (dist / 5);
      }

      const cellW = localW / cols;
      const cellH = localH / rows;

      items.forEach((m, i) => {
        const c = i % cols;
        const r = Math.floor(i / cols);

        // Create plane with 1x1 size, we will scale it
        const plane = MeshBuilder.CreatePlane(`media_${layer}_${i}`, { width: 1, height: 1, sideOrientation: Mesh.DOUBLESIDE }, this.scene);
        plane.parent = layer === 'aux' ? this.auxTextPlane : this.textPlane;
        
        // Position slightly behind the text plane (Z is local forward, so negative is behind)
        const x = -localW / 2 + cellW / 2 + c * cellW;
        const y = localH / 2 - cellH / 2 - r * cellH;
        plane.position = new Vector3(x, y, -0.01 - i * 0.01);

        const mat = new StandardMaterial(`mediaMat_${layer}_${i}`, this.scene);
        mat.emissiveColor = Color3.White();
        mat.disableLighting = true;
        mat.alpha = m.opacity;

        const applyScaling = (texW: number, texH: number) => {
          if (texW === 0 || texH === 0) return;
          const aspect = texW / texH;
          const cellAspect = cellW / cellH;
          let w, h;
          if (aspect > cellAspect) {
            w = cellW;
            h = cellW / aspect;
          } else {
            h = cellH;
            w = cellH * aspect;
          }
          // Add a small margin (e.g., 95% of cell size)
          plane.scaling = new Vector3(w * 0.95, h * 0.95, 1);
        };

        // Default scaling before load
        plane.scaling = new Vector3(cellW * 0.95, cellH * 0.95, 1);

        if (m.type === 'video') {
          const videoTexture = new VideoTexture(`videoTex_${layer}_${i}`, m.url, this.scene, false, false, VideoTexture.TRILINEAR_SAMPLINGMODE, {
            autoPlay: true,
            autoUpdateTexture: true,
            loop: true,
            muted: m.volume === 0
          });
          if (videoTexture.video) {
            videoTexture.video.crossOrigin = "anonymous";
            videoTexture.video.onloadedmetadata = () => {
              applyScaling(videoTexture.video.videoWidth, videoTexture.video.videoHeight);
            };
            const playVideo = () => {
              if (videoTexture.video) {
                videoTexture.video.play().catch(e => {
                  console.warn("Video autoplay blocked, retrying muted:", e);
                  videoTexture.video.muted = true;
                  videoTexture.video.play().catch(err => console.error("Video failed to play even when muted:", err));
                });
              }
            };
            playVideo();
            setTimeout(playVideo, 100);
            videoTexture.video.volume = m.volume !== undefined ? m.volume : 1;
          }
          mat.diffuseTexture = videoTexture;
        } else {
          const texture = new Texture(m.url, this.scene);
          texture.hasAlpha = true;
          texture.onLoadObservable.add(() => {
            const size = texture.getSize();
            applyScaling(size.width, size.height);
          });
          mat.diffuseTexture = texture;
          mat.useAlphaFromDiffuseTexture = true;
        }

        plane.material = mat;
        this.mediaMeshes.push(plane);
      });
    };

    const mainMedia = media.filter(m => m.layer !== 'aux');
    const auxMedia = media.filter(m => m.layer === 'aux');

    packMedia(mainMedia, 'main');
    packMedia(auxMedia, 'aux');
  }

  /**
   * applyConfig
   * Updates the scene visuals based on the provided segment configuration.
   * Handles pattern switching, camera adjustments, and text positioning.
   */
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
      this.patternRoot = new Mesh("patternRoot", this.scene);
      switch (config.patternType) {
        case 'fascinator':
        case 'default':
        case 'hypnotic':
        case 'double':
        case 'sacred_geometry':
          this.createFascinator(config.pattern || 'dot', this.patternRoot as Mesh);
          break;
        case 'repetition':
        case 'cylinder':
        case 'infinite':
          this.createRepetition();
          break;
        case 'cloud':
        case 'breathing':
          if (config.pattern === 'bubbles') this.createBubbles();
          else if (config.pattern === 'nebula') this.createNebula();
          else if (config.pattern === 'smoke') this.createSmoke();
          else if (config.pattern === 'fluid') this.createFluid();
          else if (config.pattern === 'swarm') this.createSwarm();
          else if (config.pattern === 'constellation') this.createConstellation();
          else this.createParticles();
          break;
        case 'cluster':
          this.createCluster();
          break;
        case 'topology':
        case 'sphere':
        case 'galaxy':
          if (config.pattern === 'pulse') this.createPulse();
          else if (config.pattern === 'tunnel') this.createTunnel();
          else if (config.pattern === 'wave' || config.pattern === 'waves') this.createWaves();
          else if (config.pattern === 'nautilus spiral') this.createSpiral();
          else if (config.pattern === 'orb') this.createRings();
          else if (config.pattern === 'saddle') this.createWaves();
          else if (config.pattern === 'plane') this.createWaves();
          else if (config.pattern === 'random voxel surface') this.createWaves();
          else if (config.pattern === 'random curved surface') this.createWaves();
          else if (config.pattern === 'galaxy') this.createSpiral();
          else this.createWaves();
          break;
        default:
          this.createSpiral();
          break;
      }
      
      this.currentMeshes.forEach(m => {
        if (!m.parent) {
          m.parent = this.patternRoot;
        }
      });
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
    this.currentMeshes.forEach(m => {
      if (m.material) {
        m.material.dispose();
      }
      m.dispose();
    });
    this.currentMeshes = [];
    if (this.particleSystem) {
      this.particleSystem.dispose();
      this.particleSystem = null;
    }
    if (this.patternRoot) {
      this.patternRoot.dispose();
      this.patternRoot = null;
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
    const type = this.currentConfig?.patternType || 'fascinator';
    const pattern = this.currentConfig?.pattern || 'flat spiral';
    const complexity = this.currentConfig?.patternComplexity ?? 1;
    const scale = this.currentConfig?.patternScale ?? 1.0;
    
    const material = new StandardMaterial("spiralMat", this.scene);
    material.emissiveColor = this.parseColor(this.currentConfig?.patternColor1, new Color3(0.2, 0.8, 1.0));
    material.wireframe = true;
    material.alpha = 0.5;

    let arms = pattern === 'galaxy' || type === 'galaxy' ? 5 : (type === 'double' ? 2 : 1);
    if (pattern === 'vortex' || type === 'vortex') arms = 8;
    if (pattern === 'helix') arms = 4;
    if (pattern === 'nautilus spiral' || type === 'infinite') arms = 3;
    
    arms = Math.max(1, Math.floor(arms * complexity));
    
    for (let a = 0; a < arms; a++) {
      const armOffset = (Math.PI * 2 / arms) * a;
      const paths = [];
      const numPaths = pattern === 'nautilus spiral' || type === 'infinite' ? 40 : 20;
      const pathLength = pattern === 'vortex' || type === 'vortex' || pattern === 'helix' ? 400 : 200;
      
      for (let i = 0; i < numPaths; i++) {
        const path = [];
        for (let j = 0; j < pathLength; j++) {
          const angle = j * 0.1 + (i * Math.PI * 2 / numPaths) + armOffset;
          let radius = pattern === 'galaxy' || type === 'galaxy' ? j * 0.05 : j * 0.05;
          if (pattern === 'vortex' || type === 'vortex') radius = Math.pow(j * 0.02, 1.5);
          if (pattern === 'helix') radius = 5 * scale;
          if (pattern === 'nautilus spiral' || type === 'infinite') radius = Math.sin(j * 0.05) * 5 + j * 0.02;
          
          radius *= scale;
          
          let y = pattern === 'galaxy' || type === 'galaxy' ? (Math.sin(j * 0.1) * 2) : j * 0.05 - 5;
          if (pattern === 'vortex' || type === 'vortex') y = -j * 0.1;
          if (pattern === 'helix') y = j * 0.1 - 20;
          
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
    const pattern = this.currentConfig?.pattern || 'ring';
    const complexity = this.currentConfig?.patternComplexity ?? 1;
    const scale = this.currentConfig?.patternScale ?? 1.0;
    
    const material = new StandardMaterial("ringsMat", this.scene);
    material.emissiveColor = this.parseColor(this.currentConfig?.patternColor1, new Color3(0.5, 1.0, 0.5));
    material.wireframe = true;
    material.alpha = 0.6;
    
    const baseTorus = MeshBuilder.CreateTorus("base", { diameter: 2 * scale, thickness: 0.1 * scale, tessellation: 32 }, this.scene);
    baseTorus.material = material;
    this.currentMeshes.push(baseTorus);

    // If it's a fascinator, just return the single ring
    if (type === 'fascinator') {
      return;
    }

    const count = Math.floor(100 * complexity);

    for (let i = 0; i < count; i++) {
      const instance = baseTorus.createInstance("i" + i);
      
      if (pattern === 'sphere' || type === 'sphere') {
        const phi = Math.acos(-1 + (2 * i) / count);
        const theta = Math.sqrt(count * Math.PI) * phi;
        const r = 8 * scale;
        instance.position = new Vector3(r * Math.cos(theta) * Math.sin(phi), r * Math.sin(theta) * Math.sin(phi), r * Math.cos(phi));
        instance.scaling = new Vector3(0.5, 0.5, 0.5);
        instance.lookAt(Vector3.Zero());
      } else if (pattern === 'grid') {
        const size = Math.ceil(Math.sqrt(count));
        const x = (i % size) - size / 2;
        const y = Math.floor(i / size) - size / 2;
        const spacing = 2 * scale;
        instance.position = new Vector3(x * spacing, y * spacing, 0);
        instance.rotation.x = Math.PI / 2;
      } else if (pattern === 'cube') {
        const size = Math.ceil(Math.pow(count, 1/3));
        const x = (i % size) - size / 2;
        const y = (Math.floor(i / size) % size) - size / 2;
        const z = Math.floor(i / (size * size)) - size / 2;
        const spacing = 3 * scale;
        instance.position = new Vector3(x * spacing, y * spacing, z * spacing);
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
    const speed = this.currentConfig?.patternSpeed ?? 1.0;
    
    this.particleSystem = new ParticleSystem("particles", Math.floor(2000 * complexity), this.scene);
    this.particleSystem.particleTexture = new Texture("https://raw.githubusercontent.com/PatrickRyanMS/BabylonJStextures/master/ParticleSystems/Sun/T_Sunflare.png", this.scene);
    this.particleSystem.emitter = this.patternRoot || Vector3.Zero();
    this.particleSystem.minEmitBox = new Vector3(-5 * scale, -5 * scale, -5 * scale);
    this.particleSystem.maxEmitBox = new Vector3(5 * scale, 5 * scale, 5 * scale);
    this.particleSystem.color1 = this.parseColor(this.currentConfig?.patternColor1, new Color3(0.7, 0.8, 1.0)).toColor4(1);
    this.particleSystem.color2 = this.parseColor(this.currentConfig?.patternColor2, new Color3(0.2, 0.5, 1.0)).toColor4(1);
    this.particleSystem.colorDead = new Color3(0, 0, 0.2).toColor4(0);
    this.particleSystem.minSize = 0.1 * scale;
    this.particleSystem.maxSize = 0.5 * scale;
    this.particleSystem.minLifeTime = 1;
    this.particleSystem.maxLifeTime = 3;
    this.baseEmitRate = Math.floor(500 * complexity);
    this.particleSystem.emitRate = this.baseEmitRate;
    this.particleSystem.blendMode = ParticleSystem.BLENDMODE_ONEONE;
    this.particleSystem.gravity = new Vector3(0, 0, 0);
    this.particleSystem.direction1 = new Vector3(-1, -1, -1);
    this.particleSystem.direction2 = new Vector3(1, 1, 1);
    this.particleSystem.minAngularSpeed = 0;
    this.particleSystem.maxAngularSpeed = Math.PI;
    this.particleSystem.minEmitPower = 1;
    this.particleSystem.maxEmitPower = 3;
    this.particleSystem.updateSpeed = 0.005 * speed;
    this.particleSystem.start();
  }

  private createRepetition() {
    const config = this.currentConfig;
    if (!config) return;

    const count = config.repetitionCount || 10;
    const basePattern = config.repetitionBasePattern || 'dot';
    const pattern = config.pattern || 'grid';
    const scale = config.patternScale ?? 1.0;

    for (let i = 0; i < count; i++) {
      const instanceRoot = new Mesh(`rep_${i}`, this.scene);
      instanceRoot.parent = this.patternRoot;
      
      // Position based on pattern
      if (pattern === 'grid') {
        const size = Math.ceil(Math.sqrt(count));
        const x = (i % size) - size / 2;
        const y = Math.floor(i / size) - size / 2;
        instanceRoot.position.set(x * 5 * scale, y * 5 * scale, 0);
      } else if (pattern === 'sphere') {
        const phi = Math.acos(-1 + (2 * i) / count);
        const theta = Math.sqrt(count * Math.PI) * phi;
        const r = 10 * scale;
        instanceRoot.position.set(r * Math.cos(theta) * Math.sin(phi), r * Math.sin(theta) * Math.sin(phi), r * Math.cos(phi));
      } else if (pattern === 'cube') {
        const size = Math.ceil(Math.pow(count, 1/3));
        const x = (i % size) - size / 2;
        const y = (Math.floor(i / size) % size) - size / 2;
        const z = Math.floor(i / (size * size)) - size / 2;
        instanceRoot.position.set(x * 6 * scale, y * 6 * scale, z * 6 * scale);
      } else if (pattern === 'march') {
        // Snake-like progression
        instanceRoot.position.set(0, 0, i * 5 * scale);
      } else if (pattern === 'helix') {
        const arms = 3; // Multi-armed spiral
        const arm = i % arms;
        const armOffset = (Math.PI * 2 / arms) * arm;
        const idxInArm = Math.floor(i / arms);
        const angle = idxInArm * 0.5 + armOffset;
        const radius = 5 * scale;
        instanceRoot.position.set(Math.cos(angle) * radius, idxInArm * 0.5 * scale, Math.sin(angle) * radius);
      } else if (pattern === 'polygon') {
        // Torus arrangement - more complex 3D shape
        const majorRadius = 10 * scale;
        const minorRadius = 4 * scale;
        const u = (i / count) * Math.PI * 2;
        const v = (i * 5 / count) * Math.PI * 2; // Twisted
        const x = (majorRadius + minorRadius * Math.cos(v)) * Math.cos(u);
        const y = (majorRadius + minorRadius * Math.cos(v)) * Math.sin(u);
        const z = minorRadius * Math.sin(v);
        instanceRoot.position.set(x, y, z);
      } else if (pattern === 'vortex') {
        const angle = i * 0.2;
        const radius = Math.pow(i * 0.2, 1.5) * scale;
        instanceRoot.position.set(Math.cos(angle) * radius, -i * 0.1 * scale, Math.sin(angle) * radius);
      } else if (pattern === 'spiral') {
        const angle = i * 0.5;
        const radius = i * 0.5 * scale;
        instanceRoot.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      }

      // Create the base fascinator at this instance
      this.createFascinator(basePattern, instanceRoot);
    }
  }

  private createFascinator(pattern: string, parent: Mesh) {
    const oldRoot = this.patternRoot;
    this.patternRoot = parent;
    
    const originalConfig = this.currentConfig;
    if (originalConfig) {
      this.currentConfig = { ...originalConfig, pattern: pattern, patternType: 'fascinator' };
    }
    
    if (pattern === 'fractal') this.createRings();
    else if (pattern === 'mandala') this.createMandala();
    else if (pattern === 'particle' || pattern === 'particles') this.createParticles();
    else if (pattern === 'flame') this.createParticles();
    else if (pattern === 'dot') this.createDot();
    else if (pattern === 'flat spiral' || pattern === 'spiral') this.createSpiral();
    else if (pattern === 'pendulum') this.createPulse();
    else if (pattern === 'wheel') this.createWheel();
    else if (pattern === 'dial') this.createDial();
    else if (pattern === 'clock') this.createClock();
    else if (pattern === 'torus') this.createTorus();
    else if (pattern === 'cone') this.createCone();
    else if (pattern === 'ring') this.createRings();
    else if (pattern === 'kaleido') this.createKaleidoscope();
    else this.createSpiral();
    
    this.currentConfig = originalConfig;
    this.patternRoot = oldRoot;
  }

  private createNebula() {
    const scale = this.currentConfig?.patternScale ?? 1.0;
    const complexity = this.currentConfig?.patternComplexity ?? 1;
    const speed = this.currentConfig?.patternSpeed ?? 1.0;
    
    this.particleSystem = new ParticleSystem("nebula", Math.floor(3000 * complexity), this.scene);
    this.particleSystem.particleTexture = new Texture("https://raw.githubusercontent.com/BabylonJS/Babylon.js/master/packages/tools/playground/public/textures/cloud.png", this.scene);
    this.particleSystem.emitter = this.patternRoot || Vector3.Zero();
    
    this.particleSystem.minEmitBox = new Vector3(-15 * scale, -10 * scale, -15 * scale);
    this.particleSystem.maxEmitBox = new Vector3(15 * scale, 10 * scale, 15 * scale);
    
    this.particleSystem.color1 = this.parseColor(this.currentConfig?.patternColor1, new Color3(0.5, 0.1, 0.8)).toColor4(0.3);
    this.particleSystem.color2 = this.parseColor(this.currentConfig?.patternColor2, new Color3(0.1, 0.5, 0.8)).toColor4(0.3);
    this.particleSystem.colorDead = new Color3(0, 0, 0).toColor4(0);
    
    this.particleSystem.minSize = 5 * scale;
    this.particleSystem.maxSize = 15 * scale;
    this.particleSystem.minLifeTime = 5;
    this.particleSystem.maxLifeTime = 10;
    this.baseEmitRate = Math.floor(150 * complexity);
    this.particleSystem.emitRate = this.baseEmitRate;
    this.particleSystem.blendMode = ParticleSystem.BLENDMODE_ADD;
    
    this.particleSystem.gravity = new Vector3(0, 0, 0);
    this.particleSystem.direction1 = new Vector3(-0.1, -0.1, -0.1);
    this.particleSystem.direction2 = new Vector3(0.1, 0.1, 0.1);
    
    this.particleSystem.minAngularSpeed = -0.2;
    this.particleSystem.maxAngularSpeed = 0.2;
    this.particleSystem.minEmitPower = 0.1;
    this.particleSystem.maxEmitPower = 0.5;
    this.particleSystem.updateSpeed = 0.005 * speed;
    
    const noiseTexture = new NoiseProceduralTexture("nebulaNoise", 256, this.scene);
    noiseTexture.animationSpeedFactor = 0.5 * speed;
    noiseTexture.persistence = 2;
    noiseTexture.brightness = 0.5;
    noiseTexture.octaves = 2;
    this.particleSystem.noiseTexture = noiseTexture;
    this.particleSystem.noiseStrength = new Vector3(2 * scale, 2 * scale, 2 * scale);
    
    this.particleSystem.start();
  }

  private createSmoke() {
    const scale = this.currentConfig?.patternScale ?? 1.0;
    const complexity = this.currentConfig?.patternComplexity ?? 1;
    const speed = this.currentConfig?.patternSpeed ?? 1.0;
    
    this.particleSystem = new ParticleSystem("smoke", Math.floor(2000 * complexity), this.scene);
    this.particleSystem.particleTexture = new Texture("https://raw.githubusercontent.com/BabylonJS/Babylon.js/master/packages/tools/playground/public/textures/smoke.png", this.scene);
    this.particleSystem.emitter = this.patternRoot || Vector3.Zero();
    
    this.particleSystem.minEmitBox = new Vector3(-2 * scale, -5 * scale, -2 * scale);
    this.particleSystem.maxEmitBox = new Vector3(2 * scale, -5 * scale, 2 * scale);
    
    const baseColor = this.parseColor(this.currentConfig?.patternColor1, new Color3(0.5, 0.5, 0.5));
    this.particleSystem.color1 = baseColor.toColor4(0.6);
    this.particleSystem.color2 = baseColor.scale(0.5).toColor4(0.3);
    this.particleSystem.colorDead = new Color3(0, 0, 0).toColor4(0);
    
    this.particleSystem.minSize = 2 * scale;
    this.particleSystem.maxSize = 8 * scale;
    this.particleSystem.minLifeTime = 3;
    this.particleSystem.maxLifeTime = 8;
    this.baseEmitRate = Math.floor(150 * complexity);
    this.particleSystem.emitRate = this.baseEmitRate;
    this.particleSystem.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    
    this.particleSystem.gravity = new Vector3(0, 2 * scale, 0); // Rises up
    this.particleSystem.direction1 = new Vector3(-0.5, 1, -0.5);
    this.particleSystem.direction2 = new Vector3(0.5, 2, 0.5);
    
    this.particleSystem.minAngularSpeed = -1;
    this.particleSystem.maxAngularSpeed = 1;
    this.particleSystem.minEmitPower = 0.5;
    this.particleSystem.maxEmitPower = 1.5;
    this.particleSystem.updateSpeed = 0.01 * speed;

    // Make smoke expand as it rises
    this.particleSystem.addSizeGradient(0, 1 * scale);
    this.particleSystem.addSizeGradient(1, 4 * scale);
    
    // Fade out
    this.particleSystem.addColorGradient(0, baseColor.toColor4(0));
    this.particleSystem.addColorGradient(0.2, baseColor.toColor4(0.6));
    this.particleSystem.addColorGradient(1, baseColor.scale(0.2).toColor4(0));
    
    this.particleSystem.start();
  }

  private createFluid() {
    const scale = this.currentConfig?.patternScale ?? 1.0;
    const complexity = this.currentConfig?.patternComplexity ?? 1;
    const speed = this.currentConfig?.patternSpeed ?? 1.0;
    
    this.particleSystem = new ParticleSystem("fluid", Math.floor(4000 * complexity), this.scene);
    this.particleSystem.particleTexture = new Texture("https://raw.githubusercontent.com/BabylonJS/Babylon.js/master/packages/tools/playground/public/textures/flare.png", this.scene);
    this.particleSystem.emitter = this.patternRoot || Vector3.Zero();
    
    this.particleSystem.minEmitBox = new Vector3(-10 * scale, -10 * scale, -10 * scale);
    this.particleSystem.maxEmitBox = new Vector3(10 * scale, 10 * scale, 10 * scale);
    
    this.particleSystem.color1 = this.parseColor(this.currentConfig?.patternColor1, new Color3(0.1, 0.5, 1.0)).toColor4(0.8);
    this.particleSystem.color2 = this.parseColor(this.currentConfig?.patternColor2, new Color3(0.0, 0.2, 0.8)).toColor4(0.8);
    this.particleSystem.colorDead = new Color3(0, 0, 0.2).toColor4(0);
    
    this.particleSystem.minSize = 0.5 * scale;
    this.particleSystem.maxSize = 2 * scale;
    this.particleSystem.minLifeTime = 1;
    this.particleSystem.maxLifeTime = 3;
    this.baseEmitRate = Math.floor(800 * complexity);
    this.particleSystem.emitRate = this.baseEmitRate;
    this.particleSystem.blendMode = ParticleSystem.BLENDMODE_ADD;
    
    this.particleSystem.gravity = new Vector3(0, -2 * scale, 0); // Flows down
    this.particleSystem.direction1 = new Vector3(-1, -1, -1);
    this.particleSystem.direction2 = new Vector3(1, 0, 1);
    
    this.particleSystem.minAngularSpeed = -2;
    this.particleSystem.maxAngularSpeed = 2;
    this.particleSystem.minEmitPower = 1;
    this.particleSystem.maxEmitPower = 3;
    this.particleSystem.updateSpeed = 0.015 * speed;
    
    const noiseTexture = new NoiseProceduralTexture("fluidNoise", 256, this.scene);
    noiseTexture.animationSpeedFactor = 5 * speed;
    noiseTexture.persistence = 1.2;
    noiseTexture.brightness = 0.5;
    noiseTexture.octaves = 2;
    this.particleSystem.noiseTexture = noiseTexture;
    this.particleSystem.noiseStrength = new Vector3(5 * scale, 5 * scale, 5 * scale);
    
    this.particleSystem.start();
  }

  private createSwarm() {
    const scale = this.currentConfig?.patternScale ?? 1.0;
    const complexity = this.currentConfig?.patternComplexity ?? 1;
    const speed = this.currentConfig?.patternSpeed ?? 1.0;
    
    this.particleSystem = new ParticleSystem("swarm", Math.floor(2000 * complexity), this.scene);
    this.particleSystem.particleTexture = new Texture("https://raw.githubusercontent.com/BabylonJS/Babylon.js/master/packages/tools/playground/public/textures/flare.png", this.scene);
    this.particleSystem.emitter = this.patternRoot || Vector3.Zero();
    
    this.particleSystem.minEmitBox = new Vector3(-8 * scale, -8 * scale, -8 * scale);
    this.particleSystem.maxEmitBox = new Vector3(8 * scale, 8 * scale, 8 * scale);
    
    this.particleSystem.color1 = this.parseColor(this.currentConfig?.patternColor1, new Color3(1.0, 0.8, 0.2)).toColor4(1.0);
    this.particleSystem.color2 = this.parseColor(this.currentConfig?.patternColor2, new Color3(1.0, 0.4, 0.0)).toColor4(1.0);
    this.particleSystem.colorDead = new Color3(0, 0, 0).toColor4(0);
    
    this.particleSystem.minSize = 0.2 * scale;
    this.particleSystem.maxSize = 0.8 * scale;
    this.particleSystem.minLifeTime = 0.5;
    this.particleSystem.maxLifeTime = 2;
    this.baseEmitRate = Math.floor(500 * complexity);
    this.particleSystem.emitRate = this.baseEmitRate;
    this.particleSystem.blendMode = ParticleSystem.BLENDMODE_ADD;
    
    this.particleSystem.gravity = new Vector3(0, 0, 0);
    this.particleSystem.direction1 = new Vector3(-2, -2, -2);
    this.particleSystem.direction2 = new Vector3(2, 2, 2);
    
    this.particleSystem.minAngularSpeed = -5;
    this.particleSystem.maxAngularSpeed = 5;
    this.particleSystem.minEmitPower = 2;
    this.particleSystem.maxEmitPower = 6;
    this.particleSystem.updateSpeed = 0.02 * speed;
    
    const noiseTexture = new NoiseProceduralTexture("swarmNoise", 256, this.scene);
    noiseTexture.animationSpeedFactor = 10 * speed;
    noiseTexture.persistence = 0.8;
    noiseTexture.brightness = 0.5;
    noiseTexture.octaves = 3;
    this.particleSystem.noiseTexture = noiseTexture;
    this.particleSystem.noiseStrength = new Vector3(10 * scale, 10 * scale, 10 * scale);
    
    this.particleSystem.start();
  }

  private createConstellation() {
    const scale = this.currentConfig?.patternScale ?? 1.0;
    const complexity = this.currentConfig?.patternComplexity ?? 1;
    const speed = this.currentConfig?.patternSpeed ?? 1.0;
    
    this.particleSystem = new ParticleSystem("constellation", Math.floor(1000 * complexity), this.scene);
    this.particleSystem.particleTexture = new Texture("https://raw.githubusercontent.com/BabylonJS/Babylon.js/master/packages/tools/playground/public/textures/star.png", this.scene);
    this.particleSystem.emitter = this.patternRoot || Vector3.Zero();
    
    this.particleSystem.minEmitBox = new Vector3(-20 * scale, -20 * scale, -20 * scale);
    this.particleSystem.maxEmitBox = new Vector3(20 * scale, 20 * scale, 20 * scale);
    
    this.particleSystem.color1 = this.parseColor(this.currentConfig?.patternColor1, new Color3(1.0, 1.0, 1.0)).toColor4(1.0);
    this.particleSystem.color2 = this.parseColor(this.currentConfig?.patternColor2, new Color3(0.8, 0.9, 1.0)).toColor4(0.8);
    this.particleSystem.colorDead = new Color3(0, 0, 0).toColor4(0);
    
    this.particleSystem.minSize = 0.5 * scale;
    this.particleSystem.maxSize = 1.5 * scale;
    this.particleSystem.minLifeTime = 10;
    this.particleSystem.maxLifeTime = 20;
    this.baseEmitRate = Math.floor(50 * complexity);
    this.particleSystem.emitRate = this.baseEmitRate;
    this.particleSystem.blendMode = ParticleSystem.BLENDMODE_ADD;
    
    this.particleSystem.gravity = new Vector3(0, 0, 0);
    this.particleSystem.direction1 = new Vector3(-0.05, -0.05, -0.05);
    this.particleSystem.direction2 = new Vector3(0.05, 0.05, 0.05);
    
    this.particleSystem.minAngularSpeed = -0.1;
    this.particleSystem.maxAngularSpeed = 0.1;
    this.particleSystem.minEmitPower = 0;
    this.particleSystem.maxEmitPower = 0.1;
    this.particleSystem.updateSpeed = 0.005 * speed;
    
    // Twinkle effect
    this.particleSystem.addColorGradient(0, new Color3(0, 0, 0).toColor4(0));
    this.particleSystem.addColorGradient(0.1, new Color3(1, 1, 1).toColor4(1));
    this.particleSystem.addColorGradient(0.5, new Color3(0.5, 0.5, 0.5).toColor4(0.5));
    this.particleSystem.addColorGradient(0.9, new Color3(1, 1, 1).toColor4(1));
    this.particleSystem.addColorGradient(1, new Color3(0, 0, 0).toColor4(0));
    
    this.particleSystem.start();
  }

  private createBubbles() {
    const scale = this.currentConfig?.patternScale ?? 1.0;
    const complexity = this.currentConfig?.patternComplexity ?? 1;
    const speed = this.currentConfig?.patternSpeed ?? 1.0;
    
    this.particleSystem = new ParticleSystem("bubbles", Math.floor(1000 * complexity), this.scene);
    this.particleSystem.particleTexture = new Texture("https://raw.githubusercontent.com/BabylonJS/Babylon.js/master/packages/tools/playground/public/textures/flare.png", this.scene);
    this.particleSystem.emitter = this.patternRoot || Vector3.Zero();
    
    // Emit from a base plane
    this.particleSystem.minEmitBox = new Vector3(-10 * scale, -2 * scale, -10 * scale);
    this.particleSystem.maxEmitBox = new Vector3(10 * scale, 0, 10 * scale);
    
    this.particleSystem.color1 = this.parseColor(this.currentConfig?.patternColor1, new Color3(0.7, 0.9, 1.0)).toColor4(0.8);
    this.particleSystem.color2 = this.parseColor(this.currentConfig?.patternColor2, new Color3(0.4, 0.7, 1.0)).toColor4(0.5);
    this.particleSystem.colorDead = new Color3(0, 0, 0.2).toColor4(0);
    
    this.particleSystem.minSize = 0.2 * scale;
    this.particleSystem.maxSize = 0.8 * scale;
    this.particleSystem.minLifeTime = 2;
    this.particleSystem.maxLifeTime = 5;
    this.baseEmitRate = Math.floor(200 * complexity);
    this.particleSystem.emitRate = this.baseEmitRate;
    
    this.particleSystem.gravity = new Vector3(0, 2 * scale, 0); // Percolate UP
    this.particleSystem.direction1 = new Vector3(-0.5, 1, -0.5);
    this.particleSystem.direction2 = new Vector3(0.5, 1, 0.5);
    
    this.particleSystem.minEmitPower = 1;
    this.particleSystem.maxEmitPower = 3;
    this.particleSystem.updateSpeed = 0.01 * speed;
    
    this.particleSystem.start();
  }

  private createWheel() {
    const scale = this.currentConfig?.patternScale ?? 1.0;
    const complexity = this.currentConfig?.patternComplexity ?? 1;
    const color = this.parseColor(this.currentConfig?.patternColor1, new Color3(1, 1, 1));

    const root = new Mesh("wheelRoot", this.scene);
    root.parent = this.patternRoot;

    const segments = Math.floor(12 * complexity);
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const spoke = MeshBuilder.CreateBox(`spoke_${i}`, { width: 0.1 * scale, height: 5 * scale, depth: 0.1 * scale }, this.scene);
      spoke.parent = root;
      spoke.position.set(Math.cos(angle) * 2.5 * scale, Math.sin(angle) * 2.5 * scale, 0);
      spoke.rotation.z = angle;
      
      const mat = new StandardMaterial("spokeMat", this.scene);
      mat.emissiveColor = color;
      mat.disableLighting = true;
      spoke.material = mat;
      this.currentMeshes.push(spoke);
    }

    const rim = MeshBuilder.CreateTorus("rim", { diameter: 5 * scale, thickness: 0.1 * scale, tessellation: 64 }, this.scene);
    rim.parent = root;
    rim.rotation.x = Math.PI / 2;
    const rimMat = new StandardMaterial("rimMat", this.scene);
    rimMat.emissiveColor = color;
    rimMat.disableLighting = true;
    rim.material = rimMat;
    this.currentMeshes.push(rim);
  }

  private createDial() {
    const scale = this.currentConfig?.patternScale ?? 1.0;
    const color = this.parseColor(this.currentConfig?.patternColor1, new Color3(1, 1, 1));
    const color2 = this.parseColor(this.currentConfig?.patternColor2, new Color3(1, 0, 0));

    const root = new Mesh("dialRoot", this.scene);
    root.parent = this.patternRoot;

    const face = MeshBuilder.CreateDisc("dialFace", { radius: 3 * scale, tessellation: 64 }, this.scene);
    face.parent = root;
    const faceMat = new StandardMaterial("faceMat", this.scene);
    faceMat.emissiveColor = color.scale(0.2);
    faceMat.alpha = 0.5;
    faceMat.disableLighting = true;
    face.material = faceMat;
    this.currentMeshes.push(face);

    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const tick = MeshBuilder.CreateBox(`tick_${i}`, { width: 0.05 * scale, height: 0.5 * scale, depth: 0.05 * scale }, this.scene);
      tick.parent = root;
      tick.position.set(Math.cos(angle) * 2.7 * scale, Math.sin(angle) * 2.7 * scale, 0);
      tick.rotation.z = angle;
      const tickMat = new StandardMaterial("tickMat", this.scene);
      tickMat.emissiveColor = color;
      tickMat.disableLighting = true;
      tick.material = tickMat;
      this.currentMeshes.push(tick);
    }

    const hand = MeshBuilder.CreateBox("hand", { width: 0.1 * scale, height: 2.5 * scale, depth: 0.1 * scale }, this.scene);
    hand.parent = root;
    hand.setPivotPoint(new Vector3(0, -1.25 * scale, 0));
    hand.position.y = 1.25 * scale;
    const handMat = new StandardMaterial("handMat", this.scene);
    handMat.emissiveColor = color2;
    handMat.disableLighting = true;
    hand.material = handMat;
    this.currentMeshes.push(hand);
  }

  private createClock() {
    const scale = this.currentConfig?.patternScale ?? 1.0;
    const color = this.parseColor(this.currentConfig?.patternColor1, new Color3(1, 1, 1));

    const root = new Mesh("clockRoot", this.scene);
    root.parent = this.patternRoot;

    // Hour hand
    const hourHand = MeshBuilder.CreateBox("hourHand", { width: 0.15 * scale, height: 1.5 * scale, depth: 0.1 * scale }, this.scene);
    hourHand.parent = root;
    hourHand.setPivotPoint(new Vector3(0, -0.75 * scale, 0));
    hourHand.position.y = 0.75 * scale;
    const hourMat = new StandardMaterial("hourMat", this.scene);
    hourMat.emissiveColor = color;
    hourMat.disableLighting = true;
    hourHand.material = hourMat;
    this.currentMeshes.push(hourHand);

    // Minute hand
    const minuteHand = MeshBuilder.CreateBox("minuteHand", { width: 0.1 * scale, height: 2.5 * scale, depth: 0.1 * scale }, this.scene);
    minuteHand.parent = root;
    minuteHand.setPivotPoint(new Vector3(0, -1.25 * scale, 0));
    minuteHand.position.y = 1.25 * scale;
    minuteHand.position.z = -0.1 * scale;
    const minuteMat = new StandardMaterial("minuteMat", this.scene);
    minuteMat.emissiveColor = color;
    minuteMat.disableLighting = true;
    minuteHand.material = minuteMat;
    this.currentMeshes.push(minuteHand);
  }

  private createTorus() {
    const scale = this.currentConfig?.patternScale ?? 1.0;
    const color = this.parseColor(this.currentConfig?.patternColor1, new Color3(1, 1, 1));
    const torus = MeshBuilder.CreateTorus("torus", { diameter: 2 * scale, thickness: 0.2 * scale, tessellation: 32 }, this.scene);
    torus.parent = this.patternRoot;
    const mat = new StandardMaterial("torusMat", this.scene);
    mat.emissiveColor = color;
    mat.disableLighting = true;
    torus.material = mat;
    this.currentMeshes.push(torus);
  }

  private createCone() {
    const scale = this.currentConfig?.patternScale ?? 1.0;
    const color = this.parseColor(this.currentConfig?.patternColor1, new Color3(1, 1, 1));
    const cone = MeshBuilder.CreateCylinder("cone", { diameterTop: 0, diameterBottom: 2 * scale, height: 3 * scale, tessellation: 32 }, this.scene);
    cone.parent = this.patternRoot;
    const mat = new StandardMaterial("coneMat", this.scene);
    mat.emissiveColor = color;
    mat.disableLighting = true;
    cone.material = mat;
    this.currentMeshes.push(cone);
  }

  private createCluster() {
    const config = this.currentConfig;
    if (!config) return;

    const count = config.clusterCount || 20;
    const basePattern = config.clusterBasePattern || 'dot';
    const scale = config.patternScale ?? 1.0;
    const chaos = (config.clusterChaos ?? 50) / 100;

    for (let i = 0; i < count; i++) {
      const instanceRoot = new Mesh(`cluster_${i}`, this.scene);
      instanceRoot.parent = this.patternRoot;
      
      // Disordered spawning with chaos control
      const maxRadius = 15 * scale * (0.5 + chaos);
      const radius = maxRadius * Math.sqrt(Math.random());
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      
      instanceRoot.position.set(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi)
      );
      
      // Rotation chaos
      instanceRoot.rotation.set(
        Math.random() * Math.PI * 2 * chaos,
        Math.random() * Math.PI * 2 * chaos,
        Math.random() * Math.PI * 2 * chaos
      );

      // Store initial position for animations
      instanceRoot.metadata = {
        initialPos: instanceRoot.position.clone(),
        randomOffset: Math.random() * Math.PI * 2,
        randomSpeed: 0.5 + Math.random()
      };

      this.createFascinator(basePattern, instanceRoot);
    }
  }

  private createDot() {
    const scale = this.currentConfig?.patternScale ?? 1.0;
    const color1 = this.parseColor(this.currentConfig?.patternColor1, new Color3(1, 1, 1));
    const color2 = this.parseColor(this.currentConfig?.patternColor2, new Color3(1, 1, 0.8));

    const dot = MeshBuilder.CreateSphere("dot", { diameter: 0.5 * scale }, this.scene);
    dot.parent = this.patternRoot;
    
    const material = new StandardMaterial("dotMat", this.scene);
    material.emissiveColor = color1;
    material.disableLighting = true;
    dot.material = material;

    // Add a glow effect
    const glow = MeshBuilder.CreateSphere("dotGlow", { diameter: 1.5 * scale }, this.scene);
    glow.parent = dot;
    const glowMat = new StandardMaterial("glowMat", this.scene);
    glowMat.emissiveColor = color2;
    glowMat.alpha = 0.3;
    glowMat.disableLighting = true;
    glow.material = glowMat;

    this.currentMeshes.push(dot);
    this.currentMeshes.push(glow);
  }

  private createMandala() {
    const scale = this.currentConfig?.patternScale ?? 1.0;
    const complexity = this.currentConfig?.patternComplexity ?? 1;
    const type = this.currentConfig?.patternType || 'default';
    const pattern = this.currentConfig?.pattern || 'mandala';
    
    const material = new StandardMaterial("mandalaMat", this.scene);
    material.emissiveColor = this.parseColor(this.currentConfig?.patternColor1, new Color3(1.0, 0.5, 0.2));
    material.wireframe = true;
    material.alpha = 0.7;

    const layers = Math.floor(5 * complexity);
    const pointsPerLayer = pattern === 'polygon' ? 6 : (type === 'hypnotic' ? 16 : 8);

    for (let l = 1; l <= layers; l++) {
      const radius = l * 2 * scale;
      const path = [];
      for (let i = 0; i <= pointsPerLayer; i++) {
        const angle = (i / pointsPerLayer) * Math.PI * 2;
        // Add some star-like variation unless it's a simple polygon
        const r = (pattern === 'polygon' || i % 2 === 0) ? radius : radius * 0.5;
        path.push(new Vector3(Math.cos(angle) * r, Math.sin(angle) * r, 0));
      }
      
      const lines = MeshBuilder.CreateLines(`mandala_${l}`, { points: path }, this.scene);
      lines.color = material.emissiveColor;
      this.currentMeshes.push(lines);
      
      // Add a rotating torus for each layer
      if (type === 'breathing' || pattern === 'polygon') {
        const torus = MeshBuilder.CreateTorus(`mandala_t_${l}`, { diameter: radius * 2, thickness: 0.05, tessellation: pointsPerLayer }, this.scene);
        torus.material = material;
        torus.rotation.x = Math.PI / 2;
        this.currentMeshes.push(torus);
      }
    }
  }

  private createKaleidoscope() {
    const scale = this.currentConfig?.patternScale ?? 1.0;
    const complexity = this.currentConfig?.patternComplexity ?? 1;
    const type = this.currentConfig?.patternType || 'default';
    
    const material = new StandardMaterial("kaleidoMat", this.scene);
    material.emissiveColor = this.parseColor(this.currentConfig?.patternColor1, new Color3(0.8, 0.2, 1.0));
    material.wireframe = true;
    material.alpha = 0.6;

    const baseShape = MeshBuilder.CreateCylinder("baseShape", { diameterTop: 0, diameterBottom: 4 * scale, height: 6 * scale, tessellation: 3 }, this.scene);
    baseShape.material = material;
    baseShape.rotation.x = Math.PI / 2;
    this.currentMeshes.push(baseShape);

    // If it's a fascinator, just return the single object
    if (type === 'fascinator') {
      return;
    }

    const segments = Math.floor(8 * complexity);
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

    if (this.patternRoot) {
      const faceCamera = this.currentConfig.patternFaceCamera ?? true;
      if (faceCamera) {
        this.patternRoot.lookAt(this.camera.position);
        this.patternRoot.rotate(Vector3.Up(), Math.PI);
      } else {
        this.patternRoot.rotation = Vector3.Zero();
      }
    }

    const animSpeed = this.currentConfig.patternSpeed ?? 1.0;
    const type = this.currentConfig.patternType || 'fascinator';
    const pattern = this.currentConfig.pattern || 'flat spiral';

    if (type === 'repetition') {
      const count = this.currentConfig.repetitionCount || 10;
      const animation = this.currentConfig.repetitionAnimation || 'none';
      const scale = this.currentConfig.patternScale ?? 1.0;
      
      const instances = this.patternRoot?.getChildren() || [];
      instances.forEach((instance, i) => {
        if (!(instance instanceof TransformNode)) return;
        
        if (animation === 'wave') {
          instance.position.y += Math.sin(this.time * 2 * animSpeed + i * 0.5) * 0.05;
        } else if (animation === 'pulse') {
          const s = 1.0 + Math.sin(this.time * 3 * animSpeed + i * 0.2) * 0.2;
          instance.scaling.set(s, s, s);
        } else if (animation === 'random') {
          instance.position.x += (Math.random() - 0.5) * 0.02 * animSpeed;
          instance.position.y += (Math.random() - 0.5) * 0.02 * animSpeed;
          instance.position.z += (Math.random() - 0.5) * 0.02 * animSpeed;
        } else if (animation === 'snake') {
          instance.position.z -= 0.1 * animSpeed;
          if (instance.position.z < -10 * scale) {
             instance.position.z = count * 5 * scale;
          }
        }
      });
    }

    if (type === 'cluster') {
      const animation = this.currentConfig.pattern || 'disordered';
      const instances = this.patternRoot?.getChildren() || [];
      instances.forEach((instance, i) => {
        if (!(instance instanceof TransformNode)) return;
        const metadata = instance.metadata || {};
        const initialPos = metadata.initialPos || instance.position.clone();
        const offset = metadata.randomOffset || 0;
        const speed = metadata.randomSpeed || 1;

        if (animation === 'float') {
          instance.position.x = initialPos.x + Math.sin(this.time * 0.5 * animSpeed * speed + offset) * 2;
          instance.position.y = initialPos.y + Math.cos(this.time * 0.4 * animSpeed * speed + offset) * 2;
          instance.position.z = initialPos.z + Math.sin(this.time * 0.6 * animSpeed * speed + offset) * 2;
        } else if (animation === 'orbit') {
          const radius = initialPos.length();
          const angle = this.time * 0.2 * animSpeed * speed + offset;
          instance.position.x = Math.cos(angle) * radius;
          instance.position.z = Math.sin(angle) * radius;
          instance.lookAt(Vector3.Zero());
        } else if (animation === 'pulse') {
          const s = 1.0 + Math.sin(this.time * 2 * animSpeed * speed + offset) * 0.3;
          instance.scaling.set(s, s, s);
        } else if (animation === 'vortex') {
          const radius = initialPos.length() * (1 + Math.sin(this.time * 0.5 * animSpeed) * 0.5);
          const angle = this.time * 0.5 * animSpeed * speed + offset;
          instance.position.x = Math.cos(angle) * radius;
          instance.position.y = initialPos.y + Math.sin(this.time * animSpeed) * 5;
          instance.position.z = Math.sin(angle) * radius;
        }
      });
    }

    if (type === 'cloud' && this.patternRoot) {
      const animation = this.currentConfig.cloudAnimation || 'none';
      const scale = this.currentConfig.patternScale ?? 1.0;
      
      if (animation === 'wave') {
        this.patternRoot.position.y = Math.sin(this.time * 2 * animSpeed) * 5 * scale;
        this.patternRoot.position.x = 0;
        this.patternRoot.position.z = 0;
        if (this.particleSystem) this.particleSystem.emitRate = this.baseEmitRate;
      } else if (animation === 'pulse') {
        if (this.particleSystem) {
          this.particleSystem.emitRate = this.baseEmitRate * (1 + Math.sin(this.time * 3 * animSpeed) * 0.8);
        }
        this.patternRoot.position.set(0, 0, 0);
      } else if (animation === 'random') {
        this.patternRoot.position.x += (Math.random() - 0.5) * 0.5 * animSpeed * scale;
        this.patternRoot.position.y += (Math.random() - 0.5) * 0.5 * animSpeed * scale;
        this.patternRoot.position.z += (Math.random() - 0.5) * 0.5 * animSpeed * scale;
        if (this.particleSystem) this.particleSystem.emitRate = this.baseEmitRate;
      } else if (animation === 'snake') {
        this.patternRoot.position.x = Math.sin(this.time * 2 * animSpeed) * 5 * scale;
        this.patternRoot.position.z = Math.cos(this.time * 2 * animSpeed) * 5 * scale;
        this.patternRoot.position.y = 0;
        if (this.particleSystem) this.particleSystem.emitRate = this.baseEmitRate;
      } else {
        this.patternRoot.position.set(0, 0, 0);
        if (this.particleSystem) this.particleSystem.emitRate = this.baseEmitRate;
      }
    }

    if ((pattern === 'flat spiral' || pattern === 'spiral' || pattern === 'galaxy' || pattern === 'vortex' || pattern === 'nautilus spiral') && this.currentMeshes.length > 0) {
      this.currentMeshes.forEach((m, i) => {
        m.rotation.y += 0.01 * animSpeed;
        if (type === 'breathing' || type === 'cloud') {
          const scale = 1 + Math.sin(this.time * 2 * animSpeed) * 0.2;
          m.scaling = new Vector3(scale, scale, scale);
        } else {
          m.rotation.x = Math.sin(this.time * 0.5 * animSpeed) * 0.2;
        }
      });
    } else if (pattern === 'wheel') {
      this.currentMeshes.forEach(m => {
        if (m.name.includes("wheelRoot") || m.parent?.name.includes("wheelRoot")) {
           m.rotation.z += 0.02 * animSpeed;
        }
      });
    } else if (pattern === 'dial') {
      this.currentMeshes.forEach(m => {
        if (m.name === "hand") {
          m.rotation.z -= 0.05 * animSpeed;
        }
      });
    } else if (pattern === 'clock') {
      this.currentMeshes.forEach(m => {
        if (m.name === "hourHand") {
          m.rotation.z -= 0.005 * animSpeed;
        } else if (m.name === "minuteHand") {
          m.rotation.z -= 0.06 * animSpeed;
        }
      });
    } else if (pattern === 'tunnel' && this.currentMeshes.length > 0) {
      this.currentMeshes[0].rotation.y += 0.002 * animSpeed;
      if (this.currentConfig.camera === 'fly') {
        this.currentMeshes[0].position.z = Math.floor(this.camera.target.z / 2) * 2;
      } else {
        this.currentMeshes[0].position.z = 0;
      }
    } else if (pattern === 'ring' || pattern === 'grid' || pattern === 'fractal' || pattern === 'orb') {
      this.currentMeshes.forEach((m, i) => {
        if (i > 0) { // Skip base mesh
          m.rotation.x += 0.01 * (i % 3 + 1) * animSpeed;
          m.rotation.y += 0.02 * (i % 2 + 1) * animSpeed;
          m.rotation.z += 0.015 * animSpeed;
        }
      });
    } else if (pattern === 'mandala') {
      this.currentMeshes.forEach((m, i) => {
        m.rotation.z += (i % 2 === 0 ? 0.01 : -0.01) * animSpeed;
        if (type === 'breathing' || type === 'cloud') {
          const scale = 1 + Math.sin(this.time * animSpeed + i) * 0.1;
          m.scaling = new Vector3(scale, scale, scale);
        }
      });
    } else if (pattern === 'kaleido') {
      this.currentMeshes.forEach((m, i) => {
        m.rotation.x += 0.02 * animSpeed;
        m.rotation.y += 0.01 * animSpeed;
      });
    } else if ((pattern === 'wave' || pattern === 'waves' || pattern === 'saddle' || pattern === 'plane' || pattern === 'random voxel surface' || pattern === 'random curved surface') && this.currentMeshes.length > 0) {
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
    } else if (pattern === 'pulse' || pattern === 'pendulum') {
      this.currentMeshes.forEach((m, i) => {
        const scale = 1 + Math.sin(this.time * 3 * animSpeed - i) * 0.2;
        m.scaling = new Vector3(scale, scale, scale);
      });
    } else if (pattern === 'dot' && this.currentMeshes.length >= 2) {
      const dot = this.currentMeshes[0];
      const glow = this.currentMeshes[1];
      const twinkle = (Math.sin(this.time * 5 * animSpeed) * 0.5 + 0.5);
      
      const dotMat = dot.material as StandardMaterial;
      const glowMat = glow.material as StandardMaterial;
      
      if (dotMat) dotMat.alpha = 0.5 + twinkle * 0.5;
      if (glowMat) glowMat.alpha = 0.1 + twinkle * 0.4;
      
      const pulseScale = 0.9 + twinkle * 0.2;
      dot.scaling.setAll(pulseScale);
    }
  }

  private applyDisplayPattern(controls: GUI.Control[], pattern: string, time: number, isAux: boolean) {
    const width = 2048;
    const height = 1024;
    
    const updateWordList = (c: GUI.Control) => {
      const wlConfig = (c as any).wordListConfig;
      if (wlConfig) {
        const interval = wlConfig.interval || 3;
        const currentPeriod = Math.floor(time / interval);
        
        if ((c as any).wordListPeriod !== currentPeriod) {
          (c as any).wordListPeriod = currentPeriod;
          
          // Pick a word
          const words = wlConfig.words;
          const offset = (c as any).wordListIndexOffset || 0;
          const wordIndex = (currentPeriod * (wlConfig.count || 1) + offset) % words.length;
          if (c instanceof GUI.TextBlock) {
            c.text = words[wordIndex] + " "; // Add space for spacing in StackPanel
          }
          
          // Assign a new random seed for this period so it jumps to a new position
          (c as any).randomSeed = Math.random();
        }
      }
      if (c instanceof GUI.StackPanel) {
        c.children.forEach(updateWordList);
      }
    };

    controls.forEach((c, i) => {
      // Handle wordlists recursively
      updateWordList(c);

      if (pattern === 'center') {
        // Center is handled by StackPanel alignment, no need to set left/top
        c.left = "0px";
        c.top = "0px";
        return;
      }

      // For other patterns, we need to position them
      // We use a pseudo-random value based on index or the wordlist's random seed
      const seed = (c as any).randomSeed ?? (i * 0.618033988749895);
      
      if (pattern === 'scatter') {
        // Randomly in a circle near the center
        const radius = (seed % 1) * (height * 0.4);
        const angle = (seed * 13.37) % (Math.PI * 2);
        c.left = `${Math.cos(angle) * radius}px`;
        c.top = `${Math.sin(angle) * radius}px`;
      } else if (pattern === 'random') {
        // Randomly in the visible area
        const x = ((seed * 17.1) % 1 - 0.5) * width * 0.8;
        const y = ((seed * 23.3) % 1 - 0.5) * height * 0.8;
        c.left = `${x}px`;
        c.top = `${y}px`;
      } else if (pattern === 'spiral') {
        // Spiral pattern
        const total = controls.length;
        const angle = i * 0.5 + time * 0.5; // Slowly rotating spiral
        const radius = (i / total) * (height * 0.4) + 50;
        c.left = `${Math.cos(angle) * radius}px`;
        c.top = `${Math.sin(angle) * radius}px`;
      } else if (pattern === 'march') {
        // Linear grid pattern
        const cols = Math.ceil(Math.sqrt(controls.length));
        const spacingX = width * 0.8 / Math.max(1, cols);
        const spacingY = height * 0.8 / Math.max(1, cols);
        const col = i % cols;
        const row = Math.floor(i / cols);
        
        // Marching animation
        const marchOffset = (time * 50) % spacingY;
        
        const startX = -((cols - 1) * spacingX) / 2;
        const startY = -((cols - 1) * spacingY) / 2;
        
        c.left = `${startX + col * spacingX}px`;
        c.top = `${startY + row * spacingY + marchOffset}px`;
      }
    });
  }

  private updateTextAnimation() {
    const config = this.currentConfig;
    const time = this.time;

    if (this.textPlane) {
      if (!this.textPlane.parent) {
        const faceCamera = config?.textFaceCamera ?? true;
        if (faceCamera) {
          this.textPlane.lookAt(this.camera.position);
          this.textPlane.rotate(Vector3.Up(), Math.PI);
        } else {
          this.textPlane.rotation = Vector3.Zero();
        }
      }

      const outlineType = config?.textOutlineType ?? 'none';
      let outlineColor = config?.textOutlineColor ?? '#000000';
      let outlineWidth = 0;
      if (outlineType === 'rainbow') {
        const hue = Math.floor((time * 50) % 360);
        outlineColor = `hsl(${hue}, 100%, 50%)`;
        outlineWidth = 8;
      } else if (outlineType === 'solid') {
        outlineWidth = 8;
      }

      const animType = config?.textAnimType ?? 'none';
      const animSpeed = config?.textAnimSpeed ?? 1.0;
      const animIntensity = config?.textAnimIntensity ?? 1.0;

      const dist = config?.textDistance ?? 10;
      const baseScale = dist / 5;
      this.textPlane.scaling = new Vector3(baseScale, baseScale, baseScale);
      this.textPlane.position.y = 0;

      if (animType === 'zoom') {
        const s = 1.0 + Math.sin(time * 2 * animSpeed) * 0.2 * animIntensity;
        this.textPlane.scaling.scaleInPlace(s);
      } else if (animType === 'float') {
        this.textPlane.position.y = Math.sin(time * 2 * animSpeed) * 0.5 * animIntensity;
      } else if (animType === 'glitch') {
        if (Math.random() > 0.9 - (0.1 * animIntensity)) {
          this.textPlane.position.x = (Math.random() - 0.5) * 0.5 * animIntensity;
          this.textPlane.position.y = (Math.random() - 0.5) * 0.5 * animIntensity;
        } else {
          this.textPlane.position.x = 0;
          this.textPlane.position.y = 0;
        }
      }

      const pattern = config?.textDisplayPattern ?? 'center';
      this.applyDisplayPattern(this.textControls, pattern, time, false);

      const hasShading = config?.textShading ?? false;

      this.textControls.forEach(c => {
        if (c instanceof GUI.TextBlock) {
          c.outlineColor = outlineColor;
          c.outlineWidth = outlineWidth;
          if (hasShading) {
            c.shadowColor = "rgba(0,0,0,0.8)";
            c.shadowBlur = 10;
            c.shadowOffsetX = 5;
            c.shadowOffsetY = 5;
          } else {
            c.shadowBlur = 0;
            c.shadowOffsetX = 0;
            c.shadowOffsetY = 0;
          }
        } else if (c instanceof GUI.StackPanel) {
          c.children.forEach(child => {
            if (child instanceof GUI.TextBlock) {
              child.outlineColor = outlineColor;
              child.outlineWidth = outlineWidth;
              if (hasShading) {
                child.shadowColor = "rgba(0,0,0,0.8)";
                child.shadowBlur = 10;
                child.shadowOffsetX = 5;
                child.shadowOffsetY = 5;
              } else {
                child.shadowBlur = 0;
                child.shadowOffsetX = 0;
                child.shadowOffsetY = 0;
              }
            }
          });
        }

        c.alpha = 1.0;
        c.rotation = 0;
        c.scaleX = 1.0;
        c.scaleY = 1.0;

        if (animType === 'fade') {
          c.alpha = 0.5 + Math.sin(time * 3 * animSpeed) * 0.5 * animIntensity;
        } else if (animType === 'warp') {
          c.rotation = Math.sin(time * animSpeed) * 0.1 * animIntensity;
          c.scaleX = 1.0 + Math.sin(time * 4 * animSpeed) * 0.1 * animIntensity;
          c.scaleY = 1.0 + Math.cos(time * 4 * animSpeed) * 0.1 * animIntensity;
        } else if (animType === 'prism') {
          if (c instanceof GUI.TextBlock) {
            c.shadowOffsetX = Math.sin(time * 5 * animSpeed) * 10 * animIntensity;
            c.shadowOffsetY = Math.cos(time * 5 * animSpeed) * 10 * animIntensity;
            c.shadowBlur = 15;
            c.shadowColor = `hsla(${(time * 100) % 360}, 100%, 50%, 0.5)`;
          }
        } else if (animType === 'glitch') {
          if (Math.random() > 0.9 - (0.1 * animIntensity)) {
            c.alpha = Math.random();
            if (c instanceof GUI.TextBlock) c.color = Math.random() > 0.5 ? "cyan" : "magenta";
          } else {
            c.alpha = 1.0;
            if (c instanceof GUI.TextBlock) c.color = config?.textColor ?? "white";
          }
        }
      });
    }

    if (this.auxTextPlane && this.auxTextPlane.isVisible) {
      const outlineType = config?.auxOutlineType ?? 'none';
      let outlineColor = config?.auxOutlineColor ?? '#000000';
      let outlineWidth = 0;
      if (outlineType === 'rainbow') {
        const hue = Math.floor((time * 50) % 360);
        outlineColor = `hsl(${hue}, 100%, 50%)`;
        outlineWidth = 8;
      } else if (outlineType === 'solid') {
        outlineWidth = 8;
      }

      const animType = config?.auxAnimType ?? 'none';
      const animSpeed = config?.auxAnimSpeed ?? 1.0;
      const animIntensity = config?.auxAnimIntensity ?? 1.0;

      const dist = config?.auxDistance ?? 10;
      const baseScale = dist / 5;
      this.auxTextPlane.scaling = new Vector3(baseScale, baseScale, baseScale);
      this.auxTextPlane.position.y = -2;

      if (animType === 'zoom') {
        const s = 1.0 + Math.sin(time * 2 * animSpeed) * 0.2 * animIntensity;
        this.auxTextPlane.scaling.scaleInPlace(s);
      } else if (animType === 'float') {
        this.auxTextPlane.position.y = -2 + Math.sin(time * 2 * animSpeed) * 0.5 * animIntensity;
      } else if (animType === 'glitch') {
        if (Math.random() > 0.9 - (0.1 * animIntensity)) {
          this.auxTextPlane.position.x = (Math.random() - 0.5) * 0.5 * animIntensity;
          this.auxTextPlane.position.y = -2 + (Math.random() - 0.5) * 0.5 * animIntensity;
        } else {
          this.auxTextPlane.position.x = 0;
          this.auxTextPlane.position.y = -2;
        }
      }

      const pattern = config?.auxDisplayPattern ?? 'center';
      this.applyDisplayPattern(this.auxTextControls, pattern, time, true);

      const hasShading = config?.auxShading ?? false;

      this.auxTextControls.forEach(c => {
        if (c instanceof GUI.TextBlock) {
          c.outlineColor = outlineColor;
          c.outlineWidth = outlineWidth;
          if (hasShading) {
            c.shadowColor = "rgba(0,0,0,0.8)";
            c.shadowBlur = 10;
            c.shadowOffsetX = 5;
            c.shadowOffsetY = 5;
          } else {
            c.shadowBlur = 0;
            c.shadowOffsetX = 0;
            c.shadowOffsetY = 0;
          }
        } else if (c instanceof GUI.StackPanel) {
          c.children.forEach(child => {
            if (child instanceof GUI.TextBlock) {
              child.outlineColor = outlineColor;
              child.outlineWidth = outlineWidth;
              if (hasShading) {
                child.shadowColor = "rgba(0,0,0,0.8)";
                child.shadowBlur = 10;
                child.shadowOffsetX = 5;
                child.shadowOffsetY = 5;
              } else {
                child.shadowBlur = 0;
                child.shadowOffsetX = 0;
                child.shadowOffsetY = 0;
              }
            }
          });
        }

        c.alpha = 1.0;
        c.rotation = 0;
        c.scaleX = 1.0;
        c.scaleY = 1.0;

        if (animType === 'fade') {
          c.alpha = 0.5 + Math.sin(time * 3 * animSpeed) * 0.5 * animIntensity;
        } else if (animType === 'warp') {
          c.rotation = Math.sin(time * animSpeed) * 0.1 * animIntensity;
          c.scaleX = 1.0 + Math.sin(time * 4 * animSpeed) * 0.1 * animIntensity;
          c.scaleY = 1.0 + Math.cos(time * 4 * animSpeed) * 0.1 * animIntensity;
        } else if (animType === 'prism') {
          if (c instanceof GUI.TextBlock) {
            c.shadowOffsetX = Math.sin(time * 5 * animSpeed) * 10 * animIntensity;
            c.shadowOffsetY = Math.cos(time * 5 * animSpeed) * 10 * animIntensity;
            c.shadowBlur = 15;
            c.shadowColor = `hsla(${(time * 100) % 360}, 100%, 50%, 0.5)`;
          }
        } else if (animType === 'glitch') {
          if (Math.random() > 0.9 - (0.1 * animIntensity)) {
            c.alpha = Math.random();
            if (c instanceof GUI.TextBlock) c.color = Math.random() > 0.5 ? "cyan" : "magenta";
          } else {
            c.alpha = 1.0;
            if (c instanceof GUI.TextBlock) c.color = config?.auxColor ?? "white";
          }
        }
      });
    }
  }

  public updateXRProgress(elapsed: number, duration: number) {
    if (this.xrProgressText) {
      this.xrProgressText.text = `${elapsed}s / ${duration}s`;
    }
  }

  public dispose() {
    window.removeEventListener("resize", this.resizeHandler);
    this.engine.dispose();
  }
}
