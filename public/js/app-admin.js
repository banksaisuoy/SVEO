// VisionHub - Admin Panel Methods
// This file contains admin-specific functionality

// Extend App object with admin methods
Object.assign(App, {
    // Load comments for a video
    async loadComments(videoId) {
        try {
            const response = await this.api.get(`/comments/video/${videoId}`);
            const comments = response.success ? response.comments : [];
            const commentsList = document.getElementById('comments-list');

            if (comments.length === 0) {
                commentsList.innerHTML = '<p class="text-center text-muted">No comments yet</p>';
                return;
            }

            const commentsHtml = comments.map(comment => `
                <div class="comment-item">
                    <div class="comment-header">
                        <span class="comment-author">${comment.userId}</span>
                        <span class="comment-date">${new Date(comment.created_at).toLocaleDateString()}</span>
                    </div>
                    <p class="comment-text">${comment.text}</p>
                </div>
            `).join('');

            commentsList.innerHTML = commentsHtml;
        } catch (error) {
            console.error('Error loading comments:', error);
        }
    }
});