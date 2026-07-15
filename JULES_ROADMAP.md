# JULES Roadmap

## Project Overview
SVEO is a lightweight video‑sharing web application built with Node.js and Express. It provides user authentication, session management, and basic file‑upload capabilities using Multer. The client‑side is a simple single‑page app (SPA) with HTML, JavaScript, and CSS, offering pages for the home feed, video playback, and user settings. The back‑end uses SQLite for persistent storage and includes security middleware (Helmet, CORS, etc.) to protect the application. The project is containerized with Docker Compose for easy local development and deployment.

## Next Features
- [ ] Implement full user registration and login flows (email/password) with bcrypt password hashing, session‑based authentication, and secure cookie handling.
- [ ] Add a video upload endpoint that validates file type/size, stores video files in a dedicated directory, and records metadata (title, description, owner) in the SQLite database.
- [ ] Create a user profile/dashboard page that lists the currently logged‑in user’s uploaded videos and provides actions to view, rename, or delete them.
- [ ] Enhance the existing settings page to allow users to change email, set a new password, and upload a profile picture (with validation and storage).
- [ ] Integrate a robust video player using video.js with adaptive streaming support, playback controls, and optional subtitle/track support.
- [ ] Build an admin moderation panel that lets moderators review pending video uploads, approve or reject them, and manage user accounts.
- [ ] Add rate‑limiting and CSRF protection middleware to secure API routes against abuse and cross‑site request forgery.
- [ ] Set up an automated CI/CD pipeline (GitHub Actions) that builds a Docker image, runs tests, and deploys the container to a cloud platform (e.g., AWS ECS, DigitalOcean App Platform).

## Recent Progress