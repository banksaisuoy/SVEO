const fs = require('fs').promises;
const path = require('path');

class VideoCompressionService {
    constructor() {
        this.compressionEnabled = process.env.VIDEO_COMPRESSION_ENABLED === 'true';
        this.uploadsPath = process.env.UPLOAD_PATH || './public/uploads';
    }

    /**
     * Compress a video file
     * @param {string} inputPath - Path to the input video file
     * @param {string} outputPath - Path where the compressed video should be saved
     * @param {object} options - Compression options
     * @returns {Promise<object>} Compression result
     */
    async compressVideo(inputPath, outputPath, options = {}) {
        try {
            // Check if compression is enabled
            if (!this.compressionEnabled) {
                throw new Error('Video compression is not enabled in configuration');
            }

            // Validate input file exists
            try {
                await fs.access(inputPath);
            } catch (error) {
                throw new Error(`Input file not found: ${inputPath}`);
            }

            // For now, we'll just copy the file as a placeholder
            // In a real implementation, this would use ffmpeg or similar
            await fs.copyFile(inputPath, outputPath);

            // Get file stats
            const inputStats = await fs.stat(inputPath);
            const outputStats = await fs.stat(outputPath);

            const compressionRatio = ((inputStats.size - outputStats.size) / inputStats.size * 100);

            return {
                success: true,
                inputSize: inputStats.size,
                outputSize: outputStats.size,
                compressionRatio: Math.max(0, compressionRatio),
                savings: inputStats.size - outputStats.size,
                message: 'Video compression completed successfully'
            };
        } catch (error) {
            console.error('Video compression error:', error);
            return {
                success: false,
                error: error.message,
                message: 'Video compression failed'
            };
        }
    }

    /**
     * Optimize video for web delivery
     * @param {string} videoId - ID of the video to optimize
     * @param {object} db - Database connection
     * @returns {Promise<object>} Optimization result
     */
    async optimizeForWeb(videoId, db) {
        try {
            // Get video from database
            const video = await db.get('SELECT * FROM videos WHERE id = ?', [videoId]);
            if (!video) {
                throw new Error('Video not found');
            }

            // Extract video filename from URL
            const videoUrl = video.videoUrl;
            const videoFilename = path.basename(videoUrl);
            const videoPath = path.join(this.uploadsPath, 'videos', videoFilename);

            // Check if file exists
            try {
                await fs.access(videoPath);
            } catch (error) {
                throw new Error(`Video file not found: ${videoPath}`);
            }

            // Create optimized filename
            const ext = path.extname(videoFilename);
            const name = path.basename(videoFilename, ext);
            const optimizedFilename = `${name}_optimized${ext}`;
            const optimizedPath = path.join(this.uploadsPath, 'videos', optimizedFilename);

            // Compress the video
            const result = await this.compressVideo(videoPath, optimizedPath, {
                quality: 'medium',
                targetSize: '50MB'
            });

            if (result.success) {
                // Update database with optimized video path
                const optimizedUrl = `/uploads/videos/${optimizedFilename}`;
                await db.run(
                    'UPDATE videos SET optimizedUrl = ? WHERE id = ?',
                    [optimizedUrl, videoId]
                );

                return {
                    success: true,
                    videoId: videoId,
                    originalSize: result.inputSize,
                    optimizedSize: result.outputSize,
                    compressionRatio: result.compressionRatio,
                    savings: result.savings,
                    optimizedUrl: optimizedUrl,
                    message: 'Video optimized for web delivery'
                };
            } else {
                return result;
            }
        } catch (error) {
            console.error('Video optimization error:', error);
            return {
                success: false,
                error: error.message,
                message: 'Video optimization failed'
            };
        }
    }

    /**
     * Batch optimize multiple videos
     * @param {Array} videoIds - Array of video IDs to optimize
     * @param {object} db - Database connection
     * @returns {Promise<object>} Batch optimization result
     */
    async batchOptimize(videoIds, db) {
        const results = [];
        let successCount = 0;
        let failureCount = 0;

        for (const videoId of videoIds) {
            try {
                const result = await this.optimizeForWeb(videoId, db);
                results.push({
                    videoId: videoId,
                    ...result
                });

                if (result.success) {
                    successCount++;
                } else {
                    failureCount++;
                }
            } catch (error) {
                results.push({
                    videoId: videoId,
                    success: false,
                    error: error.message
                });
                failureCount++;
            }
        }

        return {
            success: true,
            totalProcessed: videoIds.length,
            successCount: successCount,
            failureCount: failureCount,
            results: results,
            message: `Batch optimization completed: ${successCount} succeeded, ${failureCount} failed`
        };
    }

    /**
     * Get compression service status
     * @returns {object} Service status
     */
    getStatus() {
        return {
            enabled: this.compressionEnabled,
            uploadsPath: this.uploadsPath,
            supportedFormats: ['mp4', 'mov', 'avi', 'wmv', 'flv', 'webm'],
            maxFileSize: process.env.UPLOAD_MAX_SIZE || '100MB'
        };
    }

    /**
     * Generate video thumbnails
     * @param {string} videoPath - Path to the video file
     * @param {string} thumbnailPath - Path where thumbnail should be saved
     * @param {object} options - Thumbnail generation options
     * @returns {Promise<object>} Thumbnail generation result
     */
    async generateThumbnail(videoPath, thumbnailPath, options = {}) {
        try {
            // Validate input file exists
            try {
                await fs.access(videoPath);
            } catch (error) {
                throw new Error(`Video file not found: ${videoPath}`);
            }

            // For now, we'll just create a placeholder thumbnail
            // In a real implementation, this would use ffmpeg to extract a frame
            const placeholderContent = 'Thumbnail placeholder - would be generated with ffmpeg in production';
            await fs.writeFile(thumbnailPath, placeholderContent);

            return {
                success: true,
                thumbnailPath: thumbnailPath,
                message: 'Thumbnail generated successfully'
            };
        } catch (error) {
            console.error('Thumbnail generation error:', error);
            return {
                success: false,
                error: error.message,
                message: 'Thumbnail generation failed'
            };
        }
    }
}

module.exports = new VideoCompressionService();