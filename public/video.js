    const likeBtn = document.getElementById('like-btn');
    const reportBtn = document.getElementById('report-btn');
    const favBtn = document.getElementById('fav-btn');
    const addToPlaylistBtn = document.getElementById('add-to-playlist-btn');
    const commentText = document.getElementById('comment-text');
    const postComment = document.getElementById('post-comment');
    const commentList = document.getElementById('comment-list');
        const related = videos.filter(v=>v.category===vid.category && String(v.id)!==String(id)).slice(0,5).map(v=>`<a href="/video.html?id=${v.id}" class="block p-2 bg-gray-800 rounded">${v.title}</a>`).join('');
        relatedList.innerHTML = related;

    