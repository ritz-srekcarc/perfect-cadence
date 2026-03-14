import { Engine, Scene, Vector3, HemisphericLight, ArcRotateCamera, MeshBuilder, StandardMaterial, Color3, Texture, DynamicTexture, WebXRDefaultExperience, SceneLoader, TransformNode, ParticleSystem, ShaderMaterial, Effect, VertexBuffer } from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import { SegmentConfig } from './timelineParser';

export class SceneManager {
  private engine: Engine;
  private scene: Scene;
  private camera: ArcRotateCamera;
  private xr: WebXRDefaultExperience | null = null;
  private currentMeshes: any[] = [];
  private textPlane: any = null;
  private textTexture: GUI.AdvancedDynamicTexture | null = null;
  private textBackground: GUI.Rectangle | null = null;
  private textBlock: GUI.TextBlock | null = null;
  private time: number = 0;
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
    try {
      this.xr = await this.scene.createDefaultXRExperienceAsync({
        uiOptions: {
          sessionMode: 'immersive-vr',
        }
      });
    } catch (e) {
      console.warn("XR not supported", e);
    }
  }

  private setupGUI() {
    // Create a plane for the text
    const plane = MeshBuilder.CreatePlane("textPlane", { width: 20, height: 10 }, this.scene);
    plane.parent = this.camera;
    plane.position = new Vector3(0, 0, 10); // Default further away
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
  }

  public updateText(text: string) {
    if (this.textBlock) {
      // Strip markdown for simple display, or just show raw
      const cleanText = text.replace(/#/g, '').trim();
      this.textBlock.text = cleanText;
    }
  }

  public applyConfig(config: SegmentConfig) {
    const patternChanged = !this.currentConfig || this.currentConfig.pattern !== config.pattern;
    const cameraChanged = !this.currentConfig || this.currentConfig.camera !== config.camera;
    
    this.currentConfig = config;
    
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
      const dist = config.textDistance ?? 10;
      this.textPlane.position.z = dist;
      // Scale plane proportionally so text doesn't get clipped if it's further away
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
    }
    
    if (this.textBackground) {
      this.textBackground.background = config.textBackdrop ? "rgba(0,0,0,0.5)" : "transparent";
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
    if (!this.textBlock || !this.textPlane) return;
    const config = this.currentConfig;
    const time = this.time;

    // Outline animation
    const outlineStyle = config?.textOutline ?? 'rainbow';
    if (outlineStyle === 'rainbow') {
      const hue = Math.floor((time * 50) % 360);
      this.textBlock.outlineColor = `hsl(${hue}, 100%, 50%)`;
      this.textBlock.outlineWidth = 8;
    } else if (outlineStyle === 'none') {
      this.textBlock.outlineWidth = 0;
    } else {
      this.textBlock.outlineColor = outlineStyle;
      this.textBlock.outlineWidth = 8;
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

  public dispose() {
    this.engine.dispose();
  }
}
