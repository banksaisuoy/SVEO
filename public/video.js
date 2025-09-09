// Simple client for video page
(async function(){
    const apiFetch = (url, opts={})=> fetch(url, Object.assign({credentials:'include'}, opts));
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const playerWrap = document.getElementById('player-wrap');
    const titleEl = document.getElementById('vid-title');
    const metaEl = document.getElementById('vid-meta');
    const descEl = document.getElementById('vid-description');
    const likeBtn = document.getElementById('like-btn');
    const reportBtn = document.getElementById('report-btn');
    const favBtn = document.getElementById('fav-btn');
    const commentText = document.getElementById('comment-text');
    const postComment = document.getElementById('post-comment');
    const commentList = document.getElementById('comment-list');
    const continueList = document.getElementById('continue-list');
    const relatedList = document.getElementById('related-list');

    if (!id) { titleEl.textContent = 'Missing video id'; return; }

    try {
        const res = await apiFetch('/api/videos');
        const videos = await res.json();
        const vid = videos.find(v=>String(v.id)===String(id));
        if (!vid) { titleEl.textContent = 'Video not found'; return; }
        titleEl.textContent = vid.title; metaEl.textContent = `${vid.category || ''} • ${new Date(vid.upload_date||'').toLocaleString()}`;
        descEl.innerHTML = vid.description || '';

        // render player
        if (vid.url && vid.url.includes('youtube.com/embed')) {
            playerWrap.innerHTML = `<iframe src="${vid.url}" frameborder="0" allowfullscreen class="w-full h-full"></iframe>`;
        } else {
            let src = vid.url;
            try { const u = new URL(vid.url); const host=u.hostname.toLowerCase(); const allowed=['onedrive.live.com','1drv.ms','sharepoint.com']; if (allowed.some(h=>host.endsWith(h))) src=`/api/proxy?url=${encodeURIComponent(vid.url)}`; } catch(e){}
            playerWrap.innerHTML = `<video controls class="w-full h-full bg-black" src="${src}"></video>`;
        }

    // comments
        async function loadComments(){
            const r = await apiFetch(`/api/videos/${id}/comments`);
            if (!r.ok) return;
            const rows = await r.json();
            commentList.innerHTML = rows.map(c=>`<div class="p-3 bg-gray-800 rounded"><div class="text-sm font-semibold">${c.username||'Guest'}</div><div class="text-sm text-gray-300">${c.text}</div><div class="text-xs text-gray-400">${new Date(c.created_at).toLocaleString()}</div></div>`).join('');
        }
        await loadComments();

        postComment.addEventListener('click', async ()=>{
            const text = commentText.value.trim(); if (!text) return;
            const r = await apiFetch(`/api/videos/${id}/comments`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ text }) });
            if (r.ok) { commentText.value=''; await loadComments(); }
        });

        // Report button
        if (reportBtn) {
            reportBtn.addEventListener('click', async ()=>{
                const text = prompt('Describe the problem:');
                if (!text) return;
                const r = await apiFetch('/api/reports', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ video_id: id, description: text }) });
                if (r.ok) alert('Reported'); else alert('Failed to report');
            });
        }

        // Favorite toggle
        async function loadFavState(){
            try {
                const r = await apiFetch('/api/favorites');
                if (!r.ok) return;
                const favs = await r.json();
                const found = (favs||[]).some(f => String(f.id||f.video_id) === String(id));
                if (favBtn) favBtn.textContent = found ? 'Remove Favorite' : 'Favorite';
            } catch(e){}
        }
        if (favBtn) {
            favBtn.addEventListener('click', async ()=>{
                try {
                    const r1 = await apiFetch('/api/favorites');
                    if (!r1.ok) return;
                    const favs = await r1.json();
                    const found = (favs||[]).some(f => String(f.id||f.video_id) === String(id));
                    if (found) {
                        const r = await apiFetch(`/api/favorites/${id}`, { method:'DELETE' });
                        if (r.ok) { loadFavState(); }
                    } else {
                        const r = await apiFetch('/api/favorites', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ video_id: id }) });
                        if (r.ok) { loadFavState(); }
                    }
                } catch (e) { console.error(e); }
            });
            loadFavState();
        }

        // continue watching
        const histRes = await apiFetch('/api/history');
        if (histRes.ok) {
            const hist = await histRes.json();
            const cont = hist.filter(h=>h.video_id && String(h.video_id)!==String(id)).slice(0,5).map(h=>`<a href="/video.html?id=${h.video_id}" class="block p-2 bg-gray-800 rounded">${h.title||'Video'}</a>`).join('');
            continueList.innerHTML = cont;
        }

        // related: simple same-category
        const related = videos.filter(v=>v.category===vid.category && String(v.id)!==String(id)).slice(0,5).map(v=>`<a href="/video.html?id=${v.id}" class="block p-2 bg-gray-800 rounded">${v.title}</a>`).join('');
        relatedList.innerHTML = related;

    } catch (err) { console.error(err); }
})();
