// Three.js Scene Setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowShadowMap;
renderer.setClearColor(0x000000, 1);

// Create a canvas wrapper div to keep it behind start screen
const canvasContainer = document.createElement('div');
canvasContainer.id = 'canvasWrapper';
canvasContainer.style.position = 'absolute';
canvasContainer.style.top = '0';
canvasContainer.style.left = '0';
canvasContainer.style.width = '100%';
canvasContainer.style.height = '100%';
canvasContainer.style.zIndex = '1';
canvasContainer.style.pointerEvents = 'none';
canvasContainer.appendChild(renderer.domElement);
document.getElementById('gameContainer').insertBefore(canvasContainer, document.getElementById('gameContainer').firstChild);

// Front view camera - looking at characters side by side
camera.position.set(0, 2, 12);
camera.lookAt(0, 1.5, 0);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 10, 7);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
scene.add(directionalLight);

// Arena/Ground (wide along X axis)
const groundGeometry = new THREE.PlaneGeometry(30, 20);
const groundMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x2a2a2a,
    metalness: 0.3,
    roughness: 0.7
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Add floor pattern
const canvas = document.createElement('canvas');
canvas.width = 256;
canvas.height = 256;
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#2a2a2a';
ctx.fillRect(0, 0, 256, 256);
ctx.strokeStyle = '#444444';
ctx.lineWidth = 2;
for (let i = 0; i < 256; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 256);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(256, i);
    ctx.stroke();
}
const texture = new THREE.CanvasTexture(canvas);
groundMaterial.map = texture;
groundMaterial.needsUpdate = true;

// Game State
const gameState = {
    running: false,
    gameOver: false,
    winner: null,
    deltaTime: 0,
    lastFrameTime: Date.now()
};

const keys = {};

// Character Class - Tekken style (side by side on X axis)
class Character {
    constructor(x, color, name, isPlayer2 = false) {
        this.isPlayer2 = isPlayer2;
        this.name = name;
        this.color = color;
        
        // Position and movement (X axis for side to side - left/right)
        this.position = new THREE.Vector3(x, 0, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.moveSpeed = 0.2;
        this.jumpPower = 0.8;
        this.isJumping = false;
        this.isGrounded = true;
        this.isCrouching = false;
        this.crouchHeight = 0.5;
        
        // Combat stats
        this.maxHealth = 100;
        this.health = 100;
        this.stamina = 100;
        this.maxStamina = 100;
        
        // Attack state
        this.isAttacking = false;
        this.attackCooldown = 0;
        this.attackType = null;
        this.comboCounter = 0;
        this.comboLastAttackTime = 0;
        
        // Model
        this.createModel();
    }
    
    createModel() {
        this.group = new THREE.Group();
        
        // Head
        const headGeometry = new THREE.SphereGeometry(0.3, 32, 32);
        const skinMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xffdbac,
            metalness: 0.1,
            roughness: 0.8
        });
        this.head = new THREE.Mesh(headGeometry, skinMaterial);
        this.head.position.y = 1.6;
        this.head.castShadow = true;
        this.head.receiveShadow = true;
        this.group.add(this.head);
        
        // Body Material
        const bodyMaterial = new THREE.MeshStandardMaterial({ 
            color: this.color,
            metalness: 0.2,
            roughness: 0.8
        });
        
        // Torso
        const torsoGeometry = new THREE.BoxGeometry(0.5, 1.1, 0.35);
        this.torso = new THREE.Mesh(torsoGeometry, bodyMaterial);
        this.torso.position.y = 0.85;
        this.torso.castShadow = true;
        this.torso.receiveShadow = true;
        this.group.add(this.torso);
        
        // Neck
        const neckGeometry = new THREE.CylinderGeometry(0.15, 0.2, 0.2, 16);
        const neckMesh = new THREE.Mesh(neckGeometry, bodyMaterial);
        neckMesh.position.y = 1.5;
        neckMesh.castShadow = true;
        this.group.add(neckMesh);
        
        // Left Arm
        const armGeometry = new THREE.CylinderGeometry(0.12, 0.1, 0.95, 16);
        this.leftArm = new THREE.Mesh(armGeometry, bodyMaterial);
        this.leftArm.position.set(-0.4, 0.9, 0);
        this.leftArm.rotation.z = 0.3;
        this.leftArm.castShadow = true;
        this.leftArm.receiveShadow = true;
        this.group.add(this.leftArm);
        
        // Right Arm
        this.rightArm = new THREE.Mesh(armGeometry, bodyMaterial);
        this.rightArm.position.set(0.4, 0.9, 0);
        this.rightArm.rotation.z = -0.3;
        this.rightArm.castShadow = true;
        this.rightArm.receiveShadow = true;
        this.group.add(this.rightArm);
        
        // Left Leg
        const legGeometry = new THREE.CylinderGeometry(0.15, 0.12, 0.95, 16);
        this.leftLeg = new THREE.Mesh(legGeometry, bodyMaterial);
        this.leftLeg.position.set(-0.2, 0.3, 0);
        this.leftLeg.castShadow = true;
        this.leftLeg.receiveShadow = true;
        this.group.add(this.leftLeg);
        
        // Right Leg
        this.rightLeg = new THREE.Mesh(legGeometry, bodyMaterial);
        this.rightLeg.position.set(0.2, 0.3, 0);
        this.rightLeg.castShadow = true;
        this.rightLeg.receiveShadow = true;
        this.group.add(this.rightLeg);
        
        // Hands (small spheres)
        const handGeometry = new THREE.SphereGeometry(0.1, 16, 16);
        const leftHand = new THREE.Mesh(handGeometry, skinMaterial);
        leftHand.position.set(-0.4, 0.2, 0);
        leftHand.castShadow = true;
        this.group.add(leftHand);
        
        const rightHand = new THREE.Mesh(handGeometry, skinMaterial);
        rightHand.position.set(0.4, 0.2, 0);
        rightHand.castShadow = true;
        this.group.add(rightHand);
        
        // Feet (small boxes)
        const footGeometry = new THREE.BoxGeometry(0.12, 0.1, 0.25);
        const leftFoot = new THREE.Mesh(footGeometry, bodyMaterial);
        leftFoot.position.set(-0.2, -0.05, 0.1);
        leftFoot.castShadow = true;
        this.group.add(leftFoot);
        
        const rightFoot = new THREE.Mesh(footGeometry, bodyMaterial);
        rightFoot.position.set(0.2, -0.05, 0.1);
        rightFoot.castShadow = true;
        this.group.add(rightFoot);
        
        this.group.position.copy(this.position);
        scene.add(this.group);
        
        // Animation state
        this.animationState = 'idle';
    }
    
    getInput() {
        if (!gameState.running) return;
        
        let moveForward = false;
        let moveBackward = false;
        let jump = false;
        let crouch = false;
        let attackWeak = false;
        let attackStrong = false;
        
        if (this.isPlayer2) {
            // Player 2: WASD (W backward, S forward)
            if (keys['w'] || keys['W']) moveBackward = true;
            if (keys['s'] || keys['S']) moveForward = true;
            if (keys['a'] || keys['A']) crouch = true;
            if (keys['o'] || keys['O']) attackWeak = true;
            if (keys['p'] || keys['P']) attackStrong = true;
            if (keys[' ']) jump = true;
        } else {
            // Player 1: Arrow keys (Up forward, Down backward)
            if (keys['ArrowUp']) moveForward = true;
            if (keys['ArrowDown']) moveBackward = true;
            if (keys['ArrowLeft']) crouch = true;
            if (keys['z'] || keys['Z']) attackWeak = true;
            if (keys['x'] || keys['X']) attackStrong = true;
            if (keys[' ']) jump = true;
        }
        
        this.move(moveForward, moveBackward);
        
        if (crouch && this.isGrounded && !this.isJumping) {
            this.crouch();
        } else if (!crouch) {
            this.isCrouching = false;
        }
        
        if (jump && this.isGrounded && !this.isCrouching) {
            this.jump();
        }
        
        if (attackWeak) {
            this.attack('weak');
        }
        
        if (attackStrong) {
            this.attack('strong');
        }
    }
    
    move(forward, backward) {
        if (this.isAttacking || this.isCrouching) {
            this.velocity.x = 0;
            this.animationState = 'idle';
            return;
        }
        
        if (forward) {
            // Player 1 goes right (positive X), Player 2 goes left (negative X)
            this.velocity.x = this.moveSpeed * (this.isPlayer2 ? -1 : 1);
            this.animationState = 'running';
        } else if (backward) {
            this.velocity.x = -this.moveSpeed * (this.isPlayer2 ? -1 : 1);
            this.animationState = 'running_back';
        } else {
            this.velocity.x = 0;
            this.animationState = 'idle';
        }
    }
    
    crouch() {
        this.isCrouching = true;
        this.animationState = 'crouch';
    }
    
    jump() {
        this.velocity.y = this.jumpPower;
        this.isJumping = true;
        this.isGrounded = false;
        this.animationState = 'jump';
    }
    
    attack(type) {
        const opponent = player1 === this ? player2 : player1;
        if (!opponent) return;
        
        const now = Date.now();
        if (this.attackCooldown > 0) return;
        
        if (now - this.comboLastAttackTime < 500) {
            this.comboCounter++;
        } else {
            this.comboCounter = 1;
        }
        
        this.comboLastAttackTime = now;
        this.isAttacking = true;
        this.attackType = type;
        this.animationState = type === 'weak' ? 'attack_weak' : 'attack_strong';
        
        const damage = type === 'weak' ? 5 : 15;
        const staminaCost = type === 'weak' ? 5 : 15;
        const cooldown = type === 'weak' ? 300 : 500;
        
        if (this.stamina < staminaCost) return;
        
        this.stamina = Math.max(0, this.stamina - staminaCost);
        this.attackCooldown = cooldown;
        
        // Check for hit (on X axis distance)
        const distance = Math.abs(this.position.x - opponent.position.x);
        const hitRange = 1.5;
        
        if (distance < hitRange) {
            const damageWithCombo = damage + (this.comboCounter - 1) * 2;
            opponent.takeDamage(damageWithCombo, this.comboCounter);
        }
        
        setTimeout(() => {
            this.isAttacking = false;
        }, 200);
    }
    
    takeDamage(amount, comboCount = 1) {
        this.health = Math.max(0, this.health - amount);
        
        if (this.health <= 0) {
            gameState.gameOver = true;
            gameState.winner = this.isPlayer2 ? 'Player 1' : 'Player 2';
        }
    }
    
    update(deltaTime) {
        // Gravity
        this.velocity.y -= 0.02;
        
        // Ground collision
        if (this.position.y <= 0) {
            this.position.y = 0;
            this.velocity.y = 0;
            this.isGrounded = true;
            this.isJumping = false;
        } else {
            this.isGrounded = false;
        }
        
        // Update position
        this.position.y += this.velocity.y;
        this.position.x += this.velocity.x;
        
        // Keep within arena bounds (X axis)
        const maxX = 12;
        this.position.x = Math.max(-maxX, Math.min(maxX, this.position.x));
        
        // Cooldowns
        if (this.attackCooldown > 0) {
            this.attackCooldown -= deltaTime;
        }
        
        // Stamina regeneration
        this.stamina = Math.min(this.maxStamina, this.stamina + 0.3);
        
        // Update group position
        this.group.position.copy(this.position);
        
        // Update character height if crouching
        if (this.isCrouching) {
            this.group.scale.y = this.crouchHeight;
        } else {
            this.group.scale.y = 1;
        }
        
        // Animation
        this.updateAnimation();
    }
    
    updateAnimation() {
        const time = Date.now() * 0.001;
        
        // Reset rotations
        this.rightArm.rotation.z = -0.3;
        this.leftArm.rotation.z = 0.3;
        this.rightLeg.rotation.x = 0;
        this.leftLeg.rotation.x = 0;
        
        switch (this.animationState) {
            case 'idle':
                this.rightArm.rotation.z = -0.3 + Math.sin(time * 2) * 0.1;
                this.leftArm.rotation.z = 0.3 - Math.sin(time * 2) * 0.1;
                break;
                
            case 'running':
                this.rightArm.rotation.z = -0.3 + Math.sin(time * 6) * 0.4;
                this.leftArm.rotation.z = 0.3 - Math.sin(time * 6) * 0.4;
                this.rightLeg.rotation.x = Math.sin(time * 6) * 0.5;
                this.leftLeg.rotation.x = -Math.sin(time * 6) * 0.5;
                break;
                
            case 'running_back':
                this.rightArm.rotation.z = -0.3 - Math.sin(time * 6) * 0.4;
                this.leftArm.rotation.z = 0.3 + Math.sin(time * 6) * 0.4;
                this.rightLeg.rotation.x = -Math.sin(time * 6) * 0.5;
                this.leftLeg.rotation.x = Math.sin(time * 6) * 0.5;
                break;
                
            case 'jump':
                this.rightArm.rotation.z = -0.8;
                this.leftArm.rotation.z = 0.8;
                break;
                
            case 'crouch':
                this.rightArm.rotation.z = -0.1;
                this.leftArm.rotation.z = 0.1;
                break;
                
            case 'attack_weak':
                this.rightArm.rotation.z = -1.2;
                this.torso.rotation.x = 0.1;
                break;
                
            case 'attack_strong':
                this.rightArm.rotation.z = -1.5;
                this.torso.rotation.x = 0.2;
                break;
        }
    }
}

// Create players
let player1, player2;

// Input handling
document.addEventListener('keydown', (e) => {
    keys[e.key] = true;
});

document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

// Start game
document.getElementById('startButton').addEventListener('click', () => {
    document.getElementById('startScreen').classList.add('hidden');
    gameState.running = true;
    gameState.gameOver = false;
    gameState.winner = null;
    
    // Clear existing scene
    if (player1) scene.remove(player1.group);
    if (player2) scene.remove(player2.group);
    
    // Create new players - positioned on X axis (side by side)
    player1 = new Character(-5, 0x0066ff, 'Kazuya');
    player2 = new Character(5, 0xff3333, 'Jin', true);
    
    player1.health = 100;
    player2.health = 100;
    player1.stamina = 100;
    player2.stamina = 100;
    
    updateHUD();
    document.getElementById('gameStatus').textContent = '경기 시작!';
});

// HUD Update
function updateHUD() {
    if (!player1 || !player2) return;
    
    const p1HealthPercent = (player1.health / player1.maxHealth) * 100;
    const p2HealthPercent = (player2.health / player2.maxHealth) * 100;
    
    document.getElementById('p1Health').style.width = p1HealthPercent + '%';
    document.getElementById('p2Health').style.width = p2HealthPercent + '%';
    
    document.getElementById('p1HealthText').textContent = Math.ceil(player1.health) + '/' + player1.maxHealth;
    document.getElementById('p2HealthText').textContent = Math.ceil(player2.health) + '/' + player2.maxHealth;
    
    if (gameState.gameOver) {
        document.getElementById('gameStatus').textContent = gameState.winner + ' 승리! (새로고침으로 재시작)';
        document.getElementById('gameStatus').style.color = '#ffff00';
    } else if (gameState.running) {
        document.getElementById('gameStatus').textContent = 'Fight!';
    }
}

// Game loop
function animate() {
    requestAnimationFrame(animate);
    
    const now = Date.now();
    const deltaTime = now - gameState.lastFrameTime;
    gameState.lastFrameTime = now;
    
    if (gameState.running && !gameState.gameOver) {
        if (player1 && player2) {
            player1.getInput();
            player2.getInput();
            
            player1.update(deltaTime);
            player2.update(deltaTime);
            
            updateHUD();
        }
    }
    
    // Camera follows center on X axis
    if (player1 && player2) {
        const centerX = (player1.position.x + player2.position.x) / 2;
        camera.position.x = centerX;
        camera.position.set(centerX, 2, 12);
        camera.lookAt(centerX, 1.5, 0);
    }
    
    renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start animation loop
animate();
