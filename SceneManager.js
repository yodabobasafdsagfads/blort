// /js/engine/SceneManager.js
export class SceneManager {
    constructor(engine) {
        this.engine = engine;
        this.scenes = new Map();
        this.currentScene = null;
        this.transitioning = false;
    }
    
    registerScene(name, sceneClass) {
        this.scenes.set(name, sceneClass);
    }
    
    async switchScene(sceneName, data = {}) {
        if (this.transitioning) return;
        this.transitioning = true;
        
        // Cleanup current scene
        if (this.currentScene) {
            await this.currentScene.onExit();
            this.currentScene.cleanup();
        }
        
        // Create new scene
        const SceneClass = this.scenes.get(sceneName);
        if (!SceneClass) {
            console.error(`Scene ${sceneName} not found`);
            this.transitioning = false;
            return;
        }
        
        this.currentScene = new SceneClass(this.engine, data);
        await this.currentScene.onEnter();
        
        this.transitioning = false;
    }
    
    update(deltaTime) {
        if (this.currentScene && !this.transitioning) {
            this.currentScene.update(deltaTime);
        }
    }
    
    render() {
        if (this.currentScene) {
            this.currentScene.render();
        }
    }
}

// Base Scene Class
export class Scene {
    constructor(engine, data) {
        this.engine = engine;
        this.data = data;
        this.isActive = false;
    }
    
    async onEnter() {
        this.isActive = true;
    }
    
    async onExit() {
        this.isActive = false;
    }
    
    update(deltaTime) {
        // Override in subclasses
    }
    
    render() {
        // Override in subclasses
    }
    
    cleanup() {
        // Dispose of resources
    }
}
