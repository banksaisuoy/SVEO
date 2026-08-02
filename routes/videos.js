const express = require('express');
const fs = require('fs');
const path = require('path');
const { body, validationResult } = require('express-validator');

module.exports = (db, upload, isAdmin) => {
    const router = express.Router();
    });

    // POST a new video (Admin only)
    router.post('/', isAdmin, upload.single('file'), [
        body('title').trim().escape(),
        body('description').trim().escape(),
        body('category_id').trim().escape()
    ], (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: 'Validation failed', details: errors.array() });
        }
        const { title, description, category_id, thumbnail_path, duration } = req.body;
        if (!title) return res.status(400).json({ error: 'Title is required.' });
        if (!req.file) return res.status(400).json({ error: 'Video file is required.' });
    });

    // PUT update video metadata (Admin only)
    router.put('/:id', isAdmin, [
        body('title').trim().escape(),
        body('description').trim().escape(),
        body('category_id').trim().escape()
    ], (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: 'Validation failed', details: errors.array() });
        }
        const { id } = req.params;
        const { title, description, category_id, thumbnail_path, duration } = req.body;
        