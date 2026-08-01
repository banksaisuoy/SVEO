// Basic logic for the video page (if user navigates there)
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get('id');
    
    if (videoId) {
        fetchVideoDetails(videoId);
    } else {
        document.getElementById('video-title').textContent = 'Video not found';
    }
});

async function fetchVideoDetails(id) {
    try {
        const response = await fetch('/api/videos');
        if (response.ok) {
            const allVideos = await response.json();
            const video = allVideos.find(v => String(v.id) === String(id));
            
            if (video) {
                document.title = video.title + ' - VidGallery';
                document.getElementById('video-title').textContent = video.title;
                document.getElementById('video-description').textContent = video.description || 'No description provided.';
                
                const playerContainer = document.getElementById('video-player-container');
                if (video.url && video.url.includes('youtube.com')) {
                    // Extract video ID from youtube URL
                    const urlObj = new URL(video.url);
                    let ytId = urlObj.searchParams.get('v');
                    if (!ytId && video.url.includes('youtu.be/')) {
                        ytId = video.url.split('youtu.be/')[1];
                    }
                    if (ytId) {
                        playerContainer.innerHTML = `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${ytId}" frameborder="0" allowfullscreen class="rounded-lg"></iframe>`;
                    }
                } else if (video.url) {
                    playerContainer.innerHTML = `
                        <video width="100%" height="100%" controls class="rounded-lg bg-black" poster="${video.thumbnail_url || ''}">
                            <source src="${video.url}" type="video/mp4">
                            Your browser does not support the video tag.
                        </video>
                    `;
                } else {
                    playerContainer.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-gray-800 rounded-lg text-gray-500">No playable source available</div>';
                }
            } else {
                document.getElementById('video-title').textContent = 'Video not found';
            }
        }
    } catch (e) {
        console.error('Failed to load video details', e);
    }
}
