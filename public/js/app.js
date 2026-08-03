document.addEventListener('DOMContentLoaded', () => {
    fetchVideos();
    fetchCategories();
});

let currentVideos = [];
let categories = [];
let isAdmin = false;

// Check auth status using the correct method
fetch('/api/login', { method: 'POST', body: JSON.stringify({}), headers: { 'Content-Type': 'application/json' } })
    .then(res => res.json())
    .then(data => {
        if (data.isAuthenticated || data.user?.role === 'admin') {
            isAdmin = true;
            document.getElementById('admin-toolbar')?.classList.remove('hidden');
            document.getElementById('admin-menu')?.classList.remove('hidden');
            document.getElementById('login-btn')?.classList.add('hidden');
        }
    }).catch(console.error);

async function fetchCategories() {
    try {
        const res = await fetch('/api/categories');
        if (res.ok) {
            categories = await res.json();
            const select = document.getElementById('video-category');
            if (select) {
                select.innerHTML = '<option value="">Select a category</option>';
                categories.forEach(cat => {
                    const option = document.createElement('option');
                    option.value = cat.name; // using name since that's what form expects
                    option.textContent = cat.name;
                    select.appendChild(option);
                });
            }
        }
    } catch (err) {
        console.error('Error fetching categories:', err);
    }
}

async function fetchVideos() {
    const grid = document.getElementById('video-grid');
    if (!grid) return;
    
    grid.innerHTML = `
        <div class="col-span-full flex justify-center py-12">
            <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
        </div>
    `;

    try {
        const res = await fetch('/api/videos');
        if (res.ok) {
            const data = await res.json();
            currentVideos = Array.isArray(data) ? data : (data.videos || []);
            renderVideos(currentVideos);
        } else {
            grid.innerHTML = `<div class="col-span-full text-center text-red-500 py-12">Failed to load videos.</div>`;
        }
    } catch (err) {
        console.error('Error fetching videos:', err);
        grid.innerHTML = `<div class="col-span-full text-center text-red-500 py-12">Network error.</div>`;
    }
}

function renderVideos(videos) {
    const grid = document.getElementById('video-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    if (videos.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full text-center py-12 text-gray-400">
                <i class="fas fa-video-slash text-4xl mb-4 opacity-50"></i>
                <p>No videos found.</p>
            </div>
        `;
        return;
    }

    videos.forEach(video => {
        const card = document.createElement('div');
        card.className = 'bg-gray-800 rounded-xl overflow-hidden shadow-lg border border-gray-700 transition-transform hover:-translate-y-1 hover:shadow-purple-500/20 group';
        
        // Escape content safely
        const title = escapeHTML(video.title);
        const description = escapeHTML(video.description || '');
        const category = escapeHTML(video.category || 'Uncategorized');
        
        let thumbUrl = video.thumbnail_url || video.thumbnail_path || '';
        if (thumbUrl && !thumbUrl.startsWith('http') && !thumbUrl.startsWith('/')) {
            thumbUrl = '/' + thumbUrl;
        }
        
        const thumbnailHtml = thumbUrl 
            ? `<img src="${thumbUrl}" alt="${title}" class="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300">`
            : `<div class="w-full h-48 bg-gray-700 flex items-center justify-center"><i class="fas fa-video text-4xl text-gray-500"></i></div>`;

        card.innerHTML = `
            <div class="relative overflow-hidden cursor-pointer" onclick="openVideoPlayer(${Number(video.id)})">
                ${thumbnailHtml}
                <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-opacity flex items-center justify-center">
                    <i class="fas fa-play-circle text-white text-5xl opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg"></i>
                </div>
                ${category ? `<span class="absolute top-2 right-2 bg-purple-600 text-xs font-bold px-2 py-1 rounded shadow">${category}</span>` : ''}
            </div>
            <div class="p-4">
                <h3 class="font-bold text-lg mb-1 truncate" title="${title}">${title}</h3>
                <p class="text-gray-400 text-sm line-clamp-2 h-10">${description}</p>
            </div>
        `;
        grid.appendChild(card);
    });
}

function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function openVideoPlayer(id) {
    window.location.href = `/video.html?id=${id}`;
}

// Modal logic
const videoModal = document.getElementById('video-modal');
const addVideoBtn = document.getElementById('add-video-btn');
const closeVideoModal = document.getElementById('close-video-modal');
const cancelVideoBtn = document.getElementById('cancel-video-btn');
const videoForm = document.getElementById('video-form');

if (addVideoBtn && videoModal) {
    addVideoBtn.addEventListener('click', () => {
        if (videoForm) videoForm.reset();
        document.getElementById('video-id').value = '';
        document.getElementById('video-modal-title').textContent = 'Add New Video';
        videoModal.classList.remove('hidden');
    });
}

if (closeVideoModal && videoModal) {
    closeVideoModal.addEventListener('click', () => videoModal.classList.add('hidden'));
}

if (cancelVideoBtn && videoModal) {
    cancelVideoBtn.addEventListener('click', () => videoModal.classList.add('hidden'));
}

if (videoForm) {
    videoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btn = document.getElementById('save-video-btn');
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<div class="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div> Saving...';
        btn.disabled = true;

        const formData = new FormData();
        formData.append('title', document.getElementById('video-title').value);
        formData.append('description', document.getElementById('video-description').value);
        formData.append('category', document.getElementById('video-category').value);
        formData.append('url', document.getElementById('video-url').value);
        
        const videoFile = document.getElementById('video-file')?.files[0];
        const thumbFile = document.getElementById('video-thumbnail')?.files[0];
        
        if (videoFile) formData.append('file', videoFile);
        if (thumbFile) formData.append('thumbnail', thumbFile);

        const id = document.getElementById('video-id').value;
        const endpoint = id ? `/api/videos/${id}` : '/api/videos';
        const method = id ? 'PUT' : 'POST';

        try {
            const res = await fetch(endpoint, {
                method: method,
                body: formData
            });
            
            if (res.ok) {
                videoModal.classList.add('hidden');
                fetchVideos(); // Refresh grid
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to save video');
            }
        } catch (err) {
            console.error(err);
            alert('Network error occurred.');
        } finally {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }
    });
}