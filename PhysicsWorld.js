// /js/engine/PhysicsWorld.js
import * as CANNON from 'cannon-es';

export class PhysicsWorld {
    constructor() {
        this.world = new CANNON.World({
            gravity: new CANNON.Vec3(0, -20, 0) // Stronger gravity for responsive feel
        });
        
        // Broadphase optimization
        this.world.broadphase = new CANNON.SAPBroadphase(this.world);
        
        // Collision groups
        this.COLLISION_GROUPS = {
            PLAYER: 1,
            BUILDING: 2,
            PROJECTILE: 4,
            TERRAIN: 8,
            LOOT: 16
        };
        
        // Allow sleeping for static objects
        this.world.allowSleep = true;
        this.world.sleepSpeedLimit = 0.1;
        this.world.sleepTimeLimit = 1;
        
        // Setup materials and contact materials
        this.setupMaterials();
        
        // Track physics bodies
        this.bodies = new Map();
    }
    
    setupMaterials() {
        // Create materials
        this.materials = {
            player: new CANNON.Material('player'),
            ground: new CANNON.Material('ground'),
            building: new CANNON.Material('building')
        };
        
        // Player-ground contact
        const playerGroundContact = new CANNON.ContactMaterial(
            this.materials.player,
            this.materials.ground,
            {
                friction: 0.4,
                restitution: 0.0 // No bouncing
            }
        );
        this.world.addContactMaterial(playerGroundContact);
        
        // Building-ground contact
        const buildingGroundContact = new CANNON.ContactMaterial(
            this.materials.building,
            this.materials.ground,
            {
                friction: 0.8,
                restitution: 0.0
            }
        );
        this.world.addContactMaterial(buildingGroundContact);
    }
    
    step(deltaTime) {
        this.world.step(deltaTime);
    }
    
    addBody(id, body) {
        this.world.addBody(body);
        this.bodies.set(id, body);
    }
    
    removeBody(id) {
        const body = this.bodies.get(id);
        if (body) {
            this.world.removeBody(body);
            this.bodies.delete(id);
        }
    }
    
    raycast(from, to, options = {}) {
        const result = new CANNON.RaycastResult();
        const ray = new CANNON.Ray(from, to);
        
        ray.intersectWorld(this.world, {
            mode: CANNON.Ray.CLOSEST,
            collisionFilterMask: options.collisionFilterMask || -1,
            result: result,
            skipBackfaces: true
        });
        
        return result;
    }
}
