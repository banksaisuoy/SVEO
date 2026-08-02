        });
    });

    // GET all users (Admin only)
    router.get('/users', isAuthenticated, isAdmin, (req, res) => {
        db.all(`SELECT id, username, role, suspended FROM users ORDER BY id DESC`, [], (err, rows) => {
            if (err) {
                console.error('Error fetching users:', err.message);
                return res.status(500).json({ error: 'Failed to fetch users.' });
            }
            res.status(200).json(rows);
        });
    });

    // PUT suspend/unsuspend a user (Admin only)
    router.put('/users/:id/suspend', isAuthenticated, isAdmin, (req, res) => {
        const { id } = req.params;
        const { suspended } = req.body;
        
        if (typeof suspended !== 'boolean') {
            return res.status(400).json({ error: 'Suspended status is required and must be a boolean.' });
        }

        db.run(`UPDATE users SET suspended = ? WHERE id = ?`, [suspended ? 1 : 0, id], function(err) {
            if (err) {
                console.error('Error updating user:', err.message);
                return res.status(500).json({ error: 'Failed to update user.' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'User not found.' });
            }
            res.status(200).json({ message: 'User updated successfully.' });
        });
    });

    // DELETE a video (Admin only)
    router.delete('/videos/:id', isAuthenticated, isAdmin, (req, res) => {
        const { id } = req.params;