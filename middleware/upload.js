});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['video/mp4', 'video/webm', 'image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type.'), false);
    }
};
