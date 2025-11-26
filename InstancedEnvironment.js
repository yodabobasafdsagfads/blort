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
        
        instance.mesh.setMatrixAt(    instance.mesh.instanceMatrix.needsUpdate = true;
// Use BufferGeometryUtils.mergeGeometries for static buildings
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';function batchStaticBuildings(buildingMeshes) {
const geometries = buildingMeshes.map(mesh => {
const geo = mesh.geometry.clone();
geo.applyMatrix4(mesh.matrix);
return geo;
});const mergedGeometry = mergeGeometries(geometries);
const mergedMesh = new THREE.Mesh(mergedGeometry, buildingMeshes[0].material);return mergedMesh;
}
    }

