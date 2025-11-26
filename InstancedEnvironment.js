// /js/gameplay/InstancedEnvironment.js
import * as THREE from 'three';

export class InstancedEnvironment {
    constructor(scene) {
        this.scene = scene;
        this.instances = new Map();
    }
    
    createInstancedMesh(geometry, material, count, name) {
        const mesh = new THREE.InstancedMesh(geometry, material, count);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        // Frustum culling per-instance (Three.js r138+)
        mesh.frustumCulled = true;
        
        this.instances.set(name, {
            mesh,
            count: 0,
            maxCount: count
        });
        
        this.scene.add(mesh);
        return mesh;
    }
    
    addInstance(name, position, rotation, scale) {
        const instance = this.instances.get(name);
        if (!instance || instance.count >= instance.maxCount) return;
        
        const matrix = new THREE.Matrix4();
        const quaternion = new THREE.Quaternion().setFromEuler(rotation);
        matrix.compose(position, quaternion, scale);
        
        instance.mesh.setMatrixAt(
