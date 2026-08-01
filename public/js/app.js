function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return String(unsafe)
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

// --- Video Gallery logic ---
document.addEventListener('DOMContentLoaded', () => {
    fetchVideos();
    fetchCategories();
});

let allVideos = [];
let currentCategory = 'all';

async function fetchVideos() {
    try {
        const response = await fetch('/api/videos');
        if (response.ok) {
            allVideos = await response.json();
            renderVideos();
        } else {
            renderVideos(); // will render empty state
        }
    } catch (e) {
        console.error(e);
        renderVideos(); // will render empty state on error
    }
}

async function fetchCategories() {
    try {
        const response = await fetch('/api/categories');
        if (response.ok) {
            const categories = await response.json();
            renderCategories(categories);
        }
    } catch (e) {
        console.error(e);
    }
}

function renderVideos() {
    const grid = document.getElementById('video-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    let filteredVideos = allVideos;
    if (currentCategory !== 'all') {
        filteredVideos = allVideos.filter(v => v.category === currentCategory);
    }
    
    if (filteredVideos.length === 0) {
        grid.innerHTML = '<p class="col-span-full text-center text-gray-400 py-8">No videos found.</p>';
        return;
    }
    
    filteredVideos.forEach(video => {
        const card = document.createElement('div');
        card.className = 'bg-gray-800 rounded-lg overflow-hidden shadow-lg transition-transform hover:scale-105';
        card.innerHTML = `
            <a href="/video.html?id=${video.id}" class="block relative group">
                <img src="${video.thumbnail_url || 'https://via.placeholder.com/640x360'}" alt="${escapeHtml(video.title)}" class="w-full h-48 object-cover">
                <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-opacity flex items-center justify-center">
                    <i class="fas fa-play text-white opacity-0 group-hover:opacity-100 text-4xl"></i>
                </div>
            </a>
            <div class="p-4">
                <h3 class="text-lg font-bold text-white line-clamp-2 mb-2">${escapeHtml(video.title)}</h3>
                <p class="text-sm text-gray-400 line-clamp-3">${escapeHtml(video.description) || 'No description'}</p>
                <div class="mt-4 flex justify-between items-center text-xs text-gray-500">
                    <span>${escapeHtml(video.category) || 'Uncategorized'}</span>
                    <div class="flex space-x-2 admin-only hidden">
                        <button onclick="editVideo(${video.id})" class="text-blue-400 hover:text-blue-300"><i class="fas fa-edit"></i></button>
                        <button onclick="deleteVideo(${video.id})" class="text-red-400 hover:text-red-300"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
    
    checkAuthStatus();
}

function renderCategories(categories) {
    const list = document.getElementById('categories-list');
    if (!list) return;
    
    list.innerHTML = `
        <li>
            <button onclick="filterByCategory('all')" class="w-full text-left px-3 py-2 rounded-md font-medium transition-colors ${currentCategory === 'all' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}">
                <i class="fas fa-th-large mr-2"></i> All Videos
            </button>
        </li>
    `;
    
    const select = document.getElementById('video-category');
    if (select) {
        select.innerHTML = '<option value="">Select a category</option>';
    }
    
    categories.forEach(cat => {
        const li = document.createElement('li');
        li.innerHTML = `
            <button onclick="filterByCategory('${escapeHtml(cat.name)}')" class="w-full text-left px-3 py-2 rounded-md font-medium transition-colors ${currentCategory === cat.name ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}">
                ${escapeHtml(cat.name)}
            </button>
        `;
        list.appendChild(li);
        
        if (select) {
            const option = document.createElement('option');
            option.value = cat.name;
            option.textContent = cat.name;
            select.appendChild(option);
        }
    });
}

function filterByCategory(cat) {
    currentCategory = cat;
    document.getElementById('current-category-title').textContent = cat === 'all' ? 'All Videos' : cat;
    fetchCategories(); 
    renderVideos();
}

// Search with debounce
let debounceTimeout;
const searchInput = document.getElementById('search-input');
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
            const term = e.target.value.toLowerCase();
            const grid = document.getElementById('video-grid');
            if (!grid) return;
            
            const cards = grid.children;
            for (let i = 0; i < cards.length; i++) {
                const h3 = cards[i].querySelector('h3');
                const p = cards[i].querySelector('p');
                if (!h3 || !p) continue; // Skip empty state messages
                const title = h3.textContent.toLowerCase();
                const desc = p.textContent.toLowerCase();
                if (title.includes(term) || desc.includes(term)) {
                    cards[i].style.display = '';
                } else {
                    cards[i].style.display = 'none';
                }
            }
        }, 300); // 300ms debounce
    });
}

async function checkAuthStatus() {
    try {
        const res = await fetch('/api/auth/status');
        if (res.ok) {
            const data = await res.json();
            if (data.authenticated && data.user.role === 'admin') {
                document.getElementById('login-btn').classList.add('hidden');
                document.getElementById('admin-menu').classList.remove('hidden');
                document.getElementById('admin-toolbar').classList.remove('hidden');
                document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
            } else {
                showGuestMode();
            }
        } else {
            showGuestMode();
        }
    } catch (e) {
        showGuestMode();
    }
}

function showGuestMode() {
    document.getElementById('login-btn').classList.remove('hidden');
    document.getElementById('admin-menu').classList.add('hidden');
    document.getElementById('admin-toolbar').classList.add('hidden');
    document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
}

const loginBtn = document.getElementById('login-btn');
const loginModal = document.getElementById('login-modal');
const closeLoginModal = document.getElementById('close-login-modal');
const loginForm = document.getElementById('login-form');

if (loginBtn) loginBtn.addEventListener('click', () => loginModal.classList.remove('hidden'));
if (closeLoginModal) closeLoginModal.addEventListener('click', () => loginModal.classList.add('hidden'));

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const errDiv = document.getElementById('login-error');
        
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            if (res.ok) {
                loginModal.classList.add('hidden');
                checkAuthStatus();
            } else {
                const data = await res.json();
                errDiv.textContent = data.error || 'Login failed';
                errDiv.classList.remove('hidden');
            }
        } catch (e) {
            errDiv.textContent = 'Server error';
            errDiv.classList.remove('hidden');
        }
    });
}

const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await fetch('/api/logout', { method: 'POST' });
        checkAuthStatus();
        document.getElementById('admin-dropdown-content').classList.add('hidden');
    });
}

const adminDropdownBtn = document.getElementById('admin-dropdown-btn');
const adminDropdownContent = document.getElementById('admin-dropdown-content');
if (adminDropdownBtn) {
    adminDropdownBtn.addEventListener('click', () => {
        adminDropdownContent.classList.toggle('hidden');
    });
}

const addVideoBtn = document.getElementById('add-video-btn');
const videoModal = document.getElementById('video-modal');
const closeVideoModal = document.getElementById('close-video-modal');
const cancelVideoBtn = document.getElementById('cancel-video-btn');
const videoForm = document.getElementById('video-form');

function resetVideoForm() {
    videoForm.reset();
    document.getElementById('video-id').value = '';
    document.getElementById('video-modal-title').textContent = 'Add New Video';
}

if (addVideoBtn) {
    addVideoBtn.addEventListener('click', () => {
        resetVideoForm();
        videoModal.classList.remove('hidden');
    });
}
if (closeVideoModal) closeVideoModal.addEventListener('click', () => videoModal.classList.add('hidden'));
if (cancelVideoBtn) cancelVideoBtn.addEventListener('click', () => videoModal.classList.add('hidden'));

if (videoForm) {
    videoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const id = document.getElementById('video-id').value;
        const isUpdate = !!id;
        
        const title = document.getElementById('video-title').value;
        const description = document.getElementById('video-description').value;
        const category = document.getElementById('video-category').value;
        const url = document.getElementById('video-url').value;
        const fileInput = document.getElementById('video-file');
        const file = fileInput.files[0];
        
        const tags = document.getElementById('video-tags').value;
        const thumbnailFile = document.getElementById('video-thumbnail').files[0];

        const formData = new FormData();
        formData.append('title', title);
        formData.append('description', description);
        formData.append('category', category);
        if (tags) formData.append('tags', tags);
        
        if (url) {
            formData.append('url', url);
        } else if (file) {
            formData.append('file', file);
        } else if (!isUpdate) {
            alert('Please provide a URL or upload a file');
            return;
        }
        
        if (thumbnailFile) formData.append('thumbnail', thumbnailFile);
        
        try {
            const endpoint = isUpdate ? `/api/videos/${id}` : '/api/videos';
            const method = isUpdate ? 'PUT' : 'POST';
            
            let fetchOpts = {};
            
            if (method === 'POST') {
                fetchOpts = {
                    method: 'POST',
                    body: formData
                };
            } else {
                fetchOpts = {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title, description, category, url
                    })
                };
            }
            
            const res = await fetch(endpoint, fetchOpts);
            
            if (res.ok) {
                videoModal.classList.add('hidden');
                fetchVideos(); 
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to save video');
            }
        } catch (e) {
            console.error(e);
            alert('Server error');
        }
    });
}

async function editVideo(id) {
    const video = allVideos.find(v => String(v.id) === String(id));
    if (!video) return;
    
    document.getElementById('video-id').value = video.id;
    document.getElementById('video-title').value = video.title;
    document.getElementById('video-description').value = video.description || '';
    document.getElementById('video-category').value = video.category || '';
    document.getElementById('video-url').value = video.url || '';
    
    document.getElementById('video-modal-title').textContent = 'Edit Video';
    videoModal.classList.remove('hidden');
}

async function deleteVideo(id) {
    if (confirm('Are you sure you want to delete this video?')) {
        try {
            const res = await fetch(`/api/videos/${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchVideos();
            } else {
                alert('Failed to delete video');
            }
        } catch (e) {
            alert('Server error');
        }
    }
}

// Language and Theme Toggles
const langToggle = document.getElementById('lang-toggle');
const themeToggle = document.getElementById('theme-toggle');

const translations = {
    'EN': {
        'categories': 'Categories',
        'allVideos': 'All Videos'
    },
    'TH': {
        'categories': 'หมวดหมู่',
        'allVideos': 'วิดีโอทั้งหมด'
    }
};

let currentLang = localStorage.getItem('lang') || 'EN';
updateLanguage(currentLang);

if (langToggle) {
    langToggle.addEventListener('click', () => {
        currentLang = currentLang === 'EN' ? 'TH' : 'EN';
        localStorage.setItem('lang', currentLang);
        updateLanguage(currentLang);
    });
}

function updateLanguage(lang) {
    const curLangSpan = document.getElementById('current-lang');
    if (curLangSpan) curLangSpan.textContent = lang;
    
    document.querySelectorAll('[data-lang-key]').forEach(el => {
        const key = el.getAttribute('data-lang-key');
        if (translations[lang] && translations[lang][key]) {
            if (el.tagName === 'INPUT' && el.type === 'text') {
               // handle placeholders if needed
            } else if (el.childNodes.length > 0) {
               // Update only the text node if there are icons
                let updated = false;
                for (let i = 0; i < el.childNodes.length; i++) {
                    if (el.childNodes[i].nodeType === 3 && el.childNodes[i].textContent.trim().length > 0) {
                        el.childNodes[i].textContent = translations[lang][key];
                        updated = true;
                        break;
                    }
                }
                if (!updated) el.textContent = translations[lang][key];
            } else {
                el.textContent = translations[lang][key];
            }
        }
    });
}

// Theme
let currentTheme = localStorage.getItem('theme') || 'dark';
applyTheme(currentTheme);

if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('theme', currentTheme);
        applyTheme(currentTheme);
    });
}

function applyTheme(theme) {
    if (theme === 'light') {
        document.body.classList.remove('bg-gray-900', 'text-white');
        document.body.classList.add('bg-gray-100', 'text-gray-900');
        
        // update nav
        const nav = document.querySelector('nav');
        if(nav) {
            nav.classList.remove('bg-gray-800', 'border-gray-700');
            nav.classList.add('bg-white', 'border-gray-200');
        }
        
        // update cards (we'll just use a class on body to scope styles if needed, but doing it manual here for simplicity or let css handle it)
        document.querySelectorAll('.bg-gray-800').forEach(el => {
            el.classList.remove('bg-gray-800');
            el.classList.add('bg-white');
            if(el.classList.contains('text-white')) {
                el.classList.remove('text-white');
                el.classList.add('text-gray-900');
            }
        });
        
        if (themeToggle) themeToggle.innerHTML = '<i class="fas fa-sun text-yellow-500"></i>';
    } else {
        document.body.classList.add('bg-gray-900', 'text-white');
        document.body.classList.remove('bg-gray-100', 'text-gray-900');
        
        const nav = document.querySelector('nav');
        if(nav) {
            nav.classList.add('bg-gray-800', 'border-gray-700');
            nav.classList.remove('bg-white', 'border-gray-200');
        }
        
        document.querySelectorAll('.bg-white').forEach(el => {
            el.classList.add('bg-gray-800');
            el.classList.remove('bg-white');
            if(el.classList.contains('text-gray-900')) {
                el.classList.add('text-white');
                el.classList.remove('text-gray-900');
            }
        });
        
        if (themeToggle) themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
    }
}

// --- Category Management ---
const manageCategoriesBtn = document.getElementById('manage-categories-btn');
const categoryModal = document.getElementById('category-modal');
const closeCategoryModal = document.getElementById('close-category-modal');
const addCategoryForm = document.getElementById('add-category-form');

if (manageCategoriesBtn) {
    manageCategoriesBtn.addEventListener('click', () => {
        populateCategoryManager();
        categoryModal.classList.remove('hidden');
    });
}

if (closeCategoryModal) {
    closeCategoryModal.addEventListener('click', () => categoryModal.classList.add('hidden'));
}

async function populateCategoryManager() {
    const list = document.getElementById('manage-categories-list');
    if (!list) return;
    list.innerHTML = '<p class="text-gray-400">Loading...</p>';
    
    try {
        const response = await fetch('/api/categories');
        if (response.ok) {
            const categories = await response.json();
            list.innerHTML = '';
            if (categories.length === 0) {
                list.innerHTML = '<p class="text-gray-400">No categories found.</p>';
                return;
            }
            
            categories.forEach(cat => {
                const item = document.createElement('div');
                item.className = 'flex justify-between items-center bg-gray-700 p-3 rounded-lg border border-gray-600';
                item.innerHTML = `
                    <span class="text-white font-medium">${escapeHtml(cat.name)}</span>
                    <button onclick="deleteCategory(${cat.id})" class="text-red-400 hover:text-red-300 transition-colors p-1" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                `;
                list.appendChild(item);
            });
        }
    } catch (e) {
        list.innerHTML = '<p class="text-red-400">Error loading categories.</p>';
    }
}

if (addCategoryForm) {
    addCategoryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('new-category-name');
        const name = input.value.trim();
        if (!name) return;
        
        try {
            const res = await fetch('/api/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            if (res.ok) {
                input.value = '';
                populateCategoryManager();
                fetchCategories(); // Update main UI
            } else {
                alert('Failed to add category');
            }
        } catch (e) {
            alert('Server error');
        }
    });
}

async function deleteCategory(id) {
    if (confirm('Are you sure you want to delete this category?')) {
        try {
            const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
            if (res.ok) {
                populateCategoryManager();
                fetchCategories(); // Update main UI
            } else {
                alert('Failed to delete category');
            }
        } catch (e) {
            alert('Server error');
        }
    }
}