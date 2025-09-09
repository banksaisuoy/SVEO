const request = require('supertest');
const app = require('../src/app');
const { db, initializeDb } = require('../src/db/database');

describe('Auth Endpoints', () => {
    // Initialize a clean, in-memory database before all tests in this file
    beforeAll((done) => {
        // The 'test' environment uses an in-memory DB, as configured in database.js
        initializeDb((err) => {
            if (err) return done(err);
            done();
        });
    });

    // Close the database connection after all tests in this file are done
    afterAll((done) => {
        db.close((err) => {
            if (err) return done(err);
            done();
        });
    });

    // Test the /api/login endpoint
    describe('POST /api/login', () => {
        it('should login the default admin user with correct credentials', async () => {
            const res = await request(app)
                .post('/api/login')
                .send({
                    username: 'admin',
                    password: 'password', // Default credentials
                });
            expect(res.statusCode).toEqual(200);
            expect(res.body).toHaveProperty('success', true);
            expect(res.body).toHaveProperty('user');
            expect(res.body.user.username).toBe('admin');
            expect(res.body.user.role).toBe('admin');
        });

        it('should fail with incorrect credentials', async () => {
            const res = await request(app)
                .post('/api/login')
                .send({
                    username: 'admin',
                    password: 'wrongpassword',
                });
            expect(res.statusCode).toEqual(401);
            expect(res.body).toHaveProperty('error', 'Invalid username or password.');
        });

        it('should fail if username does not exist', async () => {
            const res = await request(app)
                .post('/api/login')
                .send({
                    username: 'nonexistentuser',
                    password: 'password',
                });
            expect(res.statusCode).toEqual(401);
        });
    });

    // Test the /api/auth/status endpoint
    describe('GET /api/auth/status', () => {
        it('should return not authenticated by default', async () => {
            const res = await request(app).get('/api/auth/status');
            expect(res.statusCode).toEqual(200);
            expect(res.body).toHaveProperty('isAuthenticated', false);
        });

        it('should return authenticated after logging in', async () => {
            const agent = request.agent(app); // Use an agent to persist cookies/session
            await agent
                .post('/api/login')
                .send({ username: 'admin', password: 'password' });

            const res = await agent.get('/api/auth/status');
            expect(res.statusCode).toEqual(200);
            expect(res.body).toHaveProperty('isAuthenticated', true);
            expect(res.body.user.username).toBe('admin');
        });
    });

    // Test the /api/logout endpoint
    describe('POST /api/logout', () => {
        it('should log the user out', async () => {
            const agent = request.agent(app);
            await agent
                .post('/api/login')
                .send({ username: 'admin', password: 'password' });

            // Check we are logged in
            let statusRes = await agent.get('/api/auth/status');
            expect(statusRes.body.isAuthenticated).toBe(true);

            // Logout
            const logoutRes = await agent.post('/api/logout');
            expect(logoutRes.statusCode).toEqual(200);
            expect(logoutRes.body).toHaveProperty('success', true);

            // Check we are logged out
            statusRes = await agent.get('/api/auth/status');
            expect(statusRes.body.isAuthenticated).toBe(false);
        });
    });
});
