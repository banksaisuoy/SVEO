document.addEventListener('DOMContentLoaded', () => {
    const currentPage = window.location.pathname.split('/').pop();

    // --- GLOBAL AUTH CHECK ---
    const checkAuthStatus = async () => {
        try {
            const response = await fetch('/api/auth/status');
            if (!response.ok) return { isAuthenticated: false };
            return await response.json();
        } catch (error) {
            console.error('Failed to check auth status:', error);
            return { isAuthenticated: false };
        }
    };

    // --- ROUTING ---
    (async () => {
        const { isAuthenticated, user } = await checkAuthStatus();
        if (currentPage === 'index.html' || currentPage === '') {
            if (isAuthenticated) window.location.href = 'dashboard.html';
            else initializeLoginPage();
        } else if (currentPage === 'dashboard.html') {
            if (!isAuthenticated) window.location.href = 'index.html';
            else initializeDashboard(user);
        }
    })();

    // --- LOGIN PAGE ---
    function initializeLoginPage() {
        const loginForm = document.getElementById('login-form');
        const errorMessage = document.getElementById('error-message');
        if (!loginForm) return;

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            errorMessage.textContent = '';
            const { username, password } = e.target.elements;

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: username.value, password: password.value }),
                });
                const data = await response.json();
                if (response.ok) window.location.href = 'dashboard.html';
                else errorMessage.textContent = data.error || 'An unknown error occurred.';
            } catch (error) {
                errorMessage.textContent = 'Failed to connect to the server.';
            }
        });
    }

    // --- DASHBOARD ---
    function initializeDashboard(user) {
        // Page elements
        const welcomeMessage = document.getElementById('welcome-message');
        const adminTools = document.getElementById('admin-tools');
        const logoutBtn = document.getElementById('logout-btn');

        // Admin panel buttons
        const showVideosBtn = document.getElementById('show-videos-btn');
        const showUsersBtn = document.getElementById('show-users-btn');
        const showTagsBtn = document.getElementById('show-tags-btn');

        // Content sections
        const sections = {
            videos: document.getElementById('videos-section'),
            users: document.getElementById('users-section'),
            tags: document.getElementById('tags-section'),
        };

        // Set welcome message and logout
        if (welcomeMessage) welcomeMessage.textContent = `Welcome, ${user.username} (${user.role})`;
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                await fetch('/api/logout', { method: 'POST' });
                window.location.href = 'index.html';
            });
        }

        // Show admin tools and set up listeners if admin
        if (user.role === 'admin' && adminTools) {
            adminTools.style.display = 'block';

            const switchView = (view) => {
                Object.values(sections).forEach(s => s.classList.remove('active'));
                if (sections[view]) sections[view].classList.add('active');
            };

            showVideosBtn.addEventListener('click', () => {
                switchView('videos');
                renderVideos();
            });
            showUsersBtn.addEventListener('click', () => {
                switchView('users');
                renderUsers();
            });
            showTagsBtn.addEventListener('click', () => {
                switchView('tags');
                renderTags();
            });
        }

        // Initial content load
        renderVideos();

        // --- Event listener for video upload form ---
        const videoUploadForm = document.getElementById('video-upload-form');
        if (videoUploadForm) {
            videoUploadForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(videoUploadForm);

                try {
                    const response = await fetch('/api/videos/upload', {
                        method: 'POST',
                        body: formData,
                        // No 'Content-Type' header, browser sets it for multipart/form-data
                    });

                    const data = await response.json();
                    if (response.ok) {
                        alert('Video uploaded successfully!');
                        videoUploadForm.reset();
                        renderVideos(); // Refresh the video list
                    } else {
                        alert(`Error: ${data.error}`);
                    }
                } catch (error) {
                    console.error('Upload failed:', error);
                    alert('Upload failed. Check the console for details.');
                }
            });
        }
    }

    // --- DATA FETCHING & RENDERING ---
    async function fetchData(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                console.error(`Failed to fetch ${url}:`, await response.text());
                return [];
            }
            return await response.json();
        } catch (error) {
            console.error(`Error during fetch from ${url}:`, error);
            return [];
        }
    }

    async function renderVideos() {
        const gallery = document.getElementById('video-gallery');
        if (!gallery) return;
        const videos = await fetchData('/api/videos');
        if (videos.length === 0) {
            gallery.innerHTML = '<p>No videos found.</p>';
            return;
        }
        gallery.innerHTML = videos.map(video => `
            <div class="video-card" style="border: 1px solid #ccc; padding: 1rem; margin-bottom: 1rem;">
                <h4>${video.title}</h4>
                <p>Description: ${video.description || 'N/A'}</p>
                <p>Category: ${video.category || 'N/A'}</p>
                <p>Tags: ${video.tags || 'None'}</p>
                <a href="${video.url}" target="_blank">Watch Video</a>
            </div>
        `).join('');
    }

    async function renderUsers() {
        const userList = document.getElementById('user-list');
        if (!userList) return;
        const users = await fetchData('/api/users');
        userList.innerHTML = `
            <table border="1" style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Username</th>
                        <th>Role</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map(user => `
                        <tr>
                            <td>${user.id}</td>
                            <td>${user.username}</td>
                            <td>${user.role}</td>
                            <td><button>Edit</button> <button>Delete</button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    async function renderTags() {
        const tagList = document.getElementById('tag-list');
        if (!tagList) return;
        const tags = await fetchData('/api/tags');
        tagList.innerHTML = `
            <table border="1" style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${tags.map(tag => `
                        <tr>
                            <td>${tag.id}</td>
                            <td>${tag.name}</td>
                            <td><button>Edit</button> <button>Delete</button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
});
