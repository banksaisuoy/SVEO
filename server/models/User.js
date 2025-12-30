const bcrypt = require('bcrypt');

class User {
    static async findByUsername(db, username) {
        return await db.get('SELECT * FROM users WHERE username = ?', [username]);
    }

    static async create(db, userData) {
        const hashedPassword = await bcrypt.hash(userData.password, 10);
        return await db.run(
            'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
            [userData.username, hashedPassword, userData.role || 'user']
        );
    }

    static async update(db, username, userData) {
        const updates = [];
        const values = [];

        if (userData.password) {
            updates.push('password = ?');
            values.push(await bcrypt.hash(userData.password, 10));
        }
        if (userData.role) {
            updates.push('role = ?');
            values.push(userData.role);
        }
        if (userData.fullName !== undefined) {
            updates.push('fullName = ?');
            values.push(userData.fullName);
        }
        if (userData.department !== undefined) {
            updates.push('department = ?');
            values.push(userData.department);
        }
        if (userData.employeeId !== undefined) {
            updates.push('employeeId = ?');
            values.push(userData.employeeId);
        }
        if (userData.email !== undefined) {
            updates.push('email = ?');
            values.push(userData.email);
        }
        if (userData.phone !== undefined) {
            updates.push('phone = ?');
            values.push(userData.phone);
        }

        values.push(username);

        return await db.run(
            `UPDATE users SET ${updates.join(', ')} WHERE username = ?`,
            values
        );
    }

    static async getAll(db) {
        return await db.all('SELECT username, role, created_at FROM users ORDER BY created_at DESC');
    }

    static async validatePassword(plainPassword, hashedPassword) {
        return await bcrypt.compare(plainPassword, hashedPassword);
    }
}

module.exports = User;