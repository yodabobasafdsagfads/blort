// /js/engine/Engine.js
import * as THREE from 'three';
import { SceneManager } from './SceneManager.js';
import { InputManager } from './InputManager.js';
import { PhysicsWorld } from './PhysicsWorld.js';
import { PerformanceMonitor } from './PerformanceMonitor.js';

export class Engine {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.clock = new THREE.Clock();
        this.isRunning = false;
        
        // Initialize Three.js renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: false, // Disable for performance
            powerPreference: 'high-performance',
            stencil: false
        });
        
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        
        // Initialize subsystems
        this.sceneManager = new SceneManager(this);
        this.inputManager = new InputManager(this.canvas);
        this.physics = new PhysicsWorld();
        this.performanceMonitor = new PerformanceMonitor();
        
        // Frame timing
        this.lastTime = 0;
        this.deltaTime = 0;
        this.fixedTimeStep = 1 / 60; // 60 physics updates per second
        this.accumulator = 0;
        
        this.setupWindowResize();
    }
    
    setupWindowResize() {
        window.addEventListener('resize', () => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            
            this.renderer.setSize(width, height);
            
            // Update camera aspect if scene has one
            if (this.sceneManager.currentScene?.camera) {
                this.sceneManager.currentScene.camera.aspect = width / height;
                this.sceneManager.currentScene.camera.updateProjectionMatrix();
            }
        });
    }
    
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastTime = performance.now();
        this.loop();
    }
    
    stop() {
        this.isRunning = false;
    }
    
    loop = () => {
        if (!this.isRunning) return;
        
        requestAnimationFrame(this.loop);
        
        const currentTime = performance.now();
        this.deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1); // Cap at 100ms
        this.lastTime = currentTime;
        
        this.performanceMonitor.begin();
        
        // Fixed timestep physics
        this.accumulator += this.deltaTime;
        while (this.accumulator >= this.fixedTimeStep) {
            this.physics.step(this.fixedTimeStep);
            this.accumulator -= this.fixedTimeStep;
        }
        
        // Update game logic
        this.inputManager.update();
        this.sceneManager.update(this.deltaTime);
        
        // Render
        this.sceneManager.render();
        
        this.performanceMonitor.end();
    }
}
