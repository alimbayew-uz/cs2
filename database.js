// database.js
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const path = require('path');

const dbPath = path.resolve(__dirname, 'cs2_game.db');
const db = new sqlite3.Database(dbPath);

// Parolni xavfsiz xeshlash funksiyasi
function hashPassword(password) {
    return crypto.createHash('sha256').update(password + 'cs2_salt_2026').digest('hex');
}

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'player',
            kills INTEGER DEFAULT 0,
            deaths INTEGER DEFAULT 0,
            is_banned INTEGER DEFAULT 0,
            is_muted INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Standart Admin akkaunt yaratish (Login: admin | Parol: admin123)
    const adminPass = hashPassword('admin123');
    db.run(
        `INSERT OR IGNORE INTO users (username, password_hash, role) VALUES (?, ?, ?)`,
        ['admin', adminPass, 'admin']
    );
});

module.exports = {
    db,
    hashPassword,

    // Ro'yxatdan o'tish yoki Kirish
    authenticateUser: (username, password, callback) => {
        const cleanUser = username.trim();
        const passHash = hashPassword(password);

        db.get(`SELECT * FROM users WHERE username = ?`, [cleanUser], (err, row) => {
            if (err) return callback(err, null);

            if (row) {
                // Foydalanuvchi mavjud -> parol va ban tekshiriladi
                if (row.is_banned === 1) {
                    return callback(new Error('Sizning akkauntingiz Admin tomonidan BAN qilingan!'), null);
                }
                if (row.password_hash !== passHash) {
                    return callback(new Error('Parol noto‘g‘ri!'), null);
                }
                return callback(null, row);
            } else {
                // Yangi foydalanuvchi yaratish
                db.run(
                    `INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'player')`,
                    [cleanUser, passHash],
                    function (insertErr) {
                        if (insertErr) return callback(insertErr, null);
                        db.get(`SELECT * FROM users WHERE id = ?`, [this.lastID], callback);
                    }
                );
            }
        });
    },

    updateStats: (username, killsDelta, deathsDelta) => {
        db.run(
            `UPDATE users SET kills = kills + ?, deaths = deaths + ? WHERE username = ?`,
            [killsDelta, deathsDelta, username]
        );
    },

    setBanStatus: (username, status) => {
        db.run(`UPDATE users SET is_banned = ? WHERE username = ?`, [status ? 1 : 0, username]);
    },

    setMuteStatus: (username, status) => {
        db.run(`UPDATE users SET is_muted = ? WHERE username = ?`, [status ? 1 : 0, username]);
    }
};