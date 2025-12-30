const { Database, Playlist } = require('../models/index');

class PlaylistService {
    constructor() {
        this.db = new Database();
    }

    async initialize() {
        await this.db.connect();
    }

    async createPlaylist(playlistData) {
        try {
            await this.initialize();
            const result = await Playlist.create(this.db, playlistData);
            return { success: true, playlistId: result.id };
        } catch (error) {
            console.error('Error creating playlist:', error);
            return { success: false, error: error.message };
        } finally {
            await this.db.close();
        }
    }

    async getPlaylistById(id) {
        try {
            await this.initialize();
            const playlist = await Playlist.getById(this.db, id);
            return { success: true, playlist };
        } catch (error) {
            console.error('Error getting playlist:', error);
            return { success: false, error: error.message };
        } finally {
            await this.db.close();
        }
    }

    async updatePlaylist(id, playlistData) {
        try {
            await this.initialize();
            await Playlist.update(this.db, id, playlistData);
            return { success: true };
        } catch (error) {
            console.error('Error updating playlist:', error);
            return { success: false, error: error.message };
        } finally {
            await this.db.close();
        }
    }

    async deletePlaylist(id) {
        try {
            await this.initialize();
            await Playlist.delete(this.db, id);
            return { success: true };
        } catch (error) {
            console.error('Error deleting playlist:', error);
            return { success: false, error: error.message };
        } finally {
            await this.db.close();
        }
    }

    async getUserPlaylists(userId) {
        try {
            await this.initialize();
            const playlists = await Playlist.getUserPlaylists(this.db, userId);
            return { success: true, playlists };
        } catch (error) {
            console.error('Error getting user playlists:', error);
            return { success: false, error: error.message };
        } finally {
            await this.db.close();
        }
    }

    async getPlaylistVideos(playlistId) {
        try {
            await this.initialize();
            const videos = await Playlist.getVideos(this.db, playlistId);
            return { success: true, videos };
        } catch (error) {
            console.error('Error getting playlist videos:', error);
            return { success: false, error: error.message };
        } finally {
            await this.db.close();
        }
    }

    async addVideoToPlaylist(playlistId, videoId) {
        try {
            await this.initialize();
            await Playlist.addVideo(this.db, playlistId, videoId);
            return { success: true };
        } catch (error) {
            console.error('Error adding video to playlist:', error);
            return { success: false, error: error.message };
        } finally {
            await this.db.close();
        }
    }

    async removeVideoFromPlaylist(playlistId, videoId) {
        try {
            await this.initialize();
            await Playlist.removeVideo(this.db, playlistId, videoId);
            return { success: true };
        } catch (error) {
            console.error('Error removing video from playlist:', error);
            return { success: false, error: error.message };
        } finally {
            await this.db.close();
        }
    }
}

module.exports = PlaylistService;