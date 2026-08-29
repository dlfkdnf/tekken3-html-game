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
canvasContainer.appendChild(renderer.domElement);
document.getElementById('gameContainer').insertBefore(canvasContainer, document.getElementById('gameContainer').firstChild);

camera.position.set(0, 5, 15);
camera.lookAt(0, 2, 0);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 10, 7);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
scene.add(directionalLight);

// Arena/Ground
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

// Background walls
const wallGeometry = new THREE.PlaneGeometry(30, 15);
const wallMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x1a1a1a,
    metalness: 0.2,
    roughness: 0.8
});

const backWall = new THREE.Mesh(wallGeometry, wallMaterial);
backWall.position.set(0, 7.5, -10);
scene.add(backWall);

const frontWall = new THREE.Mesh(wallGeometry, wallMaterial);
frontWall.position.set(0, 7.5, 10);
scene.add(frontWall);

// Game State
const gameState = {
    running: false,
    gameOver: false,
    winner: null
};

const keys = {};

// Character Class
class Character {
    constructor(x, color, name, isPlayer2 = false) {
        this.isPlayer2 = isPlayer2;
        this.name = name;
        this.color = color;
        
        // Position and movement
        this.position = new THREE.Vector3(x, 0, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.moveSpeed = 0.15;
        this.jumpPower = 0.5;
        this.isJumping = false;
        this.isGrounded = false;
        
        // Combat stats
        this.maxHealth = 100;
        this.health = 100;
        this.stamina = 100;
        this.maxStamina = 100;
        
        // Attack state
        this.isAttacking = false;
        this.attackCooldown = 0;
        this.attackType = null; // 'weak' or 'strong'
        this.lastAttackTime = 0;
        this.comboCounter = 0;
        this.comboTimeout = 0;
        
        // Defense
        this.isBlocking = false;
        this.blockCooldown = 0;
        
        // Model
        this.createModel();
    }
    
    createModel() {
        this.group = new THREE.Group();
        
        // Body (Torso)
        const bodyGeometry = new THREE.BoxGeometry(0.6, 1.0, 0.3);
        const bodyMaterial = new THREE.MeshStandardMaterial({ 
            color: this.color,
            metalness: 0.2,
            roughness: 0.8
        });
        this.body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        this.body.position.y = 0.5;
        this.body.castShadow = true;
        this.body.receiveShadow = true;
        this.group.add(this.body);
        
        // Head
        const headGeometry = new THREE.SphereGeometry(0.25, 32, 32);
        const headMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xffdbac,
            metalness: 0.1,
            roughness: 0.9
        });
        this.head = new THREE.Mesh(headGeometry, headMaterial);
        this.head.position.y = 1.4;
        this.head.castShadow = true;
        this.head.receiveShadow = true;
        this.group.add(this.head);
        
        // Left Arm
        const armGeometry = new THREE.BoxGeometry(0.2, 0.9, 0.2);
        this.leftArm = new THREE.Mesh(armGeometry, bodyMaterial);
        this.leftArm.position.set(-0.4, 0.7, 0);
        this.leftArm.castShadow = true;
        this.leftArm.receiveShadow = true;
        this.group.add(this.leftArm);
        
        // Right Arm
        this.rightArm = new THREE.Mesh(armGeometry, bodyMaterial);
        this.rightArm.position.set(0.4, 0.7, 0);
        this.rightArm.castShadow = true;
        this.rightArm.receiveShadow = true;
        this.group.add(this.rightArm);
        
        // Left Leg
        const legGeometry = new THREE.BoxGeometry(0.2, 0.8, 0.2);
        this.leftLeg = new THREE.Mesh(legGeometry, bodyMaterial);
        this.leftLeg.position.set(-0.2, 0, 0);
        this.leftLeg.castShadow = true;
        this.leftLeg.receiveShadow = true;
        this.group.add(this.leftLeg);
        
        // Right Leg
        this.rightLeg = new THREE.Mesh(legGeometry, bodyMaterial);
        this.rightLeg.position.set(0.2, 0, 0);
        this.rightLeg.castShadow = true;
        this.rightLeg.receiveShadow = true;
        this.group.add(this.rightLeg);
        
        this.group.position.copy(this.position);
        scene.add(this.group);
        
        // Animation state
        this.animationState = 'idle';
        this.animationFrame = 0;
    }
    
    getInput() {
        if (!gameState.running) return;
        
        let moveX = 0;
        let moveZ = 0;
        let attackWeak = false;
        let attackStrong = false;
        let jump = false;
        
        if (this.isPlayer2) {
            // Player 2 controls (WASD + O/P)
            if (keys['w'] || keys['W']) moveZ = -1;
            if (keys['s'] || keys['S']) moveZ = 1;
            if (keys['a'] || keys['A']) moveX = -1;
            if (keys['d'] || keys['D']) moveX = 1;
            if (keys['o'] || keys['O']) attackWeak = true;
            if (keys['p'] || keys['P']) attackStrong = true;
            if (keys[' ']) jump = true;
        } else {
            // Player 1 controls (Arrow keys + Z/X)
            if (keys['ArrowUp']) moveZ = -1;
            if (keys['ArrowDown']) moveZ = 1;
            if (keys['ArrowLeft']) moveX = -1;
            if (keys['ArrowRight']) moveX = 1;
            if (keys['z'] || keys['Z']) attackWeak = true;
            if (keys['x'] || keys['X']) attackStrong = true;
            if (keys[' ']) jump = true;
        }
        
        this.move(moveX, moveZ);
        
        if (jump && this.isGrounded) {
            this.jump();
        }
        
        if (attackWeak) {
            this.attack('weak');
        }
        
        if (attackStrong) {
            this.attack('strong');
        }
    }
    
    move(x, z) {
        if (this.isAttacking) return;
        
        const moveDir = new THREE.Vector3(x, 0, z).normalize();
        
        this.velocity.x = moveDir.x * this.moveSpeed;
        this.velocity.z = moveDir.z * this.moveSpeed;
        
        // Rotate character to face movement direction
        if (moveDir.length() > 0) {
            this.group.rotation.y = Math.atan2(moveDir.x, moveDir.z);
            this.animationState = 'running';
        } else {
            this.animationState = 'idle';
        }
    }
    
    jump() {
        this.velocity.y = this.jumpPower;
        this.isJumping = true;
        this.isGrounded = false;
    }
    
    attack(type) {
        if (this.attackCooldown > 0) return;
        if (this.stamina < (type === 'weak' ? 5 : 15)) return;
        
        const now = Date.now();
        if (now - this.lastAttackTime < 200) {
            this.comboCounter++;
        } else {
            this.comboCounter = 1;
        }
        
        this.lastAttackTime = now;
        this.isAttacking = true;
        this.attackType = type;
        this.animationState = type === 'weak' ? 'attack_weak' : 'attack_strong';
        
        const damage = type === 'weak' ? 5 : 15;
        const staminaCost = type === 'weak' ? 5 : 15;
        const cooldown = type === 'weak' ? 300 : 500;
        
        this.stamina = Math.max(0, this.stamina - staminaCost);
        this.attackCooldown = cooldown;
        
        // Check for hit on opponent
        const opponent = player1 === this ? player2 : player1;
        const distance = this.position.distanceTo(opponent.position);
        const hitRange = 2.5;
        
        if (distance < hitRange) {
            const damageWithCombo = damage + (this.comboCounter - 1) * 2;
            opponent.takeDamage(damageWithCombo, this.comboCounter);
            updateHUD();
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
    
    update() {
        // Gravity
        this.velocity.y -= 0.015;
        
        // Ground collision
        if (this.position.y <= 0) {
            this.position.y = 0;
            this.velocity.y = 0;
            this.isGrounded = true;
            this.isJumping = false;
        } else {
            this.isGrounded = false;
        }
        
        // Boundary collision (keep in arena)
        const maxX = 14;
        const maxZ = 10;
        
        this.position.x = Math.max(-maxX, Math.min(maxX, this.position.x + this.velocity.x));
        this.position.y += this.velocity.y;
        this.position.z = Math.max(-maxZ, Math.min(maxZ, this.position.z + this.velocity.z));
        
        // Distance from opponent (prevent overlap)
        const opponent = player1 === this ? player2 : player1;
        const distance = this.position.distanceTo(opponent.position);
        const minDistance = 1.2;
        
        if (distance < minDistance) {
            const direction = new THREE.Vector3().subVectors(this.position, opponent.position).normalize();
            this.position.addScaledVector(direction, (minDistance - distance) * 0.5);
        }
        
        // Cooldowns
        if (this.attackCooldown > 0) this.attackCooldown--;
        if (this.blockCooldown > 0) this.blockCooldown--;
        if (this.comboTimeout > 0) {
            this.comboTimeout--;
        } else {
            this.comboCounter = 0;
        }
        this.comboTimeout = 2000; // Reset combo after 2 seconds
        
        // Stamina regeneration
        this.stamina = Math.min(this.maxStamina, this.stamina + 0.3);
        
        // Update group position
        this.group.position.copy(this.position);
        
        // Animation
        this.updateAnimation();
    }
    
    updateAnimation() {
        const time = Date.now() * 0.001;
        
        switch (this.animationState) {
            case 'idle':
                this.rightArm.rotation.x = Math.sin(time * 2) * 0.1;
                this.leftArm.rotation.x = -Math.sin(time * 2) * 0.1;
                this.rightLeg.rotation.x = 0;
                this.leftLeg.rotation.x = 0;
                break;
                
            case 'running':
                this.rightArm.rotation.x = Math.sin(time * 6) * 0.5;
                this.leftArm.rotation.x = -Math.sin(time * 6) * 0.5;
                this.rightLeg.rotation.x = Math.sin(time * 6) * 0.6;
                this.leftLeg.rotation.x = -Math.sin(time * 6) * 0.6;
                break;
                
            case 'attack_weak':
                this.rightArm.rotation.x = -1.2;
                this.rightArm.rotation.z = 0.3;
                this.body.rotation.z = 0.1;
                break;
                
            case 'attack_strong':
                this.rightArm.rotation.x = -1.5;
                this.rightArm.rotation.z = 0.5;
                this.body.rotation.z = 0.2;
                this.body.rotation.x = 0.1;
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
    console.log('Start button clicked!');
    document.getElementById('startScreen').classList.add('hidden');
    gameState.running = true;
    gameState.gameOver = false;
    gameState.winner = null;
    
    // Clear existing scene
    if (player1) scene.remove(player1.group);
    if (player2) scene.remove(player2.group);
    
    // Create new players
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
    
    if (gameState.running && !gameState.gameOver) {
        // Update players
        if (player1) player1.getInput();
        if (player2) player2.getInput();
        
        if (player1) player1.update();
        if (player2) player2.update();
        
        updateHUD();
    }
    
    // Camera follow
    if (player1 && player2) {
        const centerX = (player1.position.x + player2.position.x) / 2;
        const centerZ = (player1.position.z + player2.position.z) / 2;
        camera.position.x = centerX;
        camera.position.z = centerZ + 15;
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
