    let tagFilter = document.getElementById('tag-filter');
    let favoritesBtn = document.getElementById('favorites-btn');
    let historyBtn = document.getElementById('history-btn');
    let playlistsBtn = document.getElementById('playlists-btn');
    let manageTagsBtn = document.getElementById('manage-tags-btn');
    let manageTagsModal = document.getElementById('manage-tags-modal');
    let addTagForm = document.getElementById('add-tag-form');
    tagFilter = tagFilter || ensureElement('tag-filter','div');
    favoritesBtn = favoritesBtn || ensureElement('favorites-btn','button');
    historyBtn = historyBtn || ensureElement('history-btn','button');
    playlistsBtn = playlistsBtn || ensureElement('playlists-btn','button');
    manageTagsBtn = manageTagsBtn || ensureElement('manage-tags-btn','button');
    manageTagsModal = manageTagsModal || ensureElement('manage-tags-modal','div');
    addTagForm = addTagForm || ensureElement('add-tag-form','form');
            'videoUpdated': 'อัปเดตวิดีโอสำเร็จ!',
            'categoryAdded': 'เพิ่มหมวดหมู่สำเร็จ!',
            'categoryDeleted': 'ลบหมวดหมู่สำเร็จ!',
            'playlists': 'เพลย์ลิสต์',
            'myPlaylists': 'เพลย์ลิสต์ของฉัน',
            'createPlaylist': 'สร้าง',
            'addToPlaylist': 'เพิ่มลงในเพลย์ลิสต์',
            'backToPlaylists': 'กลับ',
        'manageUsers': 'จัดการผู้ใช้',
        'orUpload': 'หรืออัปโหลดไฟล์วิดีโอจากเครื่อง',
        'createUser': 'สร้างผู้ใช้',
            'videoUpdated': 'Video updated successfully!',
            'categoryAdded': 'Category added!',
            'categoryDeleted': 'Category deleted!',
            'playlists': 'Playlists',
            'myPlaylists': 'My Playlists',
            'createPlaylist': 'Create',
            'addToPlaylist': 'Add to Playlist',
            'backToPlaylists': 'Back',
            'manageUsers': 'Manage Users',
            'orUpload': 'or upload video file from device',
            'createUser': 'Create User',
            await fetchVideos();
            await fetchCategories();
            await fetchTags();
            // show favorites/history/playlists buttons for logged-in users
            if (favoritesBtn) favoritesBtn.classList.remove('hidden');
            if (historyBtn) historyBtn.classList.remove('hidden');
            if (playlistsBtn) playlistsBtn.classList.remove('hidden');
        } catch (err) {
            console.error('Failed to check auth status:', err);
            // On any failure to reach auth endpoint, keep login modal visible
            } catch (err) { console.error(err); }
        });
    }
    if (playlistsBtn) {
        playlistsBtn.addEventListener('click', () => {
            // Hide other sections, show playlists view
            const galleryParent = document.getElementById('video-gallery');
            if (galleryParent) galleryParent.parentElement.classList.add('hidden');
            const trending = document.getElementById('trending');
            if (trending) trending.classList.add('hidden');
            const pv = document.getElementById('playlists-view');
            if (pv) pv.classList.remove('hidden');
            const pvv = document.getElementById('playlist-videos-view');
            if (pvv) pvv.classList.add('hidden');
            
            // clear active category
            document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('bg-blue-600', 'text-white'));
            loadPlaylists();
        });
    }

    if (historyBtn) {
        historyBtn.addEventListener('click', async () => {
            try {
    // Check auth first; it will load videos/categories for authenticated users
    checkAuthStatus();
});

    // --- Playlists Management ---
    async function loadPlaylists() {
        try {
            const res = await apiFetch('/api/playlists');
            if (res.ok) {
                const playlists = await res.json();
                renderPlaylists(playlists);
            }
        } catch (err) { console.error('Failed to load playlists:', err); }
    }

    function renderPlaylists(playlists) {
        const container = document.getElementById('playlists-container');
        if (!container) return;
        container.innerHTML = '';
        if (!playlists || playlists.length === 0) {
            container.innerHTML = `<p class="text-gray-400 col-span-full">คุณยังไม่มีเพลย์ลิสต์</p>`;
            return;
        }
        playlists.forEach(p => {
            const div = document.createElement('div');
            div.className = 'bg-gray-800 p-4 rounded-lg shadow-md cursor-pointer hover:bg-gray-700 transition-colors flex flex-col justify-between';
            div.innerHTML = `
                <div>
                    <h4 class="text-lg font-semibold text-white mb-1"><i class="fas fa-list-ul mr-2 text-purple-400"></i>${escapeHTML(p.name)}</h4>
                    <p class="text-sm text-gray-400">${p.video_count || 0} วิดีโอ</p>
                </div>
                <div class="mt-4 flex justify-end">
                    <button class="delete-playlist-btn text-red-500 hover:text-red-400 p-1" data-id="${p.id}" title="ลบ"><i class="fas fa-trash"></i></button>
                </div>
            `;
            // Click to view playlist
            div.addEventListener('click', (e) => {
                if(e.target.closest('.delete-playlist-btn')) return;
                viewPlaylist(p.id, p.name);
            });
            
            // Delete playlist
            const delBtn = div.querySelector('.delete-playlist-btn');
            delBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if(confirm('ต้องการลบเพลย์ลิสต์นี้ใช่หรือไม่?')) {
                    const res = await apiFetch(`/api/playlists/${p.id}`, { method: 'DELETE' });
                    if(res.ok) loadPlaylists();
                }
            });
            
            container.appendChild(div);
        });
    }

    async function viewPlaylist(id, name) {
        document.getElementById('playlists-container').classList.add('hidden');
        document.getElementById('create-playlist-form').parentElement.classList.add('hidden');
        document.getElementById('playlist-videos-view').classList.remove('hidden');
        document.getElementById('current-playlist-title').querySelector('span').textContent = name;
        
        const container = document.getElementById('playlist-videos-container');
        container.innerHTML = '<p class="text-gray-400 col-span-full">กำลังโหลด...</p>';
        
        try {
            const res = await apiFetch(`/api/playlists/${id}/videos`);
            if (res.ok) {
                const videos = await res.json();
                container.innerHTML = '';
                if(videos.length === 0) {
                    container.innerHTML = '<p class="text-gray-400 col-span-full">ไม่มีวิดีโอในเพลย์ลิสต์นี้</p>';
                    return;
                }
                videos.forEach(video => {
                    const card = document.createElement('div');
                    card.className = 'bg-gray-800 rounded-lg shadow overflow-hidden flex flex-col relative';
                    
                    // Allow clicking video to navigate, but don't prevent button clicks
                    const clickableArea = document.createElement('div');
                    clickableArea.className = 'cursor-pointer flex-grow';
                    clickableArea.addEventListener('click', (e) => {
                         if(!e.target.closest('button')) window.location.href = `/video.html?id=${video.id}`;
                    });
                    
                    clickableArea.innerHTML = `
                        <img src="${video.thumbnail_url || 'https://via.placeholder.com/640x360?text=No+Thumbnail'}" alt="Thumbnail" class="w-full h-32 object-cover">
                        <div class="p-3 flex-grow">
                            <h4 class="font-semibold text-white text-sm line-clamp-2 mb-1">${escapeHTML(video.title)}</h4>
                        </div>
                    `;
                    
                    const removeBtn = document.createElement('button');
                    removeBtn.className = 'absolute top-2 right-2 bg-red-600/80 hover:bg-red-600 text-white p-1.5 rounded-full shadow-lg';
                    removeBtn.innerHTML = '<i class="fas fa-times"></i>';
                    removeBtn.title = 'ลบออกจากเพลย์ลิสต์';
                    removeBtn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        if(confirm('ลบวิดีโอออกจากเพลย์ลิสต์?')) {
                            const delRes = await apiFetch(`/api/playlists/${id}/videos/${video.id}`, { method: 'DELETE' });
                            if(delRes.ok) viewPlaylist(id, name); // reload
                        }
                    });
                    
                    card.appendChild(clickableArea);
                    card.appendChild(removeBtn);
                    container.appendChild(card);
                });
            }
        } catch(e) {
            console.error(e);
            container.innerHTML = '<p class="text-red-400 col-span-full">เกิดข้อผิดพลาดในการโหลดวิดีโอ</p>';
        }
    }

    const createPlaylistForm = document.getElementById('create-playlist-form');
    if(createPlaylistForm) {
        createPlaylistForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = document.getElementById('new-playlist-name');
            const name = input.value.trim();
            if(name) {
                const res = await apiFetch('/api/playlists', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name })
                });
                if(res.ok) {
                    input.value = '';
                    loadPlaylists();
                }
            }
        });
    }

    const backToPlaylistsBtn = document.getElementById('back-to-playlists-btn');
    if(backToPlaylistsBtn) {
        backToPlaylistsBtn.addEventListener('click', () => {
            document.getElementById('playlist-videos-view').classList.add('hidden');
            document.getElementById('playlists-container').classList.remove('hidden');
            document.getElementById('create-playlist-form').parentElement.classList.remove('hidden');
            loadPlaylists();
        });
    }

    // Wrap the category-filter event logic to also hide the playlists view when clicking a category
    const originalFilterByCategory = filterByCategory;
    filterByCategory = function(category) {
        const pv = document.getElementById('playlists-view');
        if (pv) pv.classList.add('hidden');
        const galleryParent = document.getElementById('video-gallery');
        if (galleryParent) galleryParent.parentElement.classList.remove('hidden');
        const trending = document.getElementById('trending');
        if (trending) trending.classList.remove('hidden');
        originalFilterByCategory(category);
    };