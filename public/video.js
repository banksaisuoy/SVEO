                document.getElementById('video-description').textContent = video.description || 'No description provided.';
                
                const playerContainer = document.getElementById('video-player-container');
                const sourceUrl = video.url || video.video_url || video.file_path;

                if (sourceUrl && sourceUrl.includes('youtube.com')) {
                    // Extract video ID from youtube URL
                    const urlObj = new URL(sourceUrl);
                    let ytId = urlObj.searchParams.get('v');
                    if (!ytId && sourceUrl.includes('youtu.be/')) {
                        ytId = sourceUrl.split('youtu.be/')[1];
                    }
                    if (ytId) {
                        playerContainer.innerHTML = `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${ytId}" frameborder="0" allowfullscreen class="rounded-lg"></iframe>`;
                    }
                } else if (sourceUrl) {
                    playerContainer.innerHTML = `
                        <video class="video-js vjs-theme-fantasy vjs-big-play-centered" controls preload="auto" poster="${video.thumbnail_url || video.thumbnail_path || ''}">
                            <source src="${sourceUrl}" type="video/mp4">
                            Your browser does not support the video tag.
                        </video>
                    `;
                    
                    if (typeof videojs !== 'undefined') {
                        videojs(playerContainer.querySelector('.video-js'), {
                            fluid: true,
                            playbackRates: [0.5, 1, 1.5, 2]
                        });
                    }
                } else {
                    playerContainer.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-gray-800 rounded-lg text-gray-500">No playable source available</div>';
                }