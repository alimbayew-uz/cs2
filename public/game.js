// public/game.js
const socket = io();

// --- OVOZ SINTEZATORI (Tashqi MP3 fayllarsiz ishlaydigan Web Audio API) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let masterVolume = 0.5;

function playSound(type) {
    if (masterVolume <= 0) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'ak47' || type === 'm4a4') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(35, now + 0.09);
        gain.gain.setValueAtTime(0.4 * masterVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.09);
        osc.start(now); osc.stop(now + 0.09);
    } else if (type === 'awp') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(110, now);
        osc.frequency.exponentialRampToValueAtTime(20, now + 0.35);
        gain.gain.setValueAtTime(0.8 * masterVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
        osc.start(now); osc.stop(now + 0.35);
    } else if (type === 'deagle') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(45, now + 0.14);
        gain.gain.setValueAtTime(0.5 * masterVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);
        osc.start(now); osc.stop(now + 0.14);
    } else if (type === 'knife') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.07);
        gain.gain.setValueAtTime(0.25 * masterVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.07);
        osc.start(now); osc.stop(now + 0.07);
    } else if (type === 'explosion') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(75, now);
        osc.frequency.exponentialRampToValueAtTime(12, now + 0.6);
        gain.gain.setValueAtTime(0.9 * masterVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
        osc.start(now); osc.stop(now + 0.6);
    }
}

// --- QUROLLAR KONFIGURATSIYASI ---
const WEAPON_STATS = {
    ak47:   { name: 'AK-47',        fireRate: 105, recoil: 0.022, auto: true,  range: 200, color: 0x8b5a2b },
    m4a4:   { name: 'M4A4',         fireRate: 90,  recoil: 0.016, auto: true,  range: 200, color: 0x2f3640 },
    awp:    { name: 'AWP Sniper',   fireRate: 1200,recoil: 0.080, auto: false, range: 350, color: 0x2ecc71 },
    deagle: { name: 'Desert Eagle', fireRate: 320, recoil: 0.035, auto: false, range: 150, color: 0xbdc3c7 },
    knife:  { name: 'Knife',        fireRate: 400, recoil: 0.005, auto: false, range: 3.8, color: 0x7f8fa6 },
    he:     { name: 'HE Grenade',   fireRate: 800, recoil: 0.010, auto: false, range: 0,   color: 0x4cd137 }
};

// --- THREE.JS SAHNA VA KAMERA ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xd8c39e);
scene.fog = new THREE.FogExp2(0xd8c39e, 0.008);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xfff3d1, 0.85);
dirLight.position.set(40, 80, 30);
scene.add(dirLight);

// --- DUST2 KARTA VA TO'QNASHUV QUTILARI (COLLIDERS) ---
const mapColliders = []; // Devorlar ro'yxati (AABB collision uchun)
const mapMeshes = [];
let floorMesh;

function buildMap(mapName) {
    mapMeshes.forEach(m => scene.remove(m));
    mapMeshes.length = 0;
    mapColliders.length = 0;

    const isIce = mapName === 'fy_iceworld';
    const sandColor = isIce ? 0xdff9fb : 0xd2b48c;
    const wallColor = isIce ? 0x7ed6df : 0xc29b61;
    const crateColor = isIce ? 0x22a6b3 : 0x8b5a2b;

    scene.background = new THREE.Color(isIce ? 0xc7ecee : 0xd8c39e);
    scene.fog = new THREE.FogExp2(isIce ? 0xc7ecee : 0xd8c39e, 0.008);

    // Yer (Floor)
    const floorGeo = new THREE.PlaneGeometry(100, 100);
    const floorMat = new THREE.MeshLambertMaterial({ color: sandColor });
    floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    scene.add(floorMesh);
    mapMeshes.push(floorMesh);

    function addBox(x, y, z, w, h, d, color) {
        const geo = new THREE.BoxGeometry(w, h, d);
        const mat = new THREE.MeshLambertMaterial({ color });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        scene.add(mesh);
        mapMeshes.push(mesh);

        // AABB Collider chegaralari
        mapColliders.push({
            minX: x - w / 2, maxX: x + w / 2,
            minY: y - h / 2, maxY: y + h / 2,
            minZ: z - d / 2, maxZ: z + d / 2
        });
    }

    // Arena Tashqi Devorlari
    addBox(0, 5, -50, 100, 10, 2, wallColor);
    addBox(0, 5, 50, 100, 10, 2, wallColor);
    addBox(-50, 5, 0, 2, 10, 100, wallColor);
    addBox(50, 5, 0, 2, 10, 100, wallColor);

    // Dust2 Mid Doors (Markaziy yo'lak va darvoza)
    addBox(-14, 4, 0, 20, 8, 2.5, wallColor);
    addBox(14, 4, 0, 20, 8, 2.5, wallColor);

    // Spawn himoya devorlari
    addBox(0, 3, -26, 18, 6, 2, wallColor);
    addBox(0, 3, 26, 18, 6, 2, wallColor);

    // B-Site va A-Site Qutilari (Bomb site Crates)
    addBox(-25, 2, -18, 5, 4, 5, crateColor);
    addBox(-28, 1.5, 16, 4, 3, 4, crateColor);
    addBox(25, 2, 18, 5, 4, 5, crateColor);
    addBox(26, 1.5, -16, 4, 3, 4, crateColor);
    addBox(0, 1.5, -10, 4, 3, 4, crateColor);
    addBox(0, 1.5, 10, 4, 3, 4, crateColor);
}

buildMap('de_dust2');

// --- 1-SHAXS QUROL MODELI (FIRST-PERSON VIEWMODEL) ---
const weaponGroup = new THREE.Group();
camera.add(weaponGroup);
scene.add(camera);

let fpWeaponMesh = null;
const muzzleLight = new THREE.PointLight(0xffaa00, 0, 6);
muzzleLight.position.set(0.25, -0.15, -1.1);
camera.add(muzzleLight);

function buildFirstPersonWeapon(weaponKey) {
    if (fpWeaponMesh) weaponGroup.remove(fpWeaponMesh);

    const group = new THREE.Group();
    const cfg = WEAPON_STATS[weaponKey] || WEAPON_STATS.deagle;
    const matMain = new THREE.MeshLambertMaterial({ color: cfg.color });
    const matDark = new THREE.MeshLambertMaterial({ color: 0x1e272e });

    if (weaponKey === 'knife') {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.45), matMain);
        blade.position.set(0.3, -0.25, -0.6);
        group.add(blade);
    } else if (weaponKey === 'he') {
        const nade = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), matMain);
        nade.position.set(0.3, -0.25, -0.55);
        group.add(nade);
    } else {
        const len = weaponKey === 'awp' ? 1.15 : (weaponKey === 'deagle' ? 0.45 : 0.85);
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, len), matMain);
        body.position.set(0.32, -0.26, -0.65);
        group.add(body);

        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, len * 0.6), matDark);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0.32, -0.22, -0.65 - len * 0.4);
        group.add(barrel);

        if (weaponKey === 'awp') {
            const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.35), matDark);
            scope.rotation.x = Math.PI / 2;
            scope.position.set(0.32, -0.14, -0.65);
            group.add(scope);
        }
    }

    fpWeaponMesh = group;
    weaponGroup.add(fpWeaponMesh);
}

// --- O'YINCHI HOLATI VA HARAKATLANISH ---
let myPlayer = null;
const remotePlayers = {}; // Boshqa o'yinchilarning 3D modellari
const activeGrenades = [];

let yaw = 0, pitch = 0;
let sensitivity = 0.0022;
let velocityY = 0;
let canJump = true;
let isMouseDown = false;
let lastShotTime = 0;
let isScoped = false;
let currentPing = 20;

const keys = {};
document.addEventListener('keydown', (e) => {
    keys[e.code] = true;

    if (!myPlayer) return;

    // 1, 2, 3, 4 orqali qurol almashtirish
    if (e.code === 'Digit1' && myPlayer.inventory.primary) switchWeapon(myPlayer.inventory.primary);
    if (e.code === 'Digit2') switchWeapon(myPlayer.inventory.secondary || 'deagle');
    if (e.code === 'Digit3') switchWeapon('knife');
    if (e.code === 'Digit4' && myPlayer.inventory.grenades > 0) switchWeapon('he');

    // Modallar: B (Buy Menu), Tab (Scoreboard), M (Settings), F2 (Admin)
    if (e.code === 'KeyB') toggleModal('buyMenuModal');
    if (e.code === 'KeyM') toggleModal('settingsModal');
    if (e.code === 'F2') toggleModal('adminModal');
    if (e.code === 'Tab') {
        e.preventDefault();
        document.getElementById('scoreboardModal').style.display = 'block';
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
    if (e.code === 'Tab') {
        document.getElementById('scoreboardModal').style.display = 'none';
    }
});

function toggleModal(id) {
    const el = document.getElementById(id);
    const isVisible = el.style.display === 'block';
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
    if (!isVisible) {
        el.style.display = 'block';
        document.exitPointerLock();
    } else {
        renderer.domElement.requestPointerLock();
    }
}

// PointerLock va Sichqoncha Boshqaruvi
renderer.domElement.addEventListener('click', () => {
    if (!myPlayer) return;
    const anyModalOpen = Array.from(document.querySelectorAll('.modal')).some(m => m.style.display === 'block');
    if (!anyModalOpen && document.pointerLockElement !== renderer.domElement) {
        renderer.domElement.requestPointerLock();
    }
});

document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== renderer.domElement || !myPlayer || myPlayer.isDead) return;
    const sensMult = isScoped ? 0.4 : 1.0;
    yaw -= e.movementX * sensitivity * sensMult;
    pitch -= e.movementY * sensitivity * sensMult;
    pitch = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, pitch));
});

document.addEventListener('mousedown', (e) => {
    if (document.pointerLockElement !== renderer.domElement || !myPlayer || myPlayer.isDead) return;
    if (e.button === 0) {
        isMouseDown = true;
        tryFireWeapon();
    } else if (e.button === 2 && myPlayer.weapon === 'awp') {
        // AWP Sniper Scope (O'ng tugma)
        isScoped = !isScoped;
        camera.fov = isScoped ? 25 : 75;
        camera.updateProjectionMatrix();
        document.getElementById('scopeOverlay').style.display = isScoped ? 'block' : 'none';
        if (fpWeaponMesh) fpWeaponMesh.visible = !isScoped;
    }
});

document.addEventListener('mouseup', (e) => {
    if (e.button === 0) isMouseDown = false;
});
document.addEventListener('contextmenu', e => e.preventDefault());

function switchWeapon(wKey) {
    if (!myPlayer) return;
    myPlayer.weapon = wKey;
    isScoped = false;
    camera.fov = 75;
    camera.updateProjectionMatrix();
    document.getElementById('scopeOverlay').style.display = 'none';

    buildFirstPersonWeapon(wKey);
    updateHud();
    socket.emit('switchWeapon', wKey);
}

// --- O'Q OTISH, RECOIL VA GRANATA ULOQTIRISH ---
const raycaster = new THREE.Raycaster();

function tryFireWeapon() {
    if (!myPlayer || myPlayer.isDead) return;
    const now = performance.now();
    const wKey = myPlayer.weapon;
    const cfg = WEAPON_STATS[wKey];
    if (!cfg || now - lastShotTime < cfg.fireRate) return;
    lastShotTime = now;

    // 1. Agar HE Granata bo'lsa -> Fizik uloqtirish
    if (wKey === 'he') {
        if (myPlayer.inventory.grenades <= 0) return;
        myPlayer.inventory.grenades--;
        updateHud();

        const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
        const origin = { x: camera.position.x, y: camera.position.y - 0.1, z: camera.position.z };
        const vel = { x: dir.x * 24, y: dir.y * 24 + 6, z: dir.z * 24 };

        socket.emit('throwGrenade', { origin, velocity: vel });
        switchWeapon(myPlayer.inventory.primary || myPlayer.inventory.secondary || 'knife');
        return;
    }

    // 2. Ovoz va Qurol Tepishi (Recoil)
    playSound(wKey === 'knife' ? 'knife' : wKey);
    pitch += cfg.recoil;
    yaw += (Math.random() - 0.5) * cfg.recoil * 0.6;

    if (fpWeaponMesh) {
        fpWeaponMesh.position.z = 0.14;
        fpWeaponMesh.rotation.x = 0.12;
    }

    if (wKey !== 'knife') {
        muzzleLight.intensity = 2.5;
        setTimeout(() => { muzzleLight.intensity = 0; }, 45);
    }

    // 3. Raycasting (O'q uzish chizig'ini tekshirish)
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    raycaster.far = cfg.range;

    const targetMeshes = [];
    Object.values(remotePlayers).forEach(rp => {
        if (!rp.data.isDead) {
            targetMeshes.push(rp.bodyMesh, rp.headMesh);
        }
    });

    const allCheckMeshes = [...targetMeshes, ...mapMeshes];
    const intersects = raycaster.intersectObjects(allCheckMeshes, false);

    let hitTargetId = null;
    let isHeadshot = false;
    let endPoint = raycaster.ray.at(cfg.range, new THREE.Vector3());

    if (intersects.length > 0) {
        const hit = intersects[0];
        endPoint = hit.point;

        if (hit.object.userData && hit.object.userData.playerId) {
            hitTargetId = hit.object.userData.playerId;
            isHeadshot = hit.object.userData.isHead === true;
            createHitSpark(hit.point, 0xff0000);
        } else {
            createHitSpark(hit.point, 0xffcc00);
        }
    }

    if (wKey !== 'knife') {
        drawBulletTracer(
            new THREE.Vector3(camera.position.x, camera.position.y - 0.15, camera.position.z),
            endPoint
        );
    }

    socket.emit('shoot', {
        origin: { x: camera.position.x, y: camera.position.y - 0.15, z: camera.position.z },
        dir: { x: endPoint.x, y: endPoint.y, z: endPoint.z },
        targetId: hitTargetId,
        isHeadshot,
        weaponKey: wKey
    });
}

function drawBulletTracer(startVec, endVec) {
    const mat = new THREE.LineBasicMaterial({ color: 0xffeaa7, transparent: true, opacity: 0.75 });
    const geo = new THREE.BufferGeometry().setFromPoints([startVec, endVec]);
    const line = new THREE.Line(geo, mat);
    scene.add(line);
    setTimeout(() => scene.remove(line), 65);
}

function createHitSpark(pos, colorHex) {
    const geo = new THREE.SphereGeometry(0.14, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color: colorHex });
    const spark = new THREE.Mesh(geo, mat);
    spark.position.copy(pos);
    scene.add(spark);
    setTimeout(() => scene.remove(spark), 150);
}

// --- HE GRANATA FIZIKASI VA PORTLASH ---
function spawnPhysicalGrenade(ownerId, origin, velocity) {
    const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 10, 10),
        new THREE.MeshLambertMaterial({ color: 0x2ecc71 })
    );
    mesh.position.set(origin.x, origin.y, origin.z);
    scene.add(mesh);

    activeGrenades.push({
        ownerId,
        mesh,
        vel: new THREE.Vector3(velocity.x, velocity.y, velocity.z),
        spawnTime: performance.now()
    });
}

function updateGrenades(dt) {
    const now = performance.now();
    for (let i = activeGrenades.length - 1; i >= 0; i--) {
        const g = activeGrenades[i];
        g.vel.y -= 22 * dt; // Gravitatsiya

        const nextPos = g.mesh.position.clone().addScaledVector(g.vel, dt);

        // Yerdan sakrash (Bounce)
        if (nextPos.y < 0.2) {
            nextPos.y = 0.2;
            g.vel.y *= -0.45;
            g.vel.x *= 0.75;
            g.vel.z *= 0.75;
        }

        // Devorlardan qaytish
        for (const box of mapColliders) {
            if (
                nextPos.x > box.minX && nextPos.x < box.maxX &&
                nextPos.y > box.minY && nextPos.y < box.maxY &&
                nextPos.z > box.minZ && nextPos.z < box.maxZ
            ) {
                g.vel.x *= -0.6;
                g.vel.z *= -0.6;
                break;
            }
        }

        g.mesh.position.copy(nextPos);

        // 2.2 soniyadan keyin Portlash!
        if (now - g.spawnTime >= 2200) {
            playSound('explosion');
            const expGeo = new THREE.SphereGeometry(3.5, 16, 16);
            const expMat = new THREE.MeshBasicMaterial({ color: 0xff793f, transparent: true, opacity: 0.75 });
            const expMesh = new THREE.Mesh(expGeo, expMat);
            expMesh.position.copy(g.mesh.position);
            scene.add(expMesh);
            setTimeout(() => scene.remove(expMesh), 260);

            if (myPlayer && g.ownerId === myPlayer.id) {
                socket.emit('grenadeExplode', {
                    pos: { x: g.mesh.position.x, y: g.mesh.position.y, z: g.mesh.position.z }
                });
            }

            scene.remove(g.mesh);
            activeGrenades.splice(i, 1);
        }
    }
}

// --- BOSHQA O'YINCHILARNING 3D MODELLARINI YARATISH ---
function createRemotePlayerMesh(pData) {
    const group = new THREE.Group();
    const teamColor = pData.team === 'T' ? 0xe59b27 : 0x3867d6;

    // Gavda (Body)
    const bodyGeo = new THREE.BoxGeometry(0.9, 1.4, 0.55);
    const bodyMat = new THREE.MeshLambertMaterial({ color: teamColor });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 0.7;
    bodyMesh.userData = { playerId: pData.id, isHead: false };
    group.add(bodyMesh);

    // Bosh (Headshot uchun Head Mesh)
    const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const headMat = new THREE.MeshLambertMaterial({ color: 0xffd3b6 });
    const headMesh = new THREE.Mesh(headGeo, headMat);
    headMesh.position.y = 1.68;
    headMesh.userData = { playerId: pData.id, isHead: true };
    group.add(headMesh);

    group.position.set(pData.x, pData.y - 2.0, pData.z);
    scene.add(group);

    remotePlayers[pData.id] = { group, bodyMesh, headMesh, data: pData };
}

// --- TO'QNASHUV (AABB COLLISION) TEKSHIRUVI ---
function checkCollision(nx, ny, nz) {
    if (myPlayer && myPlayer.noclip) return false; // Admin Noclip yoqilgan bo'lsa devorlardan uchib o'tadi!
    const radius = 0.55;
    for (const b of mapColliders) {
        if (
            nx + radius > b.minX && nx - radius < b.maxX &&
            ny > b.minY && ny - 1.8 < b.maxY &&
            nz + radius > b.minZ && nz - radius < b.maxZ
        ) {
            return true;
        }
    }
    return false;
}

// --- ASOSIY O'YIN TSIKLI (GAME LOOP) ---
let prevTime = performance.now();

function animate() {
    requestAnimationFrame(animate);

    const now = performance.now();
    const dt = Math.min((now - prevTime) / 1000, 0.1);
    prevTime = now;

    if (myPlayer && !myPlayer.isDead) {
        // Avtomatik qurollar (AK-47 / M4A4) uchun bosib turganda o'q uzish
        if (isMouseDown && WEAPON_STATS[myPlayer.weapon]?.auto) {
            tryFireWeapon();
        }

        // Qurol tepishidan (Recoil) asl holatiga qaytishi
        if (fpWeaponMesh) {
            fpWeaponMesh.position.z += (0 - fpWeaponMesh.position.z) * 10 * dt;
            fpWeaponMesh.rotation.x += (0 - fpWeaponMesh.rotation.x) * 10 * dt;
        }

        // Harakat yo'nalishi (WASD)
        const speed = myPlayer.noclip ? 26 : 11;
        const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
        const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

        let moveVec = new THREE.Vector3();
        if (keys['KeyW']) moveVec.add(forward);
        if (keys['KeyS']) moveVec.sub(forward);
        if (keys['KeyD']) moveVec.add(right);
        if (keys['KeyA']) moveVec.sub(right);
        if (moveVec.lengthSq() > 0) moveVec.normalize();

        const nextX = camera.position.x + moveVec.x * speed * dt;
        const nextZ = camera.position.z + moveVec.z * speed * dt;

        if (!checkCollision(nextX, camera.position.y, camera.position.z)) {
            camera.position.x = nextX;
        }
        if (!checkCollision(camera.position.x, camera.position.y, nextZ)) {
            camera.position.z = nextZ;
        }

        // Sakrash va Gravitatsiya (yoki Admin Noclip uchishi)
        if (myPlayer.noclip) {
            if (keys['Space']) camera.position.y += 14 * dt;
            if (keys['ShiftLeft']) camera.position.y -= 14 * dt;
        } else {
            if (keys['Space'] && canJump) {
                velocityY = 9.5;
                canJump = false;
            }
            velocityY -= 24 * dt;
            camera.position.y += velocityY * dt;

            if (camera.position.y <= 2.0) {
                camera.position.y = 2.0;
                velocityY = 0;
                canJump = true;
            }
        }

        camera.rotation.order = 'YXZ';
        camera.rotation.y = yaw;
        camera.rotation.x = pitch;

        socket.emit('move', {
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z,
            ry: yaw,
            rx: pitch,
            ping: currentPing
        });
    }

    updateGrenades(dt);
    renderer.render(scene, camera);
}
animate();

// --- INTERFEYS VA SOCKET.IO HODISALARI ---
document.getElementById('joinBtn').addEventListener('click', () => {
    const username = document.getElementById('usernameInput').value;
    const password = document.getElementById('passwordInput').value;
    const team = document.getElementById('teamSelect').value;
    socket.emit('login', { username, password, team });
});

socket.on('loginError', (msg) => {
    document.getElementById('loginError').textContent = msg;
});

socket.on('loginSuccess', ({ self, players, gameState }) => {
    myPlayer = self;
    document.getElementById('loginOverlay').style.display = 'none';

    buildMap(gameState.map);
    camera.position.set(self.x, self.y, self.z);
    yaw = self.ry;
    buildFirstPersonWeapon(self.weapon);
    updateHud();

    Object.values(players).forEach(p => {
        if (p.id !== self.id) createRemotePlayerMesh(p);
    });

    renderer.domElement.requestPointerLock();
});

socket.on('playerJoined', (p) => {
    if (myPlayer && p.id !== myPlayer.id) createRemotePlayerMesh(p);
});

socket.on('playerMoved', (p) => {
    const rp = remotePlayers[p.id];
    if (rp) {
        rp.group.position.set(p.x, p.y - 2.0, p.z);
        rp.group.rotation.y = p.ry;
    }
});

socket.on('playerLeft', (id) => {
    if (remotePlayers[id]) {
        scene.remove(remotePlayers[id].group);
        delete remotePlayers[id];
    }
});

socket.on('playerShot', ({ origin, dir, weaponKey }) => {
    playSound(weaponKey === 'knife' ? 'knife' : weaponKey);
    if (weaponKey !== 'knife') {
        drawBulletTracer(
            new THREE.Vector3(origin.x, origin.y, origin.z),
            new THREE.Vector3(dir.x, dir.y, dir.z)
        );
    }
});

socket.on('grenadeThrown', ({ ownerId, origin, velocity }) => {
    spawnPhysicalGrenade(ownerId, origin, velocity);
});

socket.on('healthUpdate', ({ hp, armor }) => {
    if (!myPlayer) return;
    myPlayer.hp = hp;
    myPlayer.armor = armor;
    updateHud();
});

socket.on('moneyUpdate', (money) => {
    if (!myPlayer) return;
    myPlayer.money = money;
    updateHud();
});

socket.on('buySuccess', ({ money, armor, inventory, activeWeapon }) => {
    if (!myPlayer) return;
    myPlayer.money = money;
    myPlayer.armor = armor;
    myPlayer.inventory = inventory;
    switchWeapon(activeWeapon);
    updateHud();
});

socket.on('playerKilled', ({ killer, victim, victimId, weapon, isHeadshot }) => {
    if (myPlayer && victimId === myPlayer.id) {
        myPlayer.isDead = true;
    }
    if (remotePlayers[victimId]) {
        remotePlayers[victimId].group.visible = false;
        remotePlayers[victimId].data.isDead = true;
    }

    const feed = document.getElementById('killFeed');
    const div = document.createElement('div');
    div.className = 'kill-item';
    div.innerHTML = `<b>${killer}</b> [${weapon}${isHeadshot ? ' 🎯 HS' : ''}] <b>${victim}</b>`;
    feed.prepend(div);
    setTimeout(() => div.remove(), 5000);
});

socket.on('respawn', (pData) => {
    myPlayer = pData;
    camera.position.set(pData.x, pData.y, pData.z);
    updateHud();
});

socket.on('playerRespawned', (pData) => {
    const rp = remotePlayers[pData.id];
    if (rp) {
        rp.data = pData;
        rp.group.position.set(pData.x, pData.y - 2.0, pData.z);
        rp.group.visible = true;
    }
});

socket.on('playersSync', (players) => {
    Object.values(players).forEach(p => {
        if (myPlayer && p.id === myPlayer.id) {
            myPlayer = p;
            camera.position.set(p.x, p.y, p.z);
            updateHud();
        } else if (remotePlayers[p.id]) {
            remotePlayers[p.id].group.position.set(p.x, p.y - 2.0, p.z);
            remotePlayers[p.id].group.visible = !p.isDead;
        }
    });
});

socket.on('scoreboardUpdate', ({ players, scores }) => {
    document.getElementById('tScore').textContent = scores.T;
    document.getElementById('ctScore').textContent = scores.CT;

    const tbody = document.getElementById('scoreboardBody');
    const adminList = document.getElementById('adminPlayersList');
    tbody.innerHTML = '';
    adminList.innerHTML = '';

    Object.values(players).forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${p.username} ${p.role === 'admin' ? '👑' : ''}</td>
            <td style="color:${p.team === 'T' ? '#f2a93b' : '#5d9cec'}">${p.team}</td>
            <td>${p.kills}</td>
            <td>${p.deaths}</td>
            <td>${p.ping} ms</td>
        `;
        tbody.appendChild(tr);

        const atr = document.createElement('tr');
        atr.innerHTML = `
            <td>${p.username}</td>
            <td>${p.team}</td>
            <td>
                <button class="admin-btn" onclick="sendAdminAction('mute', '${p.id}')">${p.isMuted ? 'Unmute' : 'Mute'}</button>
                <button class="admin-btn danger" onclick="sendAdminAction('kick', '${p.id}')">Kick</button>
                <button class="admin-btn danger" onclick="sendAdminAction('ban', '${p.id}')">Ban</button>
            </td>
        `;
        adminList.appendChild(atr);
    });
});

socket.on('timerUpdate', (seconds) => {
    const m = String(Math.floor(seconds / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    document.getElementById('roundTimer').textContent = `${m}:${s}`;
});

socket.on('mapChanged', (newMap) => {
    buildMap(newMap);
});

socket.on('announcement', (text) => {
    const banner = document.getElementById('announcementBanner');
    banner.textContent = text;
    banner.style.display = 'block';
    setTimeout(() => { banner.style.display = 'none'; }, 4500);
});

socket.on('adminModesUpdated', ({ godmode, noclip }) => {
    if (!myPlayer) return;
    myPlayer.godmode = godmode;
    myPlayer.noclip = noclip;
    updateHud();
});

socket.on('kicked', (reason) => {
    alert(reason);
    window.location.reload();
});

function updateHud() {
    if (!myPlayer) return;
    document.getElementById('hpVal').textContent = myPlayer.hp;
    document.getElementById('armorVal').textContent = myPlayer.armor;
    document.getElementById('moneyVal').textContent = `$${myPlayer.money}`;
    document.getElementById('activeWeaponName').textContent = WEAPON_STATS[myPlayer.weapon]?.name || myPlayer.weapon;

    const inv = myPlayer.inventory;
    document.getElementById('inventoryHint').textContent =
        `[1] ${inv.primary ? inv.primary.toUpperCase() : 'Yo‘q'} | [2] Deagle | [3] Pichoq | [4] HE: ${inv.grenades}`;

    const badge = document.getElementById('adminBadge');
    if (myPlayer.godmode || myPlayer.noclip) {
        badge.style.display = 'block';
        badge.textContent = `${myPlayer.godmode ? '[GODMODE] ' : ''}${myPlayer.noclip ? '[NOCLIP]' : ''}`;
    } else {
        badge.style.display = 'none';
    }
}

// Global funksiyalar (HTML tugmalari uchun)
window.buyWeapon = function(itemKey) {
    socket.emit('buyItem', itemKey);
};

window.sendAdminAction = function(action, targetId = null, value = null) {
    const secretKey = document.getElementById('adminSecretInput').value;
    socket.emit('adminAction', { action, targetId, value, secretKey });
};

// Sozlamalar (Sensitivity & Volume)
document.getElementById('sensSlider').addEventListener('input', (e) => {
    sensitivity = parseFloat(e.target.value);
});
document.getElementById('volSlider').addEventListener('input', (e) => {
    masterVolume = parseFloat(e.target.value);
});

// Ping o'lchagich
setInterval(() => {
    const start = Date.now();
    socket.emit('pingCheck', () => {
        currentPing = Date.now() - start;
    });
}, 2500);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});