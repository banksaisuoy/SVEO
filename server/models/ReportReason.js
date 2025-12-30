class ReportReason {
    static async getAll(db) {
        return await db.all('SELECT * FROM report_reasons WHERE is_active = 1 ORDER BY reason');
    }

    static async getById(db, id) {
        return await db.get('SELECT * FROM report_reasons WHERE id = ?', [id]);
    }

    static async create(db, reason) {
        return await db.run('INSERT INTO report_reasons (reason) VALUES (?)', [reason]);
    }

    static async update(db, id, reason) {
        return await db.run('UPDATE report_reasons SET reason = ? WHERE id = ?', [reason, id]);
    }

    static async delete(db, id) {
        return await db.run('UPDATE report_reasons SET is_active = 0 WHERE id = ?', [id]);
    }

    static async restore(db, id) {
        return await db.run('UPDATE report_reasons SET is_active = 1 WHERE id = ?', [id]);
    }
}

module.exports = ReportReason;