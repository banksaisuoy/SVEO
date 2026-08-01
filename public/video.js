                document.getElementById('video-description').textContent = video.description || 'No description provided.';
                
                const playerContainer = document.getElementById('video-player-container');
                
                // Determine source URL handling variations in database column names
                const sourceUrl = video.video_url || video.url || video.file_path;
                
                if (sourceUrl && (sourceUrl.includes('youtube.com') || sourceUrl.includes('youtu.be'))) {
                    // Extract video ID from youtube URL
                    let ytId = null;
                    try {
                        const urlObj = new URL(sourceUrl);
                        ytId = urlObj.searchParams.get('v');
                    } catch (e) {
                         // ignore invalid URL
                    }
                    
                    if (!ytId && sourceUrl.includes('youtu.be/')) {
                        ytId = sourceUrl.split('youtu.be/')[1];
                    }
                    if (ytId) {
                        playerContainer.innerHTML = `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${ytId}" frameborder="0" allowfullscreen class="rounded-lg"></iframe>`;
                    } else {
                         playerContainer.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-gray-800 rounded-lg text-gray-500">Invalid YouTube URL</div>';
                    }
                } else if (sourceUrl) {
                    playerContainer.innerHTML = `
                        <video id="my-video" class="video-js vjs-theme-fantasy vjs-big-play-centered" controls preload="auto" width="100%" height="100%" style="width: 100%; height: 100%; border-radius: 0.5rem;" poster="${video.thumbnail_url || ''}" data-setup="{}">
                            <source src="${sourceUrl}" type="${sourceUrl.endsWith('.webm') ? 'video/webm' : 'video/mp4'}">
                            Your browser does not support the video tag.
                        </video>
                    `;
                    // Initialize video.js on the dynamically injected element
                    if (typeof videojs !== 'undefined') {
                        videojs('my-video');
                    }
                } else {
                    playerContainer.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-gray-800 rounded-lg text-gray-500">No playable source available</div>';
                }
