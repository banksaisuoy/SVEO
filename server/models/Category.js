class Category {
    static async getAll(db) {
        return await db.all('SELECT * FROM categories ORDER BY name');
    }

    static async getById(db, id) {
        return await db.get('SELECT * FROM categories WHERE id = ?', [id]);
    }

    static async create(db, name) {
        return await db.run('INSERT INTO categories (name) VALUES (?)', [name]);
    }

    static async update(db, id, name) {
        return await db.run('UPDATE categories SET name = ? WHERE id = ?', [name, id]);
    }

    static async delete(db, id) {
        return await db.run('DELETE FROM categories WHERE id = ?', [id]);
    }
}

module.exports = Category;