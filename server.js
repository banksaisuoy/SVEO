    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start the server
app.listen(port, () => {
    console.log(`🚀 Server is running on http://localhost:${port}`);
