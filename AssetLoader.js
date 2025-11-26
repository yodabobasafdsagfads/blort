// /js/engine/AssetLoader.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

export class AssetLoader {
    constructor() {
        this.loadingManager = new THREE.LoadingManager();
        this.textureLoader = new THREE.TextureLoader(this.loadingManager);
        this.gltfLoader = new GLTFLoader(this.loadingManager);
        this.audioLoader = new THREE.AudioLoader(this.loadingManager);
        
        // Setup DRACO compression decoder
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('/js/libs/draco/');
        this.gltfLoader.setDRACOLoader(dracoLoader);
        
        this.assets = {
            textures: new Map(),
            models: new Map(),
            audio: new Map(),
            materials: new Map()
        };
        
        this.loadedCount = 0;
        this.totalCount = 0;
        
        this.setupCallbacks();
    }
    
    setupCallbacks() {
        this.loadingManager.onStart = (url, loaded, total) => {
            this.totalCount = total;
            console.log(`Loading: ${url} (${loaded}/${total})`);
        };
        
        this.loadingManager.onProgress = (url, loaded, total) => {
            this.loadedCount = loaded;
            const progress = (loaded / total) * 100;
            this.updateProgress(progress);
        };
        
        this.loadingManager.onLoad = () => {
            console.log('All assets loaded');
            this.onComplete();
        };
        
        this.loadingManager.onError = (url) => {
            console.error(`Error loading: ${url}`);
        };
    }
    
    async loadAll(assetManifest) {
        const promises = [];
        
        // Load textures
        if (assetManifest.textures) {
            for (const [key, path] of Object.entries(assetManifest.textures)) {
                promises.push(this.loadTexture(key, path));
            }
        }
        
        // Load models
        if (assetManifest.models) {
            for (const [key, path] of Object.entries(assetManifest.models)) {
                promises.push(this.loadModel(key, path));
            }
        }
        
        // Load audio
        if (assetManifest.audio) {
            for (const [key, path] of Object.entries(assetManifest.audio)) {
                promises.push(this.loadAudio(key, path));
            }
        }
        
        await Promise.all(promises);
        return this.assets;
    }
    
    loadTexture(key, path) {
        return new Promise((resolve, reject) => {
            this.textureLoader.load(
                path,
                (texture) => {
                    // Optimize texture settings
                    texture.anisotropy = 4; // Reduce from max for performance
                    texture.generateMipmaps = true;
                    texture.minFilter = THREE.LinearMipmapLinearFilter;
                    texture.magFilter = THREE.LinearFilter;
                    
                    this.assets.textures.set(key, texture);
                    resolve(texture);
                },
                undefined,
                reject
            );
        });
    }
    
    loadModel(key, path) {
        return new Promise((resolve, reject) => {
            this.gltfLoader.load(
                path,
                (gltf) => {
                    // Traverse and optimize
                    gltf.scene.traverse((child) => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                            
                            // Enable frustum culling
                            child.frustumCulled = true;
                            
                            // Optimize materials
                            if (child.material) {
                                child.material.side = THREE.FrontSide;
                            }
                        }
                    });
                    
                    this.assets.models.set(key, gltf);
                    resolve(gltf);
                },
                undefined,
                reject
            );
        });
    }
    
    loadAudio(key, path) {
        return new Promise((resolve, reject) => {
            this.audioLoader.load(
                path,
                (buffer) => {
                    this.assets.audio.set(key, buffer);
                    resolve(buffer);
                },
                undefined,
                reject
            );
        });
    }
    
    getTexture(key) {
        return this.assets.textures.get(key);
    }
    
    getModel(key) {
        return this.assets.models.get(key);
    }
    
    getAudio(key) {
        return this.assets.audio.get(key);
    }
    
    updateProgress(percent) {
        const progressBar = document.getElementById('loading-progress');
        const loadingText = document.getElementById('loading-text');
        
        if (progressBar) {
            progressBar.style.width = `${percent}%`;
        }
        
        if (loadingText) {
            loadingText.textContent = `Loading... ${Math.floor(percent)}%`;
        }
    }
    
    onComplete() {
        // Override in main.js
    }
}
