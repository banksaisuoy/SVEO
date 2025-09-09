// This is the new root server file.
// It is responsible for starting the application.
const app = require('./src/app');

const port = process.env.PORT || 3000;

app.listen(port, () => {
    console.log(`🚀 Server is running on http://localhost:${port}`);
});
