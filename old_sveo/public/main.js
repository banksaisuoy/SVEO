// --------------------------------------------------------------------------------------------------
// --- File: public/main.js ---
// --------------------------------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements (use let so we can safely replace missing elements with fallbacks)
    let appContainer = document.getElementById('app-container');
    let adminLoginBtn = document.getElementById('admin-login-btn');
    let adminLogoutBtn = document.getElementById('admin-logout-btn');
    let loginModal = document.getElementById('login-modal');
    let videoGallery = document.getElementById('video-gallery');
    let categoryFilter = document.getElementById('category-filter');
    let searchBar = document.getElementById('search-bar');
    let adminTools = document.getElementById('admin-tools');
    let addVideoBtn = document.getElementById('add-video-btn');
    let manageCategoriesBtn = document.getElementById('manage-categories-btn');
    let videoModal = document.getElementById('video-modal');
    let manageCategoriesModal = document.getElementById('manage-categories-modal');
    let loginForm = document.getElementById('login-form');
    let videoForm = document.getElementById('video-form');
    let addCategoryForm = document.getElementById('add-category-form');
    let categoryListAdmin = document.getElementById('category-list-admin');
    let modalTitle = document.getElementById('modal-title');
    let videoIdInput = document.getElementById('video-id');
    let videoTitleInput = document.getElementById('video-title');
    let videoDescriptionInput = document.getElementById('video-description');
    let videoUrlInput = document.getElementById('video-url');
    let videoThumbnailInput = document.getElementById('video-thumbnail');
    let videoCategorySelect = document.getElementById('video-category');
    let videoPlayerModal = document.getElementById('video-player-modal');
    let videoPlayer = document.getElementById('video-player');
    let playerTitle = document.getElementById('player-title');
    let playerDescription = document.getElementById('player-description');
    let confirmModal = document.getElementById('confirm-modal');
    let confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    let cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    let messageBox = document.getElementById('message-box');
    let messageText = document.getElementById('message-text');
    let closeMessageBtn = document.getElementById('close-message-btn');
    let themeToggleButton = document.getElementById('theme-toggle-btn');
    let themeIcon = document.getElementById('theme-icon');
    let langToggleButton = document.getElementById('lang-toggle-btn');
    const body = document.body;
    let manageUsersBtn = document.getElementById('manage-users-btn');
    let tagFilter = document.getElementById('tag-filter');
    let favoritesBtn = document.getElementById('favorites-btn');
    let historyBtn = document.getElementById('history-btn');
    let manageTagsBtn = document.getElementById('manage-tags-btn');
    let manageTagsModal = document.getElementById('manage-tags-modal');
    let addTagForm = document.getElementById('add-tag-form');
    let tagListAdmin = document.getElementById('tag-list-admin');
    let videoFileInput = document.getElementById('video-file-input');
    let manageUsersModal = document.getElementById('manage-users-modal');
    let manageUsersList = document.getElementById('manage-users-list');
    let addUserForm = document.getElementById('add-user-form');
    let newUsernameInput = document.getElementById('new-username');
    let newPasswordInput = document.getElementById('new-password');
    let newRoleSelect = document.getElementById('new-role');

    // Helper: ensure element exists; if not, create a minimal fallback and append to appContainer
    function ensureElement(id, tag = 'div') {
        let el = document.getElementById(id);
        if (el) return el;
        try {
            el = document.createElement(tag);
            el.id = id;
            // minimal stubs
            el.classList ||= [];
            el.style ||= {};
            // ensure classList methods exist to avoid errors
            if (!el.classList || typeof el.classList.add !== 'function') {
                el.classList = { add: () => {}, remove: () => {}, toggle: () => {} };
            }
            if (!appContainer) document.body.appendChild(el); else appContainer.appendChild(el);
            return el;
        } catch (e) {
            return document.createElement('div');
        }
    }
    // timestamp-touch: 2025-09-09 - visual polish applied

    // Create fallbacks for any missing DOM nodes to prevent runtime crashes
    appContainer = appContainer || ensureElement('app-container', 'div');
    adminLoginBtn = adminLoginBtn || ensureElement('admin-login-btn','button');
    adminLogoutBtn = adminLogoutBtn || ensureElement('admin-logout-btn','button');
    loginModal = loginModal || ensureElement('login-modal','div');
    videoGallery = videoGallery || ensureElement('video-gallery','div');
    categoryFilter = categoryFilter || ensureElement('category-filter','div');
    searchBar = searchBar || ensureElement('search-bar','input');
    adminTools = adminTools || ensureElement('admin-tools','div');
    addVideoBtn = addVideoBtn || ensureElement('add-video-btn','button');
    manageCategoriesBtn = manageCategoriesBtn || ensureElement('manage-categories-btn','button');
    videoModal = videoModal || ensureElement('video-modal','div');
    manageCategoriesModal = manageCategoriesModal || ensureElement('manage-categories-modal','div');
    loginForm = loginForm || ensureElement('login-form','form');
    videoForm = videoForm || ensureElement('video-form','form');
    addCategoryForm = addCategoryForm || ensureElement('add-category-form','form');
    categoryListAdmin = categoryListAdmin || ensureElement('category-list-admin','div');
    modalTitle = modalTitle || ensureElement('modal-title','h2');
    videoIdInput = videoIdInput || ensureElement('video-id','input');
    videoTitleInput = videoTitleInput || ensureElement('video-title','input');
    videoDescriptionInput = videoDescriptionInput || ensureElement('video-description','textarea');
    videoUrlInput = videoUrlInput || ensureElement('video-url','input');
    videoThumbnailInput = videoThumbnailInput || ensureElement('video-thumbnail','input');
    videoCategorySelect = videoCategorySelect || ensureElement('video-category','select');
    videoPlayerModal = videoPlayerModal || ensureElement('video-player-modal','div');
    videoPlayer = videoPlayer || ensureElement('video-player','div');
    playerTitle = playerTitle || ensureElement('player-title','h3');
    playerDescription = playerDescription || ensureElement('player-description','p');
    confirmModal = confirmModal || ensureElement('confirm-modal','div');
    confirmDeleteBtn = confirmDeleteBtn || ensureElement('confirm-delete-btn','button');
    cancelDeleteBtn = cancelDeleteBtn || ensureElement('cancel-delete-btn','button');
    messageBox = messageBox || ensureElement('message-box','div');
    messageText = messageText || ensureElement('message-text','p');
    closeMessageBtn = closeMessageBtn || ensureElement('close-message-btn','button');
    themeToggleButton = themeToggleButton || ensureElement('theme-toggle-btn','button');
    themeIcon = themeIcon || ensureElement('theme-icon','i');
    langToggleButton = langToggleButton || ensureElement('lang-toggle-btn','button');
    manageUsersBtn = manageUsersBtn || ensureElement('manage-users-btn','button');
    tagFilter = tagFilter || ensureElement('tag-filter','div');
    favoritesBtn = favoritesBtn || ensureElement('favorites-btn','button');
    historyBtn = historyBtn || ensureElement('history-btn','button');
    manageTagsBtn = manageTagsBtn || ensureElement('manage-tags-btn','button');
    manageTagsModal = manageTagsModal || ensureElement('manage-tags-modal','div');
    addTagForm = addTagForm || ensureElement('add-tag-form','form');
    tagListAdmin = tagListAdmin || ensureElement('tag-list-admin','div');
    videoFileInput = videoFileInput || ensureElement('video-file-input','input');
    manageUsersModal = manageUsersModal || ensureElement('manage-users-modal','div');
    manageUsersList = manageUsersList || ensureElement('manage-users-list','div');
    addUserForm = addUserForm || ensureElement('add-user-form','form');
    newUsernameInput = newUsernameInput || ensureElement('new-username','input');
    newPasswordInput = newPasswordInput || ensureElement('new-password','input');
    newRoleSelect = newRoleSelect || ensureElement('new-role','select');

    let allVideos = [];
    let allCategories = [];
    let allTags = [];
    let currentFilteredVideos = [];
    let currentUser = null;
    let favoriteIds = new Set();

    // Small toast helper (non-blocking) for UX messages - styled
    function showToast(text, duration = 3500, type = 'neutral') {
        let t = document.getElementById('site-toast');
        if (!t) {
            t = document.createElement('div'); t.id = 'site-toast'; t.className = 'fixed right-4 bottom-6 z-60';
            document.body.appendChild(t);
        }
        const el = document.createElement('div'); el.className = 'site-toast-item';
        if (type === 'error') el.style.background = 'linear-gradient(90deg,#7f1d1d,#3b021f)';
        if (type === 'success') el.style.background = 'linear-gradient(90deg,#064e3b,#065f46)';
        el.textContent = text;
        t.appendChild(el);
        el.style.opacity = '0'; el.style.transform = 'translateY(6px)';
        requestAnimationFrame(()=>{ el.style.transition = 'transform 220ms ease, opacity 220ms ease'; el.style.opacity = '1'; el.style.transform = 'translateY(0)'; });
        setTimeout(()=>{ el.style.opacity = '0'; el.style.transform = 'translateY(6px)'; setTimeout(()=>el.remove(),300); }, duration);
    }

    // Debounce helper
    function debounce(fn, wait = 300) {
        let t;
        return (...args) => { clearTimeout(t); t = setTimeout(()=>fn(...args), wait); };
    }

    // Global error handler: surface the login modal if an unexpected error occurs
    // This avoids the app showing a blank page when a client-side exception aborts execution.
    // Capture and report client errors to the server and show a user-friendly message
    window.addEventListener('error', (e) => {
        try {
            const payload = { message: e.message || String(e), stack: (e.error && e.error.stack) || null, filename: e.filename || null, lineno: e.lineno || null };
            console.error('Unhandled error', payload);
            // send to server for debugging (best-effort)
            fetch('/api/client-error', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(()=>{});
            // Show a visible message box to user
            try { document.getElementById('message-text').textContent = 'An error occurred. Please refresh the page.'; showModal(document.getElementById('message-box')); } catch(_){ }
        } catch (ee) { console.error('Error in global error handler', ee); }
    });

    window.addEventListener('unhandledrejection', (ev) => {
        try {
            const payload = { message: ev.reason ? (ev.reason.message || String(ev.reason)) : 'Unhandled rejection', stack: ev.reason && ev.reason.stack ? ev.reason.stack : null };
            console.error('Unhandled promise rejection', payload);
            fetch('/api/client-error', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(()=>{});
            try { document.getElementById('message-text').textContent = 'An error occurred. Please refresh the page.'; showModal(document.getElementById('message-box')); } catch(_){ }
        } catch (e) { console.error('Error in rejection handler', e); }
    });


    // Language management
    let currentLang = localStorage.getItem('lang') || 'th';
    const translations = {
        'th': {
            'login': 'เข้าสู่ระบบ',
            'logout': 'ออกจากระบบ',
            'toggleTheme': 'เปลี่ยนธีม',
            'toggleLang': 'EN',
            'searchVideo': 'ค้นหาวิดีโอ...',
            'addVideo': 'เพิ่มวิดีโอ',
            'manageCategories': 'จัดการหมวดหมู่',
            'loginTitle': 'เข้าสู่ระบบ',
            'username': 'ชื่อผู้ใช้',
            'password': 'รหัสผ่าน',
            'cancel': 'ยกเลิก',
            'loginBtn': 'เข้าสู่ระบบ',
            'videoTitle': 'ชื่อวิดีโอ',
            'description': 'คำอธิบาย',
            'thumbnailUrl': 'URL รูปหน้าปก (Thumbnail)',
            'category': 'หมวดหมู่',
            'saveVideo': 'บันทึกวิดีโอ',
            'manageCategoriesTitle': 'จัดการหมวดหมู่',
            'addNewCategory': 'เพิ่มหมวดหมู่ใหม่',
            'categoryName': 'ชื่อหมวดหมู่',
            'add': 'เพิ่ม',
            'existingCategories': 'หมวดหมู่ที่มีอยู่',
            'close': 'ปิด',
            'confirmDelete': 'คุณแน่ใจหรือไม่ว่าต้องการลบ?',
            'delete': 'ลบ',
            'ok': 'ตกลง',
            'noVideos': 'ไม่มีวิดีโอในหมวดหมู่นี้',
            'noDescription': 'ไม่มีคำอธิบาย',
            'edit': 'แก้ไข',
            'deleteBtn': 'ลบ',
            'all': 'ทั้งหมด',
            'loginSuccess': 'เข้าสู่ระบบสำเร็จ!',
            'logoutSuccess': 'ออกจากระบบแล้ว',
            'videoSaved': 'วิดีโอบันทึกเรียบร้อย!',
        'videoAdded': 'เพิ่มวิดีโอสำเร็จ!',
            'videoUpdated': 'อัปเดตวิดีโอสำเร็จ!',
            'categoryAdded': 'เพิ่มหมวดหมู่สำเร็จ!',
            'categoryDeleted': 'ลบหมวดหมู่สำเร็จ!',
        'manageUsers': 'จัดการผู้ใช้',
        'orUpload': 'หรืออัปโหลดไฟล์วิดีโอจากเครื่อง',
        'createUser': 'สร้างผู้ใช้',
        'role': 'บทบาท',
        'adminRole': 'ผู้ดูแลระบบ',
        'userRole': 'ผู้ใช้ทั่วไป',
        'makeAdmin': 'กำหนดเป็นแอดมิน',
        'makeUser': 'กำหนดเป็นผู้ใช้',
        'userCreated': 'สร้างผู้ใช้เรียบร้อย',
        'userUpdated': 'อัปเดตผู้ใช้เรียบร้อย',
        'userDeleted': 'ลบผู้ใช้เรียบร้อย',
        'usernameExists': 'ชื่อผู้ใช้นี้มีอยู่แล้ว',
            'invalidUrl': 'URL วิดีโอไม่ถูกต้อง. โปรดใช้ลิงก์จาก YouTube',
            'failedFetch': 'การเชื่อมต่อล้มเหลว. โปรดตรวจสอบเซิร์ฟเวอร์',
            'feature': 'แนะนำ',
            'featureBtn': 'แนะนำ',
            'featureToggleTitle': 'สลับสถานะแนะนำ',
            'markedFeatured': 'ทำเครื่องหมายว่าแนะนำ',
            'unfeatured': 'ยกเลิกการแนะนำ',
            'commentPosted': 'โพสต์คอมเมนต์เรียบร้อย',
            'failedPost': 'ไม่สามารถโพสต์ความคิดเห็นได้',
            'loadingComments': 'กำลังโหลดความคิดเห็น...',
            'noComments': 'ยังไม่มีความคิดเห็น',
            'failedLoadComments': 'ไม่สามารถโหลดความคิดเห็นได้',
            'videoLabel': 'วิดีโอ',
            'loginFailed': 'เข้าสู่ระบบไม่สำเร็จ',
            'genericError': 'เกิดข้อผิดพลาด',
            'trending': 'ยอดนิยม',
            'noFeatured': 'ยังไม่มีวิดีโอแนะนำ',
        },
        'en': {
            'login': 'Login',
            'logout': 'Logout',
            'toggleTheme': 'Toggle Theme',
            'toggleLang': 'TH',
            'searchVideo': 'Search videos...',
            'addVideo': 'Add Video',
            'manageCategories': 'Manage Categories',
            'loginTitle': 'Login',
            'username': 'Username',
            'password': 'Password',
            'cancel': 'Cancel',
            'loginBtn': 'Login',
            'videoTitle': 'Video Title',
            'description': 'Description',
            'thumbnailUrl': 'Thumbnail URL',
            'category': 'Category',
            'saveVideo': 'Save Video',
            'manageCategoriesTitle': 'Manage Categories',
            'addNewCategory': 'Add New Category',
            'categoryName': 'Category Name',
            'add': 'Add',
            'existingCategories': 'Existing Categories',
            'close': 'Close',
            'confirmDelete': 'Are you sure you want to delete?',
            'delete': 'Delete',
            'ok': 'OK',
            'noVideos': 'No videos in this category',
            'noDescription': 'No description',
            'edit': 'Edit',
            'deleteBtn': 'Delete',
            'all': 'All',
            'loginSuccess': 'Login successful!',
            'logoutSuccess': 'Logged out successfully',
            'videoSaved': 'Video saved!',
            'videoAdded': 'Video added successfully!',
            'videoUpdated': 'Video updated successfully!',
            'categoryAdded': 'Category added!',
            'categoryDeleted': 'Category deleted!',
            'manageUsers': 'Manage Users',
            'orUpload': 'or upload video file from device',
            'createUser': 'Create User',
            'role': 'Role',
            'adminRole': 'Admin',
            'userRole': 'User',
            'makeAdmin': 'Make Admin',
            'makeUser': 'Make User',
            'userCreated': 'User created',
            'userUpdated': 'User updated',
            'userDeleted': 'User deleted',
            'usernameExists': 'Username already exists',
            'invalidUrl': 'Invalid video URL. Please use a YouTube link.',
            'failedFetch': 'Connection failed. Please check the server.',
            'feature': 'Featured',
            'featureBtn': 'Feature',
            'featureToggleTitle': 'Mark/unmark featured',
            'markedFeatured': 'Marked as featured',
            'unfeatured': 'Un-featured',
            'commentPosted': 'Comment posted',
            'failedPost': 'Failed to post',
            'loadingComments': 'Loading comments...',
            'noComments': 'No comments',
            'failedLoadComments': 'Failed to load comments',
            'videoLabel': 'Video',
            'loginFailed': 'Login failed',
            'genericError': 'Error',
            'trending': 'Trending',
            'noFeatured': 'No featured video',
        }
    };

    function setLanguage(lang) {
        currentLang = lang;
        localStorage.setItem('lang', lang);
        document.documentElement.lang = lang;
        document.querySelectorAll('[data-lang-key]').forEach(el => {
            const key = el.getAttribute('data-lang-key');
            el.textContent = translations[lang][key];
        });
        document.querySelectorAll('[data-lang-placeholder]').forEach(el => {
            const key = el.getAttribute('data-lang-placeholder');
            el.placeholder = translations[lang][key];
        });
        // Re-render videos and categories to update their text
        displayVideos(currentFilteredVideos);
        displayCategories(allCategories);
        // Special case for language button text
        langToggleButton.textContent = translations[lang]['toggleLang'];
        // Update modal titles
        document.getElementById('modal-title').textContent = translations[lang]['videoTitle'];
        document.querySelector('#login-modal h2').textContent = translations[lang]['loginTitle'];
        document.querySelector('#manage-categories-modal h2').textContent = translations[lang]['manageCategoriesTitle'];
    }

    // Helper function to show modals (adds .show class so CSS handles animation)
    function showModal(modalElement) {
        if (!modalElement) return;
        modalElement.classList.add('show');
    }

    // Helper function to hide modals
    function hideModal(modalElement) {
        if (!modalElement) return;
        modalElement.classList.remove('show');
    }

    // Close modal when clicking on backdrop (but not when clicking inside the modal-content)
    document.addEventListener('click', (ev) => {
        const modal = ev.target.closest && ev.target.closest('.modal');
        if (modal && modal.classList.contains('show')) {
            const content = ev.target.closest('.modal-content');
            if (!content) {
                hideModal(modal);
            }
        }
    });

    // Close modal on ESC
    document.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') {
            document.querySelectorAll('.modal.show').forEach(m => hideModal(m));
        }
    });

    // Initialize all modal-close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest && e.target.closest('.modal');
            if (modal) hideModal(modal);
        });
    });

    // Show a custom message box instead of `alert()`
    function showMessage(message) {
        messageText.textContent = message;
        showModal(messageBox);
    }

    // Function to show the custom confirmation modal
    function showConfirmModal(callback) {
        document.getElementById('confirm-text').textContent = translations[currentLang]['confirmDelete'];
        document.getElementById('cancel-delete-btn').textContent = translations[currentLang]['cancel'];
        document.getElementById('confirm-delete-btn').textContent = translations[currentLang]['delete'];
        showModal(confirmModal);
        confirmDeleteBtn.onclick = () => {
            hideModal(confirmModal);
            callback(true);
        };
        cancelDeleteBtn.onclick = () => {
            hideModal(confirmModal);
            callback(false);
        };
    }

    // Function to convert YouTube URL to embed URL
    function convertUrlToEmbed(url) {
        const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        const match = url.match(youtubeRegex);
        if (match && match[1]) {
            return `https://www.youtube.com/embed/${match[1]}`;
        }
        return url; // Return original if no match
    }
    
    // Function to get YouTube video ID from a URL
    function getYouTubeVideoId(url) {
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        const match = url.match(regex);
        return (match && match[1]) ? match[1] : null;
    }

    // Function to get YouTube thumbnail URL from a video ID
    function getYouTubeThumbnail(videoId) {
        return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    }

    // Helper to include credentials (cookies) with every fetch so session is preserved
    async function apiFetch(url, opts = {}) {
        opts.credentials = 'include';
        return fetch(url, opts);
    }

    // Check admin authentication status and show/hide controls
    async function checkAuthStatus() {
        try {
            const res = await apiFetch('/api/auth/status');
            const data = await res.json();
            const isAuthenticated = data.isAuthenticated;
            const user = data.user || null;
            // maintain current user state
            currentUser = user;
            // If not authenticated, require login-first: hide main UI and show login modal
            if (!isAuthenticated) {
                try {
                    adminLoginBtn.classList.remove('hidden');
                    adminLogoutBtn.classList.add('hidden');
                    adminTools.classList.add('hidden');
                    document.getElementById('main-header').classList.add('hidden');
                    document.getElementById('main-content').classList.add('hidden');
                    // show login modal (centered screen) and do NOT load app data until authenticated
                    showModal(loginModal);
                } catch (e) { console.error('Auth check display error', e); }
                return;
            }

            // Authenticated: show main UI
            hideModal(loginModal);
            document.getElementById('main-header').classList.remove('hidden');
            document.getElementById('main-content').classList.remove('hidden');
            adminLoginBtn.classList.add('hidden');
            adminLogoutBtn.classList.remove('hidden');

            // Role handling: admin vs normal user
            const isAdmin = user && user.role === 'admin';
            if (isAdmin) {
                adminTools.classList.remove('hidden');
                if (addVideoBtn) addVideoBtn.classList.remove('hidden');
            } else {
                adminTools.classList.add('hidden');
                if (addVideoBtn) addVideoBtn.classList.add('hidden');
            }
            // Toggle individual video card admin controls (if gallery is already rendered)
            document.querySelectorAll('.admin-controls').forEach(controls => {
                if (isAdmin) controls.classList.remove('hidden'); else controls.classList.add('hidden');
            });
            // Load app data once authenticated
            await fetchSettings();
            await fetchVideos();
            await fetchCategories();
            await fetchTags();
            // show favorites/history buttons for logged-in users
            if (favoritesBtn) favoritesBtn.classList.remove('hidden');
            if (historyBtn) historyBtn.classList.remove('hidden');
        } catch (err) {
            console.error('Failed to check auth status:', err);
            // On any failure to reach auth endpoint, keep login modal visible
            try { const lm = document.getElementById('login-modal'); if (lm) lm.style.display = 'flex'; } catch(e){}
        }
    }

    // Fetch site settings (title, primary color)
    async function fetchSettings() {
        try {
            // Only fetch settings when user is admin to avoid 403 for normal users
            if (!currentUser || currentUser.role !== 'admin') return;
            const res = await apiFetch('/api/settings');
            if (!res.ok) return;
            const s = await res.json();
            if (s.title) document.querySelector('h1') && (document.querySelector('h1').textContent = s.title);
            if (s.primaryColor) document.documentElement.style.setProperty('--primary', s.primaryColor);
        } catch (err) { console.error('Failed to fetch settings', err); }
    }

    // Fetch and display videos
    async function fetchVideos() {
        // show skeletons while loading
        const trendingList = document.getElementById('trending-list');
        const featuredWrap = document.getElementById('featured-wrap');
        if (trendingList) trendingList.innerHTML = '<div class="skeleton-thumb"></div><div class="skeleton-thumb"></div>';
        if (featuredWrap) featuredWrap.innerHTML = '<div class="skeleton-thumb"></div>';
        try {
            const res = await apiFetch('/api/videos');
            if (res.ok) {
                allVideos = await res.json();
                displayVideos(allVideos);
                // Refresh homepage extras (featured/trending/popular/continue)
                try { populateHomepageExtras(); } catch(e) { console.error('populateHomepageExtras failed', e); }
            } else {
                const errorData = await res.json();
                showMessage(`Error fetching videos: ${errorData.error || res.statusText}`);
            }
        } catch (err) {
            showMessage(translations[currentLang]['failedFetch']);
        } finally {
            // clear skeletons if populateHomepageExtras failed to replace
            if (trendingList && trendingList.querySelectorAll('.skeleton-thumb').length) trendingList.innerHTML = '';
            if (featuredWrap && featuredWrap.querySelectorAll('.skeleton-thumb').length) featuredWrap.innerHTML = '';
        }
    }

    // Fetch and display categories
    async function fetchCategories() {
        try {
            const res = await apiFetch('/api/categories');
            if (res.ok) {
                allCategories = await res.json();
                displayCategories(allCategories);
                populateCategoryDropdown(allCategories);
            } else {
                const errorData = await res.json();
                showMessage(`Error fetching categories: ${errorData.error || res.statusText}`);
            }
        } catch (err) {
            console.error('Failed to fetch categories:', err);
            showMessage(translations[currentLang]['failedFetch']);
        }
    }

    // Render video cards
    function displayVideos(videos) {
        // Use a DocumentFragment to reduce reflows and layout shifts
        videoGallery.innerHTML = ''; // Clear existing cards
        if (!videos || videos.length === 0) {
            videoGallery.innerHTML = `<div class="col-span-full text-center py-8 text-gray-400">${translations[currentLang]['noVideos']}</div>`;
            return;
        }

        const frag = document.createDocumentFragment();

        videos.forEach(video => {
            const card = document.createElement('div');
            card.className = 'bg-gray-800 rounded-xl shadow-lg overflow-hidden cursor-pointer transform transition-transform duration-300 hover:scale-105 video-card';
            card.setAttribute('data-id', video.id);
            // Dynamic thumbnail URL generation
            let thumbnailUrl = 'https://placehold.co/400x225/1f2937/d1d5db?text=No+Thumbnail'; // Default placeholder
            if (video.thumbnail_url) {
                thumbnailUrl = video.thumbnail_url;
            } else if (video.url) {
                const videoId = getYouTubeVideoId(video.url);
                if (videoId) {
                    thumbnailUrl = getYouTubeThumbnail(videoId);
                }
            }

            // build thumbnail container with skeleton
            const thumbWrap = document.createElement('div');
            thumbWrap.className = 'video-thumb-wrap';
            const skeleton = document.createElement('div');
            skeleton.className = 'thumb-skeleton';
            const img = document.createElement('img');
            img.className = 'video-thumbnail transition-all duration-300';
            img.alt = video.title;
            img.loading = 'lazy';
            img.src = thumbnailUrl;
            img.onerror = () => { img.src = 'https://placehold.co/400x225/1f2937/d1d5db?text=No+Thumbnail'; };
            img.addEventListener('load', () => {
                img.classList.add('loaded');
                if (skeleton && skeleton.parentNode) skeleton.parentNode.removeChild(skeleton);
            });
            thumbWrap.appendChild(img);
            thumbWrap.appendChild(skeleton);

            // Favorite overlay
            const favBtn = document.createElement('div');
            favBtn.className = 'favorite-overlay';
            favBtn.innerHTML = '<i class="fas fa-star"></i>';
            favBtn.title = 'Favorite';
            favBtn.addEventListener('click', async (ev) => {
                ev.stopPropagation();
                if (!currentUser) return showMessage(translations[currentLang]['login']);
                try {
                    const vidStr = String(video.id);
                    const isFav = favoriteIds.has(vidStr);
                    if (isFav) {
                        const r = await apiFetch(`/api/favorites/${video.id}`, { method: 'DELETE' });
                        if (r.ok) {
                            favoriteIds.delete(vidStr);
                            favBtn.classList.remove('favorited');
                        }
                    } else {
                        const r = await apiFetch('/api/favorites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ video_id: video.id }) });
                        if (r.ok) {
                            // add to local set; server returns id but we don't strictly need it
                            favoriteIds.add(vidStr);
                            favBtn.classList.add('favorited');
                        }
                    }
                } catch (err) { console.error('Fav toggle failed', err); }
            });
            thumbWrap.appendChild(favBtn);

            // Featured badge overlay
            if (video.featured && Number(video.featured) === 1) {
                const badge = document.createElement('div');
                badge.className = 'absolute left-3 top-3 bg-gradient-to-r from-green-500 to-teal-400 text-white px-3 py-1 rounded-full text-sm font-semibold';
                badge.textContent = 'แนะนำ';
                thumbWrap.appendChild(badge);
            }

            const meta = document.createElement('div');
            meta.className = 'p-4 video-meta';
            const h3 = document.createElement('h3');
            h3.className = 'font-bold text-lg text-white';
            h3.textContent = video.title;
            const p = document.createElement('p');
            p.className = 'text-sm text-gray-400 mt-1';
            p.textContent = video.description || translations[currentLang]['noDescription'];
            const adminControls = document.createElement('div');
            adminControls.className = 'mt-4 flex space-x-2 admin-controls hidden';
            const editBtn = document.createElement('button');
            editBtn.className = 'py-1 px-3 text-xs font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 edit-btn';
            editBtn.dataset.id = video.id;
            editBtn.textContent = translations[currentLang]['edit'];
            const delBtn = document.createElement('button');
            delBtn.className = 'py-1 px-3 text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 delete-btn';
            delBtn.dataset.id = video.id;
            delBtn.textContent = translations[currentLang]['deleteBtn'];
            const featBtn = document.createElement('button');
            featBtn.className = 'py-1 px-3 text-xs font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700 feature-btn';
            featBtn.dataset.id = video.id;
            featBtn.textContent = translations[currentLang]['featureBtn'] || 'Feature';
            featBtn.title = translations[currentLang]['featureToggleTitle'] || 'Mark/unmark featured';
            featBtn.addEventListener('click', async (ev) => {
                ev.stopPropagation();
                try {
                    const res = await apiFetch(`/api/videos/${video.id}/featured`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ featured: video.featured ? 0 : 1 }) });
                    if (res.ok) { showToast(video.featured ? translations[currentLang]['unfeatured'] : translations[currentLang]['markedFeatured'], 2500, 'success'); fetchVideos(); populateHomepageExtras(); }
                } catch (e) { console.error('feature toggle failed', e); }
            });
            adminControls.appendChild(editBtn);
            adminControls.appendChild(delBtn);
            adminControls.appendChild(featBtn);

            meta.appendChild(h3);
            meta.appendChild(p);
            meta.appendChild(adminControls);

            card.appendChild(thumbWrap);
            card.appendChild(meta);
            frag.appendChild(card);
        });
        videoGallery.appendChild(frag);
        // Update admin controls visibility according to current user role
        updateAdminControlsVisibility();

        // Mark favorites state after rendering (fetch once)
        markFavoritesForGallery();
    }

    // Open video in modal (with comments) instead of navigating
    async function openVideoModal(video) {
        try {
            // render player
            const playerEl = document.getElementById('video-player');
            playerEl.innerHTML = '';
            if (video.url && video.url.includes('youtube.com/embed')) {
                playerEl.innerHTML = `<iframe src="${video.url}" frameborder="0" allowfullscreen class="w-full h-full"></iframe>`;
            } else {
                let src = video.url;
                try { const u = new URL(video.url); const host=u.hostname.toLowerCase(); const allowed=['onedrive.live.com','1drv.ms','sharepoint.com']; if (allowed.some(h=>host.endsWith(h))) src=`/api/proxy?url=${encodeURIComponent(video.url)}`; } catch(e){}
                playerEl.innerHTML = `<video controls class="w-full h-full bg-black" src="${src}"></video>`;
            }
            document.getElementById('player-title').textContent = video.title || '';
            document.getElementById('player-description').textContent = video.description || '';
            // comments
            const cl = document.getElementById('modal-comment-list');
            cl.innerHTML = `<div class="text-gray-400">${translations[currentLang]['loadingComments'] || 'Loading comments...'}</div>`;
            try {
                const r = await apiFetch(`/api/videos/${video.id}/comments`);
                if (r.ok) {
                    const rows = await r.json();
                    cl.innerHTML = (rows||[]).map(c=>`<div class=\"p-3 bg-gray-800 rounded\"><div class=\"text-sm font-semibold\">${c.username||'Guest'}</div><div class=\"text-sm text-gray-300\">${c.text}</div><div class=\"text-xs text-gray-400\">${new Date(c.created_at).toLocaleString()}</div></div>`).join('')
                } else cl.innerHTML = `<div class="text-gray-400">${translations[currentLang]['noComments'] || 'No comments'}</div>`;
            } catch(e){ cl.innerHTML = `<div class="text-gray-400">${translations[currentLang]['failedLoadComments'] || 'Failed to load comments'}</div>`; }

            // post comment handler
            const postBtn = document.getElementById('modal-post-comment');
            const textEl = document.getElementById('modal-comment-text');
            postBtn.onclick = async ()=>{
                const text = (textEl.value||'').trim(); if (!text) return;
                const res = await apiFetch('/api/reports'); // placeholder to avoid unused
                try {
                    const r = await apiFetch('/api/videos/' + video.id + '/comments', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ text }) });
                    if (r.ok) { textEl.value=''; openVideoModal(video); showToast(translations[currentLang]['commentPosted'] || 'Comment posted', 2500, 'success'); }
                    else { showToast(translations[currentLang]['failedPost'] || 'Failed to post', 3000, 'error'); }
                } catch(e){ showMessage(translations[currentLang]['failedPost'] || 'Failed to post'); }
            };

            // open link to full page
            const openInPage = document.getElementById('open-in-page');
            openInPage.href = `/video.html?id=${encodeURIComponent(video.id)}`;

            showModal(document.getElementById('video-player-modal'));

            // log watch history for current user (light-weight)
            try { await apiFetch('/api/history', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ video_id: video.id }) }); } catch(e){}
            // refresh continue-watching on page
            try {
                const r = await apiFetch('/api/history'); if (r.ok) { const hist = await r.json(); const cont = document.getElementById('continue-list-home'); if (cont) cont.innerHTML = (hist||[]).slice(0,5).map(h=>`<a href=\"/video.html?id=${h.video_id}\" class=\"block p-2 bg-gray-800 rounded\">${h.title||'Video'}</a>`).join(''); }
            } catch(e){}
        } catch (err) { console.error('openVideoModal', err); }
    }

    // Helper to render a small list (used for trending/featured)
    function renderSmallList(container, videos) {
        if (!container) return;
        container.innerHTML = videos.map(v => {
            const thumb = v.thumbnail_url || (getYouTubeVideoId(v.url) ? getYouTubeThumbnail(getYouTubeVideoId(v.url)) : 'https://placehold.co/120x68/111827/9ca3af?text=No');
            return `
            <a href="/video.html?id=${v.id}" class="flex items-center gap-3 p-2 bg-gray-800 rounded hover:bg-gray-700">
                <img src="${thumb}" class="w-20 h-12 object-cover rounded" alt=""/>
                <div class="flex-1">
                    <div class="font-semibold">${v.title}</div>
                    <div class="text-xs text-gray-400">${v.category || ''}</div>
                </div>
            </a>
        `}).join('');
    }

    // Populate featured and trending sections
    async function populateHomepageExtras() {
        try {
            const fRes = await apiFetch('/api/videos');
            if (fRes.ok) {
                const all = await fRes.json();
                // Prefer admin-marked featured, otherwise pick top of weekly trending
                const featured = all.filter(v => v.featured == 1 || v.featured === '1');
                const trendingRes = await apiFetch('/api/videos/trending');
                const trending = trendingRes.ok ? await trendingRes.json() : [];
                const weeklyTop = trending.slice(0,5);
                const featuredWrap = document.getElementById('featured-wrap');
                if (featured.length) {
                    const v = featured[0];
                    featuredWrap.innerHTML = `<a href="/video.html?id=${v.id}" class="block rounded overflow-hidden"><div class="aspect-video bg-black"><img src='${v.thumbnail_url || ''}' class='w-full h-full object-cover' /></div><div class='p-3'><h3 class='text-lg font-bold'>${v.title}</h3><p class='text-gray-400'>${v.description||''}</p></div></a>`;
                } else if (weeklyTop.length) {
                    const v = weeklyTop[0];
                    featuredWrap.innerHTML = `<a href="/video.html?id=${v.id}" class="block rounded overflow-hidden"><div class="aspect-video bg-black"><img src='${v.thumbnail_url || ''}' class='w-full h-full object-cover' /></div><div class='p-3'><h3 class='text-lg font-bold'>${v.title}</h3><p class='text-gray-400'>${v.description||''}</p></div></a>`;
                } else {
                    featuredWrap.innerHTML = `<div class="text-gray-400">${translations[currentLang]['noFeatured'] || 'No featured video'}</div>`;
                }
                // Show top 4-5 weekly trending in the trending list
                renderSmallList(document.getElementById('trending-list'), weeklyTop.slice(0,5));
                if (!weeklyTop || weeklyTop.length === 0) {
                    // send client diag entry to help debugging
                    fetch('/api/client-error', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ diag: 'trending-empty', time: new Date().toISOString() }) }).catch(()=>{});
                    const tr = document.getElementById('trending-list'); if (tr) tr.innerHTML = '<div class="text-gray-400">No trending videos yet</div>';
                }
            }
        } catch (err) { console.error('Failed populating homepage extras', err); }
        // popular categories: build clickable hero + chips ordered by frequency
        try {
            const res = await apiFetch('/api/categories');
            const pc = document.getElementById('popular-cats-list');
            let cats = [];
            if (res.ok) cats = await res.json();
            // derive counts from videos
            const freq = {};
            (allVideos||[]).forEach(v => { const name = v.category || 'Uncategorized'; freq[name] = (freq[name]||0)+1; });
            // merge categories list with freq keys to produce items
            const names = new Set([...(cats||[]).map(c=>c.name), ...Object.keys(freq)]);
            const items = Array.from(names).map(name => ({ name, count: freq[name]||0, thumb: null }));
            // populate thumbs
            items.forEach(it => {
                const vid = (allVideos||[]).find(v => (v.category||'') === it.name && (v.thumbnail_url || v.url));
                if (vid) it.thumb = vid.thumbnail_url || (getYouTubeVideoId(vid.url) ? getYouTubeThumbnail(getYouTubeVideoId(vid.url)) : null);
            });
                if (!items || items.length === 0) {
                    pc.innerHTML = '<div class="text-gray-400">No popular categories</div>';
                } else {
                items.sort((a,b)=> (b.count||0) - (a.count||0));
                const hero = items[0];
                const side = items.slice(1,5);
                pc.innerHTML = `
                    <div class="popular-hero">
                        <div class="hero-card cursor-pointer" data-cat="${hero.name}">
                            ${hero.thumb ? `<img src="${hero.thumb}" alt="${hero.name}" />` : ''}
                            <div class="hero-overlay"></div>
                            <div class="hero-content"><div class="hero-title">${hero.name}</div><div class="hero-sub">${(hero.count||0)} videos</div></div>
                        </div>
                        <div class="side-cards">
                            ${side.map(si=>`<div class="popular-chip cursor-pointer" data-cat="${si.name}"><img src="${si.thumb||('https://placehold.co/120x80/0b1020/9ca3af?text='+encodeURIComponent(si.name))}"/><div class="meta"><div class="name">${si.name}</div><div class="count">${(si.count||0)} videos</div></div></div>`).join('')}
                        </div>
                    </div>
                `;
                // attach click handlers to allow drilling into category
                pc.querySelectorAll('[data-cat]').forEach(el => el.addEventListener('click', (ev) => {
                    const c = el.dataset.cat;
                    // activate category filter and show videos
                    document.querySelectorAll('.category-btn').forEach(b=>b.classList.remove('active'));
                    filterByCategory(c);
                }));
            }
        } catch (e) { console.error('popular cats render failed', e); }
        // continue watching
        try {
            const r = await apiFetch('/api/history');
            if (r.ok) {
                const hist = await r.json();
                const cont = document.getElementById('continue-list-home');
                cont.innerHTML = (hist||[]).slice(0,5).map(h=>`<a href="/video.html?id=${h.video_id}" class="block p-2 bg-gray-800 rounded">${h.title||'Video'}</a>`).join('');
                if (!hist || hist.length === 0) { cont.innerHTML = '<div class="text-gray-400">No recent history</div>'; }
            }
        } catch (e) {}
    }

    // Update visibility of per-card admin controls based on currentUser
    function updateAdminControlsVisibility() {
        const isAdmin = currentUser && currentUser.role === 'admin';
        document.querySelectorAll('.admin-controls').forEach(controls => {
            if (isAdmin) controls.classList.remove('hidden'); else controls.classList.add('hidden');
        });
    }

    // Fetch current user's favorites once and mark the gallery buttons
    async function markFavoritesForGallery() {
        if (!currentUser) return;
        try {
            const res = await apiFetch('/api/favorites');
            if (!res.ok) return;
            const favs = await res.json();
            // Server returns video rows for /api/favorites; the video id is available as `id`.
            favoriteIds = new Set((favs || []).map(f => String(f.id ?? f.video_id ?? f.videoId ?? f.video)));
            // mark buttons
            document.querySelectorAll('.video-card').forEach(card => {
                const vid = String(card.dataset.id || '');
                const btn = card.querySelector('.favorite-overlay');
                if (btn) {
                    if (favoriteIds.has(vid)) btn.classList.add('favorited'); else btn.classList.remove('favorited');
                }
            });
        } catch (err) {
            console.error('Failed to load favorites for gallery', err);
        }
    }

    // Render category buttons
    function displayCategories(categories) {
        categoryFilter.innerHTML = `<button data-category="All" class="category-btn active py-2 px-4 rounded-full text-sm font-medium transition-colors bg-blue-600 text-white hover:bg-blue-700">${translations[currentLang]['all']}</button>`;
        categories.forEach(category => {
            const button = document.createElement('button');
            button.className = 'category-btn py-2 px-4 rounded-full text-sm font-medium transition-colors bg-gray-700 text-gray-300 hover:bg-gray-600';
            button.setAttribute('data-category', category.name);
            button.textContent = category.name;
            categoryFilter.appendChild(button);
        });
    }

    // Tags
    async function fetchTags() {
        try {
            // Prefer to fetch only tags that are in use so the UI shows relevant tags
            const res = await apiFetch('/api/tags/used');
            if (res.ok) {
                allTags = await res.json();
                renderTags(allTags);
            }
        } catch (err) { console.error('Failed to fetch tags', err); }
    }

    function renderTags(tags) {
        if (!tagFilter) return;
        tagFilter.innerHTML = '';
        // create a unified list: tags + categories (deduped); ensure 'ทั้งหมด' followed by the unique list
        const combined = [];
        const seen = new Set();
        // ensure special 'All' button first
        const allBtn = document.createElement('button'); allBtn.className='tag-btn active'; allBtn.textContent = translations[currentLang]['all'];
        allBtn.addEventListener('click', () => { document.querySelectorAll('.tag-btn').forEach(b=>b.classList.remove('active')); allBtn.classList.add('active'); fetchVideos(); });
        tagFilter.appendChild(allBtn);
        (tags||[]).forEach(t => { const n = (t.name||'').trim(); if (n && !seen.has(n)) { seen.add(n); combined.push({ name:n, type:'tag', id: t.id }); } });
        // also include categories as tags but avoid duplicates; categories should be high in the list
        (allCategories||[]).forEach(c => { const n = (c.name||'').trim(); if (n && !seen.has(n)) { seen.add(n); combined.unshift({ name:n, type:'category' }); } });
        // Render combined list (categories first, then tags)
        combined.forEach(item => {
            const b = document.createElement('button'); b.className='tag-btn'; b.textContent = item.name; if (item.type === 'category') b.classList.add('bg-yellow-600');
            b.addEventListener('click', async () => {
                document.querySelectorAll('.tag-btn').forEach(x => x.classList.remove('active'));
                b.classList.add('active');
                if (item.type === 'category') { filterByCategory(item.name); }
                else if (item.type === 'tag') {
                    const res = await apiFetch(`/api/videos/by-tag/${item.id}`);
                    if (res.ok) { const vids = await res.json(); displayVideos(vids); }
                }
            });
            tagFilter.appendChild(b);
        });
    }

    // Populate category dropdown in video form
    function populateCategoryDropdown(categories) {
        videoCategorySelect.innerHTML = categories.map(cat => `<option value="${cat.name}">${cat.name}</option>`).join('');
    }

    // Filter videos by category
    function filterByCategory(category) {
        if (category === 'All') {
            currentFilteredVideos = allVideos;
        } else {
            currentFilteredVideos = allVideos.filter(video => video.category === category);
        }
        displayVideos(currentFilteredVideos);
    }

    // Search videos by title AND description
    function searchVideos(query) {
        const lowerCaseQuery = query.toLowerCase();
        const filtered = allVideos.filter(video =>
            video.title.toLowerCase().includes(lowerCaseQuery) ||
            (video.description && video.description.toLowerCase().includes(lowerCaseQuery))
        );
        displayVideos(filtered);
    }

    // Handle login form submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = e.target.username.value;
        const password = e.target.password.value;

        try {
            const res = await apiFetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            if (res.ok) {
                showToast(translations[currentLang]['loginSuccess'], 2500, 'success');
                // Re-check auth which will reveal UI according to role
                await checkAuthStatus();
                // Load app data for authenticated user
                fetchVideos();
                fetchCategories();
            } else {
                const data = await res.json();
                showToast(data.error || translations[currentLang]['loginFailed'] || 'Login failed', 3500, 'error');
            }
        } catch (err) {
            showMessage(translations[currentLang]['failedFetch']);
        }
    });

    // Handle add/edit video form submission
    videoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = videoIdInput.value;
        const method = id ? 'PUT' : 'POST';
        const endpoint = id ? `/api/videos/${id}` : '/api/videos';

        const rawUrl = videoUrlInput.value;
        const embedUrl = convertUrlToEmbed(rawUrl);

        // If a local file is selected, prefer file upload; otherwise require a YouTube URL
        const file = videoFileInput && videoFileInput.files && videoFileInput.files[0] ? videoFileInput.files[0] : null;

        if (!file && !embedUrl.startsWith('https://www.youtube.com/embed/')) {
            showMessage(translations[currentLang]['invalidUrl']);
            return;
        }

        try {
            if (file) {
                // Send multipart/form-data with the file using XHR to show progress
                const formData = new FormData();
                formData.append('file', file);
                formData.append('title', videoTitleInput.value);
                formData.append('description', videoDescriptionInput.value);
                formData.append('category', videoCategorySelect.value);
                if (videoThumbnailInput.value) formData.append('thumbnail_url', videoThumbnailInput.value);

                const progressEl = document.getElementById('upload-progress');
                const bar = document.getElementById('upload-progress-bar');
                const text = document.getElementById('upload-progress-text');
                if (progressEl && bar && text) { progressEl.classList.remove('hidden'); bar.style.width = '0%'; text.textContent = '0%'; }

                try {
                    await uploadVideoFile(formData, (pct) => { if (bar) bar.style.width = pct + '%'; if (text) text.textContent = pct + '%'; });
                    hideModal(videoModal);
                    showToast(translations[currentLang]['videoAdded'], 3500, 'success');
                    fetchVideos();
                } catch (err) {
                    console.error('Upload failed', err);
                    showToast(err && err.text ? err.text : translations[currentLang]['failedFetch'], 4500, 'error');
                } finally {
                    if (progressEl) progressEl.classList.add('hidden');
                }
            } else {
                const videoData = {
                    title: videoTitleInput.value,
                    description: videoDescriptionInput.value,
                    url: embedUrl,
                    thumbnail_url: videoThumbnailInput.value,
                    category: videoCategorySelect.value,
                };
                const res = await apiFetch(endpoint, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(videoData),
                });
                if (res.ok) {
                    hideModal(videoModal);
                    showToast(id ? translations[currentLang]['videoUpdated'] : translations[currentLang]['videoAdded'], 3000, 'success');
                    fetchVideos();
                } else {
                    const data = await res.json();
                    showMessage(data.error || translations[currentLang]['failedFetch']);
                }
            }
        } catch (err) {
            console.error(err);
            showMessage(translations[currentLang]['failedFetch']);
        }
    });

    // Handle add category form submission
    addCategoryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('new-category-name').value;
        try {
            const res = await apiFetch('/api/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            });
            if (res.ok) {
                showToast(translations[currentLang]['categoryAdded'], 2500, 'success');
                fetchCategories();
                document.getElementById('new-category-name').value = '';
            } else {
                const data = await res.json();
                showMessage(data.error);
            }
        } catch (err) {
            showMessage(translations[currentLang]['failedFetch']);
        }
    });

    // Handle category deletion
    async function deleteCategory(id) {
        showConfirmModal(async (isConfirmed) => {
            if (!isConfirmed) return;
            try {
                const res = await apiFetch(`/api/categories/${id}`, {
                    method: 'DELETE'
                });
                if (res.ok) {
                    showToast(translations[currentLang]['categoryDeleted'], 2500, 'success');
                    fetchCategories();
                } else {
                    const data = await res.json();
                    showMessage(data.error);
                }
            } catch (err) {
                showMessage(translations[currentLang]['failedFetch']);
            }
        });
    }

    // --- User Management (admin) ---
    async function fetchUsers() {
        try {
            const res = await apiFetch('/api/users');
            if (res.ok) {
                const users = await res.json();
                renderUsers(users);
            }
        } catch (err) {
            console.error('Failed to fetch users', err);
        }
    }

    function renderUsers(users) {
        if (!manageUsersList) return;
        // Render users list
        manageUsersList.innerHTML = users.map(u => `
            <div class="flex justify-between items-center bg-gray-700 p-2 rounded-md user-row" data-username="${u.username}" data-role="${u.role || 'user'}" data-suspended="${u.suspended ? 1 : 0}">
                <div>
                    <div class="font-medium text-white">${u.username} ${u.suspended ? '<span class="text-xs text-yellow-300 ml-2">(Suspended)</span>' : ''}</div>
                    <div class="text-xs text-gray-400">${u.role || 'user'}</div>
                </div>
                <div class="flex items-center space-x-2">
                    <button class="btn-edit-user text-sm py-1 px-2 rounded bg-indigo-600 text-white" data-username="${u.username}">Edit</button>
                    <button class="btn-activity-user text-sm py-1 px-2 rounded bg-gray-600 text-white" data-username="${u.username}" data-id="${u.id}">Activity</button>
                    <button class="btn-suspend-user text-sm py-1 px-2 rounded ${u.suspended ? 'bg-green-600' : 'bg-yellow-600'} text-white" data-username="${u.username}">${u.suspended ? 'Un-suspend' : 'Suspend'}</button>
                    <button class="btn-delete-user text-sm py-1 px-2 rounded bg-red-600 text-white" data-username="${u.username}">Delete</button>
                </div>
            </div>
        `).join('');
    }

    // Delegate user-management actions to avoid duplicate binding
    if (manageUsersList) {
        manageUsersList.addEventListener('click', async (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            const username = btn.dataset.username;
            if (!username) return;
            if (btn.classList.contains('btn-toggle-role')) {
                const makeAdmin = btn.textContent.trim() === translations[currentLang]['makeAdmin'];
                try {
                    const res = await apiFetch(`/api/users/${encodeURIComponent(username)}/role`, {
                        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: makeAdmin ? 'admin' : 'user' })
                    });
                    if (res.ok) { showMessage(translations[currentLang]['userUpdated']); fetchUsers(); }
                    else { const d = await res.json(); showMessage(d.error || 'Error'); }
                } catch (err) { console.error(err); showMessage(translations[currentLang]['failedFetch']); }
            } else if (btn.classList.contains('btn-delete-user')) {
                showConfirmModal(async (ok) => {
                    if (!ok) return;
                    try {
                        const res = await apiFetch(`/api/users/${encodeURIComponent(username)}`, { method: 'DELETE' });
                        if (res.ok) { showToast(translations[currentLang]['userDeleted']); fetchUsers(); }
                        else { const d = await res.json(); showToast(d.error || translations[currentLang]['genericError'] || 'Error'); }
                    } catch (err) { console.error(err); showToast(translations[currentLang]['failedFetch']); }
                });
            } else if (btn.classList.contains('btn-suspend-user')) {
                const doUn = btn.textContent.trim() === 'Un-suspend';
                showConfirmModal(async (ok) => {
                    if (!ok) return;
                    try {
                        const res = await apiFetch(`/api/users/${encodeURIComponent(username)}/suspend`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ suspended: doUn ? 0 : 1 }) });
                        if (res.ok) { showToast(translations[currentLang]['userUpdated']); fetchUsers(); }
                        else { const d = await res.json(); showToast(d.error || translations[currentLang]['genericError'] || 'Error'); }
                    } catch (err) { console.error(err); showToast(translations[currentLang]['failedFetch']); }
                });
            }
            else if (btn.classList.contains('btn-edit-user')) {
                const username = btn.dataset.username;
                // fetch user details and open modal
                const row = document.querySelector(`.user-row[data-username="${username}"]`);
                if (!row) return;
                const role = row.dataset.role || 'user';
                document.getElementById('edit-user-id').value = username;
                document.getElementById('edit-username').value = username;
                document.getElementById('edit-role').value = role;
                showModal(document.getElementById('user-edit-modal'));
            } else if (btn.classList.contains('btn-activity-user')) {
                const uid = btn.dataset.id;
                // open activity modal or reuse message box for now
                try {
                    const h = await apiFetch(`/api/admin/users/${uid}/history`);
                    const fav = await apiFetch(`/api/admin/users/${uid}/favorites`);
                    const hh = h.ok ? await h.json() : [];
                    const ff = fav.ok ? await fav.json() : [];
                    const summary = `History:\n${(hh||[]).slice(0,5).map(x=>x.title).join('\n')}\n\nFavorites:\n${(ff||[]).slice(0,5).map(x=>x.title).join('\n')}`;
                    showMessage(summary);
                } catch (e) { console.error(e); }
            }
        });
    }

    if (manageUsersBtn) {
        manageUsersBtn.addEventListener('click', () => {
            showModal(manageUsersModal);
            fetchUsers();
        });
    }
    // Admin panel button wiring (single access point)
    const adminPanelBtn = document.getElementById('admin-panel-btn');
    const adminPanelModal = document.getElementById('admin-panel-modal');
    const adminManageVideosBtn = document.getElementById('admin-manage-videos');
    // create/manage videos modal element
    let manageVideosModal = document.getElementById('manage-videos-modal');
    if (!manageVideosModal) {
        manageVideosModal = document.createElement('div'); manageVideosModal.id = 'manage-videos-modal'; manageVideosModal.className = 'modal';
        manageVideosModal.innerHTML = `
            <div class="modal-content w-full max-w-4xl p-6">
                <div class="modal-header flex justify-between items-center pb-4 mb-4 border-b border-gray-700">
                    <h2 class="text-2xl font-bold text-white">Manage Videos</h2>
                    <button class="modal-close text-gray-500 hover:text-white text-3xl leading-none">&times;</button>
                </div>
                <div id="manage-videos-list" class="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto"></div>
                <div class="flex justify-end mt-4"><button class="modal-close bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded">Close</button></div>
            </div>`;
        document.body.appendChild(manageVideosModal);
        manageVideosModal.querySelectorAll('.modal-close').forEach(b=>b.addEventListener('click', ()=> hideModal(manageVideosModal)));
    }
    const problemReportsModal = document.getElementById('problem-reports-modal');
    const reportsList = document.getElementById('reports-list');
    if (adminPanelBtn) {
        adminPanelBtn.addEventListener('click', () => showModal(adminPanelModal));
    }
    if (adminManageVideosBtn) {
        adminManageVideosBtn.addEventListener('click', async () => {
            hideModal(adminPanelModal);
            // Populate manage-videos-list from current allVideos
            const list = document.getElementById('manage-videos-list');
            if (list) {
                list.innerHTML = (allVideos || []).map(v => `
                    <div class="p-3 bg-gray-800 rounded flex items-center justify-between">
                        <div>
                            <div class="font-semibold">${v.title}</div>
                            <div class="text-xs text-gray-400">${v.category || ''}</div>
                        </div>
                        <div class="space-x-2">
                            <button class="edit-btn bg-indigo-600 px-3 py-1 rounded text-sm" data-id="${v.id}">Edit</button>
                            <button class="feature-toggle bg-yellow-600 px-3 py-1 rounded text-sm" data-id="${v.id}" data-featured="${v.featured}">${v.featured ? 'Unfeature' : 'Feature'}</button>
                            <button class="delete-btn bg-red-600 px-3 py-1 rounded text-sm" data-id="${v.id}">Delete</button>
                        </div>
                    </div>
                `).join('');
            }
            showModal(manageVideosModal);
        });
    }

    // Delegate clicks inside manage-videos-list for edit/delete/feature
    document.addEventListener('click', async (e) => {
        const target = e.target;
        if (!target) return;
        const list = document.getElementById('manage-videos-list');
        if (list && list.contains(target)) {
            if (target.classList.contains('edit-btn')) {
                const id = target.dataset.id;
                const video = allVideos.find(v => String(v.id) === String(id));
                if (video) {
                    videoIdInput.value = video.id;
                    videoTitleInput.value = video.title;
                    videoDescriptionInput.value = video.description;
                    videoUrlInput.value = video.url;
                    videoThumbnailInput.value = video.thumbnail_url;
                    videoCategorySelect.value = video.category;
                    modalTitle.textContent = translations[currentLang]['videoTitle'];
                    hideModal(manageVideosModal);
                    showModal(videoModal);
                }
            }
            if (target.classList.contains('delete-btn')) {
                const id = target.dataset.id;
                showConfirmModal(async (ok) => {
                    if (!ok) return;
                    try {
                        const res = await apiFetch(`/api/videos/${id}`, { method: 'DELETE' });
                        if (res.ok) { showMessage(translations[currentLang]['videoDeleted']); fetchVideos(); }
                    } catch (err) { console.error(err); showMessage(translations[currentLang]['failedFetch']); }
                });
            }
            if (target.classList.contains('feature-toggle')) {
                const id = target.dataset.id; const cur = target.dataset.featured == '1' || target.dataset.featured == 'true';
                try {
                    const r = await apiFetch(`/api/videos/${id}/featured`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ featured: cur ? 0 : 1 }) });
                    if (r.ok) { showMessage(cur ? 'Removed featured' : 'Marked as featured'); fetchVideos(); hideModal(manageVideosModal); }
                    else { const d = await r.json(); showMessage(d.error || 'Failed'); }
                } catch (e) { console.error(e); showMessage('Failed'); }
            }
        }
    });

    // Admin panel actions: delegated click handling
    document.addEventListener('click', async (e) => {
        // View reports
        if (e.target.id === 'admin-view-reports' || e.target.closest && e.target.closest('#admin-view-reports')) {
            hideModal(adminPanelModal);
            showModal(problemReportsModal);
            if (!reportsList) return;
            try {
                const r = await apiFetch('/api/admin/reports');
                if (!r.ok) return;
                const rows = await r.json();
                reportsList.innerHTML = (rows||[]).map(rp => `
                    <div class="p-3 bg-gray-800 rounded">
                        <div class="font-semibold">${rp.username || 'Guest'} ${rp.video_id ? ' (video '+rp.video_id+')' : ''}</div>
                        <div class="text-sm text-gray-300">${rp.description}</div>
                        <div class="text-xs text-gray-400">${new Date(rp.created_at).toLocaleString()}</div>
                        <div class="mt-2"><button data-id="${rp.id}" class="resolve-report bg-green-600 px-3 py-1 rounded">Mark Resolved</button></div>
                    </div>
                `).join('');
            } catch (err) { console.error(err); }
        }
        // Resolve a report
        if (e.target && e.target.classList && e.target.classList.contains('resolve-report')) {
            const id = e.target.dataset.id;
            try {
                const res = await apiFetch(`/api/admin/reports/${id}/resolve`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ resolved: 1 }) });
                if (res.ok) { e.target.textContent = 'Resolved'; e.target.disabled = true; }
            } catch (err) { console.error(err); }
        }
        // Open settings modal
        if (e.target.id === 'admin-settings' || e.target.closest && e.target.closest('#admin-settings')) {
            hideModal(adminPanelModal);
            showSiteSettingsModal();
        }
        // Manage users
        if (e.target.id === 'admin-manage-users' || e.target.closest && e.target.closest('#admin-manage-users')) {
            hideModal(adminPanelModal);
            showModal(manageUsersModal);
            fetchUsers();
        }
        // Manage categories
        if (e.target.id === 'admin-manage-categories' || e.target.closest && e.target.closest('#admin-manage-categories')) {
            hideModal(adminPanelModal);
            showModal(manageCategoriesModal);
        }
    });

    // Site Settings modal creator and handler
    function showSiteSettingsModal() {
        let modal = document.getElementById('site-settings-modal');
        if (!modal) {
            modal = document.createElement('div'); modal.id = 'site-settings-modal'; modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content w-full max-w-md p-6">
                    <div class="modal-header flex justify-between items-center pb-4 mb-4 border-b border-gray-700">
                        <h2 class="text-2xl font-bold text-white">Site Settings</h2>
                        <button class="modal-close text-gray-500 hover:text-white text-3xl leading-none">&times;</button>
                    </div>
                    <div class="space-y-3">
                        <div><label class="block text-sm text-gray-400">Site Title</label><input id="setting-title" class="mt-1 block w-full bg-gray-700 text-white p-2 rounded" /></div>
                        <div><label class="block text-sm text-gray-400">Primary Color (hex)</label><input id="setting-primary" class="mt-1 block w-full bg-gray-700 text-white p-2 rounded" /></div>
                    </div>
                    <div class="flex justify-end mt-4"><button id="save-settings" class="bg-blue-600 px-4 py-2 rounded">Save</button></div>
                </div>`;
            document.body.appendChild(modal);
            // attach close handler
            modal.querySelectorAll('.modal-close').forEach(b => b.addEventListener('click', () => hideModal(modal)));
            document.getElementById('save-settings').addEventListener('click', async () => {
                const title = document.getElementById('setting-title').value;
                const primaryColor = document.getElementById('setting-primary').value;
                try {
                    const r = await apiFetch('/api/settings', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ title, primaryColor }) });
                    if (r.ok) { hideModal(modal); fetchSettings(); showMessage('Saved'); }
                } catch (err) { console.error(err); }
            });
        }
        // populate current
        (async ()=>{
            try { const r = await apiFetch('/api/settings'); if (r.ok) { const s = await r.json(); document.getElementById('setting-title').value = s.title || ''; document.getElementById('setting-primary').value = s.primaryColor || ''; } } catch(e){}
        })();
        showModal(modal);
    }
    // Favorites & History buttons
    if (favoritesBtn) {
        favoritesBtn.addEventListener('click', async () => {
            try {
                const res = await apiFetch('/api/favorites');
                if (res.ok) {
                    const favs = await res.json(); displayVideos(favs);
                }
            } catch (err) { console.error(err); }
        });
    }
    if (historyBtn) {
        historyBtn.addEventListener('click', async () => {
            try {
                const res = await apiFetch('/api/history');
                if (res.ok) {
                    const hist = await res.json();
                    // map to video-like objects for display
                    const vids = hist.map(h => ({ id: h.video_id, title: h.title || 'Video', description: '', url: h.url }));
                    displayVideos(vids);
                }
            } catch (err) { console.error(err); }
        });
    }

    if (addUserForm) {
        addUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = newUsernameInput.value.trim();
            const password = newPasswordInput.value;
            const role = newRoleSelect.value;
            if (!username || !password) return showMessage('Provide username/password');
            try {
                const res = await apiFetch('/api/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password, role }),
                });
                if (res.ok) {
                    showMessage(translations[currentLang]['userCreated']);
                    newUsernameInput.value = '';
                    newPasswordInput.value = '';
                    newRoleSelect.value = 'user';
                    fetchUsers();
                } else {
                    const data = await res.json();
                    showMessage(data.error || translations[currentLang]['usernameExists']);
                }
            } catch (err) { console.error(err); showMessage(translations[currentLang]['failedFetch']); }
        });
    }

    // User edit form handler (admin) - moved here to avoid nested scopes
    const userEditForm = document.getElementById('user-edit-form');
    if (userEditForm) {
        userEditForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const orig = document.getElementById('edit-user-id').value;
            const newUsername = (document.getElementById('edit-username').value || '').trim();
            const newPassword = document.getElementById('edit-password').value || '';
            const role = document.getElementById('edit-role').value || 'user';
            try {
                const res = await apiFetch(`/api/users/${encodeURIComponent(orig)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newUsername, newPassword, role }) });
                if (res.ok) { hideModal(document.getElementById('user-edit-modal')); showMessage(translations[currentLang]['userUpdated']); fetchUsers(); }
                else { const d = await res.json(); showMessage(d.error || 'Failed'); }
            } catch (err) { console.error(err); showMessage(translations[currentLang]['failedFetch']); }
        });
    }

    // Event Listeners for buttons and forms
    adminLoginBtn.addEventListener('click', () => showModal(loginModal));
    adminLogoutBtn.addEventListener('click', async () => {
        try {
            const res = await apiFetch('/api/logout', { method: 'POST' });
            if (res.ok) {
                showMessage(translations[currentLang]['logoutSuccess']);
                checkAuthStatus();
            } else {
                const data = await res.json();
                showMessage(data.error || translations[currentLang]['logoutSuccess']);
            }
        } catch (err) {
            showMessage(translations[currentLang]['failedFetch']);
        }
    });
    if (addVideoBtn) {
        addVideoBtn.addEventListener('click', () => {
            modalTitle.textContent = translations[currentLang]['videoTitle'];
            videoForm.reset();
            videoIdInput.value = '';
            showModal(videoModal);
        });
    }

    // Upload helper with progress using XMLHttpRequest (so we can show a progress bar)
    function uploadVideoFile(formData, onProgress) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/videos', true);
            xhr.withCredentials = true;
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable && typeof onProgress === 'function') {
                    const pct = Math.round((e.loaded / e.total) * 100);
                    onProgress(pct);
                }
            };
            xhr.onreadystatechange = () => {
                if (xhr.readyState === 4) {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try { resolve(JSON.parse(xhr.responseText)); } catch (e) { resolve({}); }
                    } else {
                        let err = { status: xhr.status, text: xhr.responseText };
                        reject(err);
                    }
                }
            };
            xhr.send(formData);
        });
    }
    if (manageCategoriesBtn) {
        manageCategoriesBtn.addEventListener('click', async () => {
            // reload categories from server to ensure admin list is current
            await fetchCategories();
            showModal(manageCategoriesModal);
            // Refresh category list for admin panel
            categoryListAdmin.innerHTML = (allCategories||[]).map(cat => `
                <div class="flex justify-between items-center bg-gray-700 p-2 rounded-md">
                    <span>${cat.name}</span>
                    <button class="delete-category-btn text-red-500 hover:text-red-400" data-id="${cat.id}">${translations[currentLang]['delete']}</button>
                </div>
            `).join('');
        });
    }

    if (categoryFilter) {
        categoryFilter.addEventListener('click', (e) => {
            if (e.target.classList.contains('category-btn')) {
                document.querySelectorAll('.category-btn').forEach(btn => {
                    btn.classList.remove('active', 'bg-blue-600', 'text-white');
                    btn.classList.add('bg-gray-700', 'text-gray-300');
                });
                e.target.classList.add('active', 'bg-blue-600', 'text-white');
                e.target.classList.remove('bg-gray-700', 'text-gray-300');
                const category = e.target.dataset.category;
                filterByCategory(category);
            }
        });
    }

    if (videoGallery) {
        videoGallery.addEventListener('click', async (e) => {
            const card = e.target.closest('.video-card');
            if (!card) return;

        // Admin edit/delete still handled here
        if (e.target.classList.contains('edit-btn')) {
            e.stopPropagation();
            const id = e.target.dataset.id;
            const video = allVideos.find(v => v.id == id);
            if (video) {
                videoIdInput.value = video.id;
                videoTitleInput.value = video.title;
                videoDescriptionInput.value = video.description;
                videoUrlInput.value = video.url;
                videoThumbnailInput.value = video.thumbnail_url;
                videoCategorySelect.value = video.category;
                modalTitle.textContent = translations[currentLang]['videoTitle']; // Assuming edit title
                showModal(videoModal);
            }
        } else if (e.target.classList.contains('delete-btn')) {
            e.stopPropagation();
            const id = e.target.dataset.id;
            showConfirmModal(async (isConfirmed) => {
                if (isConfirmed) {
                    try {
                        const res = await apiFetch(`/api/videos/${id}`, {
                            method: 'DELETE',
                        });
                        if (res.ok) {
                            showMessage(translations[currentLang]['videoDeleted']);
                            fetchVideos();
                        } else {
                            const data = await res.json();
                            showMessage(data.error);
                        }
                    } catch (err) {
                        showMessage(translations[currentLang]['failedFetch']);
                    }
                }

                // (user edit handler moved out of this callback to avoid nested bindings)
            });
        } else {
            // Open modal with player/comments instead of navigating
            const id = card.dataset.id;
            if (id) {
                const video = allVideos.find(v => String(v.id) === String(id));
                if (video) openVideoModal(video);
            }
        }
    });
    }

    if (manageCategoriesModal) {
        manageCategoriesModal.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-category-btn')) {
                const id = e.target.dataset.id;
                deleteCategory(id);
            }
        });

    }

    if (searchBar) {
        searchBar.addEventListener('input', debounce((e) => { searchVideos(e.target.value); }, 300));
    }

    // Close modals with the modal-close top-right buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (!modal) return;
            hideModal(modal);
            if (modal === videoPlayerModal) videoPlayer.innerHTML = '';
        });
    });

    // Buttons that explicitly close modals (e.g., cancel buttons) use data-action="close-modal"
    document.querySelectorAll('[data-action="close-modal"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal) hideModal(modal);
        });
    });

    // File input UI: update selected file name when chosen
    const fileInputEl = document.getElementById('video-file-input');
    const selectedFileNameEl = document.getElementById('selected-file-name');
    if (fileInputEl && selectedFileNameEl) {
        fileInputEl.addEventListener('change', (e) => {
            const f = e.target.files && e.target.files[0];
            selectedFileNameEl.textContent = f ? f.name : '';
        });
    }

    // Close message box
    if (closeMessageBtn) {
        closeMessageBtn.addEventListener('click', () => hideModal(messageBox));
    }

    // Theme toggle functionality
    themeToggleButton.addEventListener('click', () => {
        body.classList.toggle('light-theme');
        const isLightTheme = body.classList.contains('light-theme');
        localStorage.setItem('theme', isLightTheme ? 'light' : 'dark');
        if (isLightTheme) {
            themeIcon.classList.remove('fa-moon');
            themeIcon.classList.add('fa-sun');
        } else {
            themeIcon.classList.remove('fa-sun');
            themeIcon.classList.add('fa-moon');
        }
    });

    // Language toggle functionality
    langToggleButton.addEventListener('click', () => {
        const newLang = currentLang === 'th' ? 'en' : 'th';
        setLanguage(newLang);
    });

    // Initial load
    // Check for saved theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        body.classList.add('light-theme');
        themeIcon.classList.remove('fa-moon');
        themeIcon.classList.add('fa-sun');
    } else {
        body.classList.remove('light-theme');
        themeIcon.classList.remove('fa-sun');
        themeIcon.classList.add('fa-moon');
    }
    // Set initial language
    setLanguage(currentLang);
    // Check auth first; it will load videos/categories for authenticated users
    checkAuthStatus();
});
