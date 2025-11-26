// /js/engine/LODManager.js
import * as THREE from 'three';

export class LODManager {
    constructor(camera) {
        this.camera = camera;
        this.lodObjects = [];
        
        // LOD distances (meters)
        this.LOD_DISTANCES = [20, 50, 100, 200, 500];
    }
    
    createLOD(meshes) {
        // meshes: array of meshes from highest to lowest detail
        const lod = new THREE.LOD();
        
        meshes.forEach((mesh, index) => {
            const distance = this.LOD_DISTANCES[index] || 1000;
            lod.addLevel(mesh, distance);
        });
        
        this.lodObjects.push(lod);
        return lod;
    }
    
    update() {
        this.lodObjects.forEach(lod => {
            lod.update(this.camera);
        });
    }
}
