// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const dbModule = require('./database');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// Qurollar xarakteristikasi va narxlari
const WEAPONS = {
    knife:  { name: 'Knife',        price: 0,    damage: 55,  slot: 3 },
    deagle: { name: 'Desert Eagle', price: 700,  damage: 53,  slot: 2 },
    ak47:   { name: 'AK-47',        price: 2700, damage: 36,  slot: 1 },
    m4a4:   { name: 'M4A4',         price: 3100, damage: 33,  slot: 1 },
    awp:    { name: 'AWP',          price: 4750, damage: 115, slot: 1 },
    he:     { name: 'HE Grenade',   price: 300,  damage: 98,  slot: 4 }
};

// O'yin holati (Game State)
let gameState = {
    map: 'de_dust2',
    roundTime: 600, // 10 daqiqalik Team Deathmatch
    timeLeft: 600,
    scores: { T: 0, CT: 0 }
};

const players = {};

// Jamoalar uchun Spawn (tug'ilish) nuqtalari
function getSpawnPoint(team) {
    const offset = (Math.random() - 0.5) * 14;
    if (team === 'T') {
        return { x: offset, y: 2.0, z: -38 }; // Terrorist Base
    } else {
        return { x: offset, y: 2.0, z: 38 };  // Counter-Terrorist Base
    }
}

// Raund taymeri
setInterval(() => {
    if (gameState.timeLeft > 0) {
        gameState.timeLeft--;
    } else {
        // Raund tugaganda avtomatik yangilash
        gameState.timeLeft = gameState.roundTime;
        gameState.scores = { T: 0, CT: 0 };
        io.emit('announcement', 'Raund vaqti tugadi! Yangi raund boshlandi.');
        respawnAllPlayers();
    }
    io.emit('timerUpdate', gameState.timeLeft);
}, 1000);

function respawnAllPlayers() {
    Object.values(players).forEach(p => {
        const spawn = getSpawnPoint(p.team);
        p.x = spawn.x; p.y = spawn.y; p.z = spawn.z;
        p.hp = 100;
        p.armor = 0;
        p.isDead = false;
    });
    io.emit('playersSync', players);
}

io.on('connection', (socket) => {
    // Ping o'lchash
    socket.on('pingCheck', (cb) => {
        if (typeof cb === 'function') cb();
    });

    // 1. Login / Ro'yxatdan o'tish va O'yinga qo'shilish
    socket.on('login', ({ username, password, team }) => {
        if (!username || !password) {
            return socket.emit('loginError', 'Foydalanuvchi nomi va parolni kiriting!');
        }

        dbModule.authenticateUser(username, password, (err, userRecord) => {
            if (err) {
                return socket.emit('loginError', err.message);
            }

            const chosenTeam = (team === 'T' || team === 'CT') ? team : 'T';
            const spawn = getSpawnPoint(chosenTeam);

            players[socket.id] = {
                id: socket.id,
                username: userRecord.username,
                role: userRecord.role, // 'admin' yoki 'player'
                team: chosenTeam,
                x: spawn.x,
                y: spawn.y,
                z: spawn.z,
                ry: chosenTeam === 'T' ? Math.PI : 0,
                rx: 0,
                hp: 100,
                armor: 0,
                money: 1600, // Boshlang'ich pul
                kills: userRecord.kills,
                deaths: userRecord.deaths,
                ping: 25,
                weapon: 'deagle',
                inventory: { primary: null, secondary: 'deagle', knife: 'knife', grenades: 1 },
                isDead: false,
                godmode: false,
                noclip: false,
                isMuted: userRecord.is_muted === 1
            };

            socket.emit('loginSuccess', {
                self: players[socket.id],
                players,
                gameState
            });

            socket.broadcast.emit('playerJoined', players[socket.id]);
            io.emit('scoreboardUpdate', { players, scores: gameState.scores });
        });
    });

    // 2. Harakatlanish va Kamera burchagini yangilash
    socket.on('move', (data) => {
        const p = players[socket.id];
        if (!p || p.isDead) return;

        p.x = data.x;
        p.y = data.y;
        p.z = data.z;
        p.ry = data.ry;
        p.rx = data.rx;
        p.ping = data.ping || 20;

        socket.broadcast.emit('playerMoved', {
            id: socket.id,
            x: p.x, y: p.y, z: p.z,
            ry: p.ry, rx: p.rx,
            weapon: p.weapon
        });
    });

    // 3. Qurol almashtirish (1, 2, 3, 4 tugmalari)
    socket.on('switchWeapon', (weaponKey) => {
        const p = players[socket.id];
        if (!p || p.isDead) return;
        p.weapon = weaponKey;
        socket.broadcast.emit('playerWeaponChanged', { id: socket.id, weapon: weaponKey });
    });

    // 4. Buy Menu orqali xarid qilish
    socket.on('buyItem', (itemKey) => {
        const p = players[socket.id];
        if (!p || p.isDead) return;

        if (itemKey === 'kevlar') {
            if (p.money >= 1000 && p.armor < 100) {
                p.money -= 1000;
                p.armor = 100;
                socket.emit('buySuccess', { money: p.money, armor: p.armor, inventory: p.inventory, activeWeapon: p.weapon });
            }
            return;
        }

        const w = WEAPONS[itemKey];
        if (!w || p.money < w.price) return;

        p.money -= w.price;
        if (w.slot === 1) {
            p.inventory.primary = itemKey;
            p.weapon = itemKey;
        } else if (w.slot === 2) {
            p.inventory.secondary = itemKey;
            p.weapon = itemKey;
        } else if (w.slot === 4) {
            p.inventory.grenades = Math.min(3, (p.inventory.grenades || 0) + 1);
            p.weapon = 'he';
        }

        socket.emit('buySuccess', {
            money: p.money,
            armor: p.armor,
            inventory: p.inventory,
            activeWeapon: p.weapon
        });
        socket.broadcast.emit('playerWeaponChanged', { id: socket.id, weapon: p.weapon });
    });

    // 5. O'q uzish va Zarar yetkazish (Hitscan & Knife)
    socket.on('shoot', ({ origin, dir, targetId, isHeadshot, weaponKey }) => {
        const shooter = players[socket.id];
        if (!shooter || shooter.isDead) return;

        // Boshqalarga o'q ovozi va chizig'ini ko'rsatish
        socket.broadcast.emit('playerShot', {
            id: socket.id,
            origin,
            dir,
            weaponKey
        });

        if (targetId && players[targetId]) {
            const victim = players[targetId];
            if (victim.isDead || victim.team === shooter.team || victim.godmode) return;

            const w = WEAPONS[weaponKey] || WEAPONS.deagle;
            let dmg = w.damage;
            if (isHeadshot && weaponKey !== 'knife') dmg = Math.round(dmg * 2.5);

            // Zirh (Armor) zararni 30% ga kamaytiradi
            if (victim.armor > 0) {
                const absorbed = Math.round(dmg * 0.3);
                victim.armor = Math.max(0, victim.armor - absorbed);
                dmg -= absorbed;
            }

            applyDamage(shooter, victim, dmg, w.name, isHeadshot);
        }
    });

    // 6. HE Granata uloqtirish va Portlash
    socket.on('throwGrenade', ({ origin, velocity }) => {
        const p = players[socket.id];
        if (!p || p.isDead || p.inventory.grenades <= 0) return;

        p.inventory.grenades--;
        io.emit('grenadeThrown', { ownerId: socket.id, origin, velocity });
    });

    socket.on('grenadeExplode', ({ pos }) => {
        const shooter = players[socket.id];
        if (!shooter) return;

        // Portlash radiusi ichidagi dushmanlarni tekshirish (Radius: 12 metr)
        Object.values(players).forEach(victim => {
            if (victim.isDead || victim.godmode) return;
            // Friendly fire o'chirilgan (faqat dushmanlar yoki o'zi)
            if (victim.team === shooter.team && victim.id !== shooter.id) return;

            const dx = victim.x - pos.x;
            const dy = victim.y - pos.y;
            const dz = victim.z - pos.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

            if (dist < 12) {
                const dmg = Math.round(98 * (1 - dist / 12));
                if (dmg > 0) {
                    applyDamage(shooter, victim, dmg, 'HE Grenade', false);
                }
            }
        });
    });

    function applyDamage(shooter, victim, dmg, weaponName, isHeadshot) {
        victim.hp -= dmg;
        io.to(victim.id).emit('healthUpdate', { hp: Math.max(0, victim.hp), armor: victim.armor });

        if (victim.hp <= 0) {
            victim.hp = 0;
            victim.isDead = true;
            victim.deaths++;

            if (shooter.id !== victim.id) {
                shooter.kills++;
                shooter.money = Math.min(16000, shooter.money + 300); // Kill mukofoti +$300
                gameState.scores[shooter.team]++;
                dbModule.updateStats(shooter.username, 1, 0);
            }
            dbModule.updateStats(victim.username, 0, 1);

            io.to(shooter.id).emit('moneyUpdate', shooter.money);
            io.emit('playerKilled', {
                killer: shooter.username,
                killerTeam: shooter.team,
                victim: victim.username,
                victimId: victim.id,
                victimTeam: victim.team,
                weapon: weaponName,
                isHeadshot
            });
            io.emit('scoreboardUpdate', { players, scores: gameState.scores });

            // 3 soniyadan so'ng Respawn qilish
            setTimeout(() => {
                if (players[victim.id]) {
                    const spawn = getSpawnPoint(victim.team);
                    victim.x = spawn.x;
                    victim.y = spawn.y;
                    victim.z = spawn.z;
                    victim.hp = 100;
                    victim.isDead = false;
                    io.to(victim.id).emit('respawn', victim);
                    socket.broadcast.emit('playerRespawned', victim);
                }
            }, 3000);
        }
    }

    // 7. Chat tizimi (Mute tekshiruvi bilan)
    socket.on('chatMessage', (msg) => {
        const p = players[socket.id];
        if (!p) return;
        if (p.isMuted) {
            return socket.emit('announcement', 'Siz Admin tomonidan MUTE qilingansiz!');
        }
        io.emit('chatBroadcast', {
            username: p.username,
            team: p.team,
            role: p.role,
            text: String(msg).slice(0, 120)
        });
    });

    // 8. ADMIN PANEL BUYRUQLARI (Xavfsiz tekshiruv bilan)
    socket.on('adminAction', (payload) => {
        const admin = players[socket.id];
        // Maxfiy parol ("owner2026") orqali ham admin huquqini faollashtirish imkoniyati
        if (payload.secretKey === 'owner2026' && admin) {
            admin.role = 'admin';
        }
        if (!admin || admin.role !== 'admin') {
            return socket.emit('announcement', 'Xatolik: Sizda Admin huquqi yo‘q!');
        }

        const { action, targetId, value } = payload;
        const target = players[targetId];

        switch (action) {
            case 'kick':
                if (target) {
                    io.to(targetId).emit('kicked', 'Admin tomonidan serverdan chiqarildingiz (KICK).');
                    io.sockets.sockets.get(targetId)?.disconnect(true);
                }
                break;

            case 'ban':
                if (target) {
                    dbModule.setBanStatus(target.username, true);
                    io.to(targetId).emit('kicked', 'Siz Admin tomonidan doimiy BAN qilindingiz!');
                    io.sockets.sockets.get(targetId)?.disconnect(true);
                }
                break;

            case 'mute':
                if (target) {
                    target.isMuted = !target.isMuted;
                    dbModule.setMuteStatus(target.username, target.isMuted);
                    io.emit('announcement', `${target.username} ${target.isMuted ? 'MUTE qilindi' : 'MUTE dan olindi'}.`);
                }
                break;

            case 'changeMap':
                gameState.map = value;
                io.emit('mapChanged', gameState.map);
                io.emit('announcement', `Admin xaritani [${value}] ga o‘zgartirdi!`);
                respawnAllPlayers();
                break;

            case 'setRoundTime':
                gameState.roundTime = parseInt(value) || 600;
                gameState.timeLeft = gameState.roundTime;
                io.emit('timerUpdate', gameState.timeLeft);
                io.emit('announcement', `Raund vaqti ${gameState.roundTime} soniyaga o‘zgartirildi.`);
                break;

            case 'restartMatch':
                gameState.scores = { T: 0, CT: 0 };
                gameState.timeLeft = gameState.roundTime;
                respawnAllPlayers();
                io.emit('scoreboardUpdate', { players, scores: gameState.scores });
                io.emit('announcement', 'Admin o‘yinni qayta ishga tushirdi (MP_RESTARTGAME 1)!');
                break;

            case 'announce':
                io.emit('announcement', `ADMIN E'LONI: ${value}`);
                break;

            case 'toggleGodmode':
                admin.godmode = !admin.godmode;
                socket.emit('adminModesUpdated', { godmode: admin.godmode, noclip: admin.noclip });
                break;

            case 'toggleNoclip':
                admin.noclip = !admin.noclip;
                socket.emit('adminModesUpdated', { godmode: admin.godmode, noclip: admin.noclip });
                break;
        }
    });

    socket.on('disconnect', () => {
        if (players[socket.id]) {
            delete players[socket.id];
            io.emit('playerLeft', socket.id);
            io.emit('scoreboardUpdate', { players, scores: gameState.scores });
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`CS2 Web Multiplayer Server ishga tushdi: http://localhost:${PORT}`);
});