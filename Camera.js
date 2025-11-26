---

## 3. 3D Gameplay Systems

### Third-Person Camera + Aiming System

**Camera.js:**
```javascript
// /js/gameplay/Camera.js
import * as THREE from 'three';

export class ThirdPersonCamera {
    constructor(target) {
        this.camera = new THREE.PerspectiveCamera(
            75, // FOV
            window.innerWidth / window.innerHeight,
            0.1, // Near plane
            1000 // Far plane
        );
        
        this.target = target; // Player mesh
        this.sensitivity = 0.002;
        this.distance = 4.0; // Default distance behind player
        this.aimDistance = 2.5; // Closer when aiming
        this.currentDistance = this.distance;
        
        // Camera offset from player (over shoulder)
        this.offset = new THREE.Vector3(0.6, 0.4, 0); // Right, Up, Forward
        this.aimOffset = new THREE.Vector3(0.8, 0.3, 0); // More centered when aiming
        this.currentOffset = this.offset.clone();
        
        // Rotation angles
        this.phi = 0; // Vertical rotation (pitch)
        this.theta = 0; // Horizontal rotation (yaw)
        this.minPhi = -Math.PI / 3; // Look down limit
        this.maxPhi = Math.PI / 3; // Look up limit
        
        // Collision detection
        this.raycaster = new THREE.Raycaster();
        this.collisionObjects = [];
        
        // Smoothing
        this.smoothFactor = 0.15;
        
        // State
        this.isAiming = false;
    }
    
    handleMouseMove(movementX, movementY) {
        this.theta -= movementX * this.sensitivity;
        this.phi -= movementY * this.sensitivity;
        
        // Clamp vertical rotation
        this.phi = Math.max(this.minPhi, Math.min(this.maxPhi, this.phi));
    }
    
    setAiming(aiming) {
        this.isAiming = aiming;
    }
    
    update(deltaTime) {
        if (!this.target) return;
        
        // Smooth transition between normal and aim mode
        const targetDistance = this.isAiming ? this.aimDistance : this.distance;
        const targetOffset = this.isAiming ? this.aimOffset : this.offset;
        
        this.currentDistance = THREE.MathUtils.lerp(
            this.currentDistance,
            targetDistance,
            this.smoothFactor
        );
        
        this.currentOffset.lerp(targetOffset, this.smoothFactor);
        
        // Calculate camera position
        const targetPosition = this.target.position.clone();
        targetPosition.add(this.currentOffset);
        
        // Spherical coordinates to Cartesian
        const offsetX = this.currentDistance * Math.sin(this.phi) * Math.cos(this.theta);
        const offsetY = this.currentDistance * Math.cos(this.phi);
        const offsetZ = this.currentDistance * Math.sin(this.phi) * Math.sin(this.theta);
        
        const desiredPosition = targetPosition.clone().add(
            new THREE.Vector3(offsetX, offsetY, offsetZ)
        );
        
        // Check for collisions and adjust camera if needed
        const adjustedPosition = this.checkCameraCollision(targetPosition, desiredPosition);
        
        // Smooth camera movement
        this.camera.position.lerp(adjustedPosition, this.smoothFactor);
        
        // Always look at target
        this.camera.lookAt(targetPosition);
        
        // Update player rotation to match camera yaw (for movement direction)
        if (this.target.userData.controller) {
            this.target.userData.controller.cameraRotation = this.theta;
        }
    }
    
    checkCameraCollision(target, desiredPosition) {
        // Cast ray from target to desired camera position
        const direction = desiredPosition.clone().sub(target).normalize();
        const distance = target.distanceTo(desiredPosition);
        
        this.raycaster.set(target, direction);
        this.raycaster.far = distance;
        
        const intersects = this.raycaster.intersectObjects(this.collisionObjects, true);
        
        if (intersects.length > 0) {
            // Place camera slightly in front of collision point
            const collisionPoint = intersects[0].point;
            return collisionPoint.add(direction.multiplyScalar(-0.2));
        }
        
        return desiredPosition;
    }
    
    addCollisionObject(object) {
        this.collisionObjects.push(object);
    }
    
    getForwardVector() {
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(this.camera.quaternion);
        forward.y = 0; // Keep horizontal
        forward.normalize();
        return forward;
    }
    
    getRightVector() {
        const right = new THREE.Vector3(1, 0, 0);
        right.applyQuaternion(this.camera.quaternion);
        right.y = 0;
        right.normalize();
        return right;
    }
}
```

### Shooting Mechanics (Raycasting + Projectile Physics)

**Weapon.js:**
```javascript
// /js/gameplay/Weapon.js
import * as THREE from 'three';
import { Projectile } from './Projectile.js';

export class Weapon {
    constructor(data, owner) {
        this.data = data; // Weapon stats from config
        this.owner = owner;
        
        // Properties
        this.name = data.name;
        this.type = data.type; // 'hitscan' or 'projectile'
        this.damage = data.damage;
        this.fireRate = data.fireRate; // Rounds per minute
        this.magazineSize = data.magazineSize;
        this.reloadTime = data.reloadTime;
        this.range = data.range;
        this.bloom = data.bloom; // Spread
        this.recoil = data.recoil;
        this.rarity = data.rarity;
        
        // State
        this.currentAmmo = this.magazineSize;
        this.reserveAmmo = data.maxAmmo;
        this.isReloading = false;
        this.lastFireTime = 0;
        this.reloadStartTime = 0;
        
        // Fire rate limiter
        this.timeBetweenShots = 60000 / this.fireRate; // Convert RPM to ms
        
        // Raycaster for hitscan
        this.raycaster = new THREE.Raycaster();
        this.raycaster.far = this.range;
        
        // VFX
        this.muzzleFlash = null;
        this.bulletTracer = null;
    }
    
    canFire() {
        const now = performance.now();
        return (
            !this.isReloading &&
            this.currentAmmo > 0 &&
            (now - this.lastFireTime) >= this.timeBetweenShots
        );
    }
    
    fire(camera, scene, targets) {
        if (!this.canFire()) return null;
        
        this.currentAmmo--;
        this.lastFireTime = performance.now();
        
        // Play sound
        this.playFireSound();
        
        // Apply recoil to camera
        this.applyRecoil(camera);
        
        // Show muzzle flash
        this.showMuzzleFlash();
        
        if (this.type === 'hitscan') {
            return this.fireHitscan(camera, targets);
        } else {
            return this.fireProjectile(camera, scene);
        }
    }
    
    fireHitscan(camera, targets) {
        // Calculate shot direction with bloom
        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyQuaternion(camera.quaternion);
        
        // Add random spread (bloom)
        const spreadX = (Math.random() - 0.5) * this.bloom;
        const spreadY = (Math.random() - 0.5) * this.bloom;
        direction.x += spreadX;
        direction.y += spreadY;
        direction.normalize();
        
        // Raycast
        this.raycaster.set(camera.position, direction);
        const intersects = this.raycaster.intersectObjects(targets, true);
        
        let hitResult = null;
        
        if (intersects.length > 0) {
            const hit = intersects[0];
            hitResult = {
                hit: true,
                point: hit.point,
                object: hit.object,
                distance: hit.distance
            };
            
            // Check if hit player
            if (hit.object.userData.type === 'player') {
                const isHeadshot = this.checkHeadshot(hit.point, hit.object);
                const damage = isHeadshot ? this.damage * 2 : this.damage;
                
                hitResult.damage = damage;
                hitResult.isHeadshot = isHeadshot;
                hitResult.playerId = hit.object.userData.playerId;
            }
            
            // Show bullet tracer
            this.showBulletTracer(camera.position, hit.point);
            
            // Show hit effect
            this.showHitEffect(hit.point, hit.face.normal);
        } else {
            // Missed - tracer to max range
            const endPoint = camera.position.clone().add(direction.multiplyScalar(this.range));
            this.showBulletTracer(camera.position, endPoint);
        }
        
        return hitResult;
    }
    
    fireProjectile(camera, scene) {
        // Create projectile
        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyQuaternion(camera.quaternion);
        
        // Add bloom
        const spreadX = (Math.random() - 0.5) * this.bloom;
        const spreadY = (Math.random() - 0.5) * this.bloom;
        direction.x += spreadX;
        direction.y += spreadY;
        direction.normalize();
        
        const projectile = new Projectile({
            position: camera.position.clone(),
            direction: direction,
            speed: this.data.projectileSpeed || 100,
            damage: this.damage,
            gravity: this.data.projectileGravity || 0,
            owner: this.owner
        });
        
        scene.add(projectile.mesh);
        
        return { projectile };
    }
    
    applyRecoil(camera) {
        // Simple recoil - kick camera up and slightly random horizontal
        const recoilY = this.recoil * (0.8 + Math.random() * 0.4);
        const recoilX = (Math.random() - 0.5) * this.recoil * 0.5;
        
        if (camera.phi !== undefined) {
            camera.phi += recoilY;
            camera.theta += recoilX;
        }
    }
    
    reload() {
        if (this.isReloading || this.currentAmmo === this.magazineSize) return;
        
        this.isReloading = true;
        this.reloadStartTime = performance.now();
        
        // Play reload sound
        this.playReloadSound();
        
        setTimeout(() => {
            const ammoNeeded = this.magazineSize - this.currentAmmo;
            const ammoToReload = Math.min(ammoNeeded, this.reserveAmmo);
            
            this.currentAmmo += ammoToReload;
            this.reserveAmmo -= ammoToReload;
            this.isReloading = false;
        }, this.reloadTime);
    }
    
    checkHeadshot(hitPoint, playerObject) {
        // Check if hit point is in headshot zone
        const headPosition = playerObject.position.clone();
        headPosition.y += 1.6; // Approximate head height
        
        const distance = hitPoint.distanceTo(headPosition);
        return distance < 0.3; // 30cm radius for headshot
    }
    
    showMuzzleFlash() {
        // Create temporary muzzle flash sprite
        // Implementation depends on VFX system
    }
    
    showBulletTracer(start, end) {
        // Create line from muzzle to hit point
        // Fade out quickly (50-100ms)
    }
    
    showHitEffect(point, normal) {
        // Spawn particle effect at hit location
    }
    
    playFireSound() {
        // Trigger audio system
    }
    
    playReloadSound() {
        // Trigger audio system
    }
}
```

**Projectile.js:**
```javascript
// /js/gameplay/Projectile.js
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Projectile {
    constructor(config) {
        this.position = config.position.clone();
        this.direction = config.direction.clone();
        this.speed = config.speed;
        this.damage = config.damage;
        this.gravity = config.gravity;
        this.owner = config.owner;
        this.maxLifetime = config.maxLifetime || 5; // seconds
        this.createdAt = performance.now();
        
        // Visual mesh
        this.mesh = this.createMesh();
        this.mesh.position.copy(this.position);
        
        // Physics body
        this.body = new CANNON.Body({
            mass: 0.01,
            shape: new CANNON.Sphere(0.05),
            material: new CANNON.Material(),
            linearDamping: 0.0,
            angularDamping: 0.0
        });
        this.body.position.copy(this.position);
        this.body.velocity.set(
            this.direction.x * this.speed,
            this.direction.y * this.speed,
            this.direction.z * this.speed
        );
        
        // Collision callback
        this.body.addEventListener('collide', this.onCollision.bind(this));
        
        this.isActive = true;
        this.hasHit = false;
    }
    
    createMesh() {
        const geometry = new THREE.SphereGeometry(0.05, 8, 8);
        const material = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            emissive: 0xffff00,
            emissiveIntensity: 2
        });
        return new THREE.Mesh(geometry, material);
    }
    
    update(deltaTime) {
        if (!this.isActive) return;
        
        // Check lifetime
        const age = (performance.now() - this.createdAt) / 1000;
        if (age > this.maxLifetime) {
            this.destroy();
            return;
        }
        
        // Sync mesh with physics body
        this.mesh.position.copy(this.body.position);
        
        // Trail effect (optional)
        this.updateTrail();
    }
    
    onCollision(event) {
        if (this.hasHit) return;
        this.hasHit = true;
        
        const hitObject = event.body.threeMesh;
        
        if (hitObject && hitObject.userData.type === 'player') {
            // Check if not owner
            if (hitObject.userData.playerId !== this.owner.id) {
                // Deal damage
                const hitResult = {
                    damage: this.damage,
                    playerId: hitObject.userData.playerId,
                    point: this.body.position.clone()
                };
                
                // Emit damage event
                this.owner.game.emit('playerDamaged', hitResult);
            }
        }
        
        // Spawn impact effect
        this.spawnImpactEffect();
        
        this.destroy();
    }
    
    spawnImpactEffect() {
        // Create small explosion particle effect
    }
    
    updateTrail() {
        // Optional: add trail renderer
    }
    
    destroy() {
        this.isActive = false;
        // Remove from scene and physics world
    }
}
```

### Building System

**BuildingSystem.js:**
```javascript
// /js/gameplay/BuildingSystem.js
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class BuildingSystem {
    constructor(scene, physics, player) {
        this.scene = scene;
        this.physics = physics;
        this.player = player;
        
        this.buildModes = ['wall', 'floor', 'ramp', 'roof'];
        this.currentBuildMode = 'wall';
        this.currentMaterial = 'wood'; // wood, stone, metal
        
        this.isBuilding = false;
        this.ghostPiece = null;
        this.placementValid = false;
        
        // Grid snapping
        this.gridSize = 2; // 2 meter grid
        
        // Building costs
        this.costs = {
            wall: 10,
            floor: 10,
            ramp: 10,
            roof: 10
        };
        
        // Material properties
        this.materialProps = {
            wood: { hp: 150, buildTime: 4 },
            stone: { hp: 300, buildTime: 7 },
            metal: { hp: 500, buildTime: 10 }
        };
        
        // Placed structures
        this.structures = [];
        
        this.setupGhostPieces();
    }
    
    setupGhostPieces() {
        // Create semi-transparent preview meshes
        this.ghostMeshes = {};
        
        // Wall
        const wallGeo = new THREE.BoxGeometry(this.gridSize, this.gridSize, 0.2);
        this.ghostMeshes.wall = this.createGhostMesh(wallGeo);
        
        // Floor
        const floorGeo = new THREE.BoxGeometry(this.gridSize, 0.2, this.gridSize);
        this.ghostMeshes.floor = this.createGhostMesh(floorGeo);
        
        // Ramp
        const rampGeo = this.createRampGeometry();
        this.ghostMeshes.ramp = this.createGhostMesh(rampGeo);
        
        // Roof (pyramid)
        const roofGeo = new THREE.ConeGeometry(this.gridSize / 1.4, this.gridSize / 2, 4);
        this.ghostMeshes.roof = this.createGhostMesh(roofGeo);
    }
    
    createGhostMesh(geometry) {
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.visible = false;
        this.scene.add(mesh);
        return mesh;
    }
    
    createRampGeometry() {
        const geometry = new THREE.BufferGeometry();
        const vertices = new Float32Array([
            // Front face (low)
            -1, 0, 1,  1, 0, 1,  1, 2, -1,
            -1, 0, 1,  1, 2, -1, -1, 2, -1,
            // Back face
            -1, 0, -1, 1, 2, -1, 1, 0, -1,
            -1, 0, -1, -1, 2, -1, 1, 2, -1,
            // Left side
            -1, 0, 1,  -1, 2, -1, -1, 0, -1,
            // Right side
            1, 0, 1,   1, 0, -1,  1, 2, -1,
            // Bottom
            -1, 0, 1,  -1, 0, -1, 1, 0, -1,
            -1, 0, 1,  1, 0, -1,  1, 0, 1
        ]);
        
        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        geometry.computeVertexNormals();
        return geometry;
    }
    
    enterBuildMode() {
        this.isBuilding = true;
        this.ghostPiece = this.ghostMeshes[this.currentBuildMode];
        this.ghostPiece.visible = true;
    }
    
    exitBuildMode() {
        this.isBuilding = false;
        if (this.ghostPiece) {
            this.ghostPiece.visible = false;
        }
    }
    
    switchBuildMode(mode) {
        if (!this.buildModes.includes(mode)) return;
        
        if (this.ghostPiece) {
            this.ghostPiece.visible = false;
        }
        
        this.currentBuildMode = mode;
        this.ghostPiece = this.ghostMeshes[mode];
        
        if (this.isBuilding) {
            this.ghostPiece.visible = true;
        }
    }
    
    update(camera) {
        if (!this.isBuilding || !this.ghostPiece) return;
        
        // Calculate placement position
        const placement = this.calculatePlacement(camera);
        
        if (placement) {
            this.ghostPiece.position.copy(placement.position);
            this.ghostPiece.rotation.copy(placement.rotation);
            
            // Check if placement is valid
            this.placementValid = this.checkPlacementValid(placement);
            
            // Update ghost color
            this.ghostPiece.material.color.setHex(
                this.placementValid ? 0x00ff00 : 0xff0000
            );
        }
    }
    
    calculatePlacement(camera) {
        // Raycast from camera
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
        
        // Check intersection with existing structures or terrain
        const intersects = raycaster.intersectObjects([
            ...this.structures.map(s => s.mesh),
            this.scene.getObjectByName('terrain')
        ], true);
        
        if (intersects.length === 0) return null;
        
        const hit = intersects[0];
        const normal = hit.face.normal.clone();
        
        // Snap to grid
        const snappedPos = this.snapToGrid(hit.point);
        
        // Determine rotation based on normal
        const rotation = this.calculateRotationFromNormal(normal);
        
        return {
            position: snappedPos,
            rotation: rotation,
            attachedTo: hit.object
        };
    }
    
    snapToGrid(position) {
        return new THREE.Vector3(
            Math.round(position.x / this.gridSize) * this.gridSize,
            Math.round(position.y / this.gridSize) * this.gridSize,
            Math.round(position.z / this.gridSize) * this.gridSize
        );
    }
    
    calculateRotationFromNormal(normal) {
        const rotation = new THREE.Euler();
        
        if (Math.abs(normal.y) > 0.9) {
            // Horizontal surface - place upright
            rotation.set(0, 0, 0);
        } else if (Math.abs(normal.x) > 0.9) {
            // Vertical X surface
            rotation.set(0, Math.PI / 2, 0);
        } else {
            // Vertical Z surface
            rotation.set(0, 0, 0);
        }
        
        return rotation;
    }
    
    checkPlacementValid(placement) {
        // Check if player has resources
        const cost = this.costs[this.currentBuildMode];
        if (this.player.resources[this.currentMaterial] < cost) {
            return false;
        }
        
        // Check for overlapping structures
        const bbox = new THREE.Box3().setFromObject(this.ghostPiece);
        
        for (const structure of this.structures) {
            const structureBbox = new THREE.Box3().setFromObject(structure.mesh);
            if (bbox.intersectsBox(structureBbox)) {
                return false;
            }
        }
        
        return true;
    }
    
    placeBuild() {
        if (!this.placementValid) return false;
        
        // Deduct resources
        const cost = this.costs[this.currentBuildMode];
        this.player.resources[this.currentMaterial] -= cost;
        
        // Create actual structure
        const structure = this.createStructure(
            this.currentBuildMode,
            this.ghostPiece.position.clone(),
            this.ghostPiece.rotation.clone()
        );
        
        this.structures.push(structure);
        this.scene.add(structure.mesh);
        this.physics.addBody(structure.id, structure.body);
        
        // Play build sound
        this.playBuildSound();
        
        // Network: send build event
        this.player.game.network.send({
            type: 'build',
            buildType: this.currentBuildMode,
            position: structure.mesh.position,
            rotation: structure.mesh.rotation
        });
        
        return true;
    }
    
    createStructure(type, position, rotation) {
        const id = `structure_${Date.now()}_${Math.random()}`;
        
        // Create mesh (same geometry as ghost, but solid material)
        const geometry = this.ghostMeshes[type].geometry.clone();
        const material = new THREE.MeshStandardMaterial({
            color: this.getMaterialColor(this.currentMaterial),
            roughness: 0.8,
            metalness: this.currentMaterial === 'metal' ? 0.7 : 0.1
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);
        mesh.rotation.copy(rotation);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = {
            type: 'structure',
            buildType: type,
            id: id
        };
        
        // Create physics body
        const shape = this.createPhysicsShape(type);
        const body = new CANNON.Body({
            mass: 0, // Static
            shape: shape,
            material: this.physics.materials.building
        });
        body.position.copy(position);
        body.quaternion.copy(mesh.quaternion);
        
        // Structure properties
        const props = this.materialProps[this.currentMaterial];
        const structure = {
            id,
            mesh,
            body,
            type,
            material: this.currentMaterial,
            hp: props.hp,
            maxHp: props.hp,
            buildTime: props.buildTime,
            builtAt: performance.now(),
            isBuilding: true
        };
        
        // Start build animation (HP increases over time)
        this.animateBuild(structure);
        
        return structure;
    }
    
    createPhysicsShape(type) {
        switch(type) {
            case 'wall':
                return new CANNON.Box(new CANNON.Vec3(1, 1, 0.1));
            case 'floor':
                return new CANNON.Box(new CANNON.Vec3(1, 0.1, 1));
            case 'ramp':
                // Approximate with box (or use ConvexPolyhedron for accuracy)
                return new CANNON.Box(new CANNON.Vec3(1, 1, 1));
            case 'roof':
                return new CANNON.Box(new CANNON.Vec3(1, 0.5, 1));
            default:
                return new CANNON.Box(new CANNON.Vec3(1, 1, 1));
        }
    }
    
    animateBuild(structure) {
        const interval = setInterval(() => {
            if (!structure.isBuilding) {
                clearInterval(interval);
                return;
            }
            
            const elapsed = (performance.now() - structure.builtAt) / 1000;
            const progress = Math.min(elapsed / structure.buildTime, 1);
            
            structure.hp = structure.maxHp * progress;
            
            // Update visual (optional: scale up or change opacity)
            structure.mesh.scale.setScalar(0.5 + 0.5 * progress);
            
            if (progress >= 1) {
                structure.isBuilding = false;
                clearInterval(interval);
            }
        }, 100);
    }
    
    getMaterialColor(material) {
        switch(material) {
            case 'wood': return 0x8B4513;
            case 'stone': return 0x808080;
            case 'metal': return 0x5C5C5C;
            default: return 0xFFFFFF;
        }
    }
    
    damageStructure(structureId, damage) {
        const structure = this.structures.find(s => s.id === structureId);
        if (!structure) return;
        
        structure.hp -= damage;
        
        if (structure.hp <= 0) {
            this.destroyStructure(structure);
        } else {
            // Show damage effect
            this.showDamageEffect(structure);
        }
    }
    
    destroyStructure(structure) {
        // Remove from scene and physics
        this.scene.remove(structure.mesh);
        this.physics.removeBody(structure.id);
        
        // Remove from array
        const index = this.structures.indexOf(structure);
        if (index > -1) {
            this.structures.splice(index, 1);
        }
        
        // Spawn destruction particles
        this.spawnDestructionEffect(structure.mesh.position);
        
        // Play destruction sound
        this.playDestroySound();
    }
    
    showDamageEffect(structure) {
        // Flash red or spawn hit particles
    }
    
    spawnDestructionEffect(position) {
// Particle system for destroyed building
}playBuildSound() {
    // Audio system integration
}playDestroySound() {
    // Audio system integration
}
}
