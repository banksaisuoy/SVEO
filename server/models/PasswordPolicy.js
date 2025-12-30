class PasswordPolicy {
    static async getActive(db) {
        return await db.get('SELECT * FROM password_policies WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1');
    }

    static async getAll(db) {
        return await db.all('SELECT * FROM password_policies ORDER BY created_at DESC');
    }

    static async create(db, policyData) {
        // Deactivate current active policy
        await db.run('UPDATE password_policies SET is_active = 0 WHERE is_active = 1');

        return await db.run(`
            INSERT INTO password_policies
            (name, min_length, require_uppercase, require_lowercase, require_numbers,
             require_special_chars, max_age_days, history_count, lockout_attempts,
             lockout_duration_minutes, is_active, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        `, [
            policyData.name,
            policyData.min_length,
            policyData.require_uppercase,
            policyData.require_lowercase,
            policyData.require_numbers,
            policyData.require_special_chars,
            policyData.max_age_days,
            policyData.history_count,
            policyData.lockout_attempts,
            policyData.lockout_duration_minutes,
            policyData.created_by
        ]);
    }

    static async validatePassword(password, policy = null) {
        if (!policy) {
            return { valid: true, errors: [] };
        }

        const errors = [];

        if (password.length < policy.min_length) {
            errors.push(`Password must be at least ${policy.min_length} characters long`);
        }

        if (policy.require_uppercase && !/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }

        if (policy.require_lowercase && !/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        }

        if (policy.require_numbers && !/\d/.test(password)) {
            errors.push('Password must contain at least one number');
        }

        if (policy.require_special_chars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
            errors.push('Password must contain at least one special character');
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }
}

module.exports = PasswordPolicy;