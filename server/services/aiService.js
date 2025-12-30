const { GoogleGenerativeAI } = require('@google/generative-ai');
const Settings = require('../models/Settings');

class AIService {
    constructor() {
        this.genAI = null;
        this.model = null;
        this.initialized = false;
        // Add rate limiting
        this.lastRequestTime = 0;
        this.minRequestInterval = 2000; // 2 seconds between requests
        this.db = null; // Database connection
    }

    // Set database connection
    setDatabase(db) {
        this.db = db;
    }

    async initialize() {
        try {
            let apiKey = process.env.GEMINI_API_KEY;

            // If no environment API key, check database
            if (!apiKey && this.db) {
                try {
                    const setting = await this.db.get('SELECT value FROM settings WHERE key = ?', ['geminiApiKey']);
                    if (setting && setting.value) {
                        apiKey = setting.value;
                    }
                } catch (dbError) {
                    console.warn('Could not retrieve API key from database:', dbError.message);
                }
            }

            if (!apiKey) {
                throw new Error('GEMINI_API_KEY is not configured');
            }

            this.genAI = new GoogleGenerativeAI(apiKey);
            // Try gemini-1.5-flash first, fallback to gemini-pro if not available
            // Use a supported model - gemini-1.5-flash may not be available in all regions
        try {
            this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        } catch (modelError) {
            console.warn('gemini-1.5-flash not available, trying gemini-pro');
            this.model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
        }
            this.initialized = true;
            console.log('AI Service initialized successfully');
        } catch (error) {
            console.error('Failed to initialize AI Service:', error.message);
            // Don't throw error here to prevent server startup failure
            this.initialized = false;
        }
    }

    async ensureInitialized() {
        if (!this.initialized) {
            await this.initialize();
        }
    }

    // Add rate limiting function
    async rateLimit() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;

        if (timeSinceLastRequest < this.minRequestInterval) {
            const delay = this.minRequestInterval - timeSinceLastRequest;
            console.log(`Rate limiting: waiting ${delay}ms before next request`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        this.lastRequestTime = Date.now();
    }

    /**
     * Categorize a video based on its title and description
     */
    async categorizeVideo(videoData) {
        try {
            await this.ensureInitialized();
            await this.rateLimit(); // Apply rate limiting

            const prompt = `
            Based on the following video content, please categorize it into one of these categories:
            - Development
            - Design
            - Marketing
            - Business
            - Education
            - Entertainment
            - Technology
            - Science
            - Health
            - Other

            Video Title: "${videoData.title}"
            Video Description: "${videoData.description || 'No description provided'}"

            Respond with only the category name (one word) that best fits this content.
            `;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const category = response.text().trim();

            return {
                success: true,
                category: category,
                confidence: 'high'
            };
        } catch (error) {
            console.error('Error in categorizeVideo:', error);
            // Check if this is a quota error
            if (error.message && (error.message.includes('429') || error.message.includes('quota'))) {
                return {
                    success: false,
                    error: 'Quota exceeded: You have reached your daily limit for Google Gemini API. Please try again tomorrow or upgrade your plan.',
                    category: 'Other'
                };
            }
            return {
                success: false,
                error: error.message,
                category: 'Other'
            };
        }
    }

    /**
     * Generate relevant tags for a video
     */
    async generateTags(videoData) {
        try {
            await this.ensureInitialized();
            await this.rateLimit(); // Apply rate limiting

            const prompt = `
            Based on the following video content, please generate 5-10 relevant tags that would help with discoverability.
            Return the tags as a comma-separated list.

            Video Title: "${videoData.title}"
            Video Description: "${videoData.description || 'No description provided'}"

            Tags:
            `;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const tagsText = response.text().trim();

            // Split tags by comma and clean them up
            const tags = tagsText.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);

            return {
                success: true,
                tags: tags
            };
        } catch (error) {
            console.error('Error in generateTags:', error);
            // Check if this is a quota error
            if (error.message && (error.message.includes('429') || error.message.includes('quota'))) {
                return {
                    success: false,
                    error: 'Quota exceeded: You have reached your daily limit for Google Gemini API. Please try again tomorrow or upgrade your plan.',
                    tags: []
                };
            }
            return {
                success: false,
                error: error.message,
                tags: []
            };
        }
    }

    /**
     * Analyze video content and provide insights
     */
    async analyzeContent(videoData) {
        try {
            await this.ensureInitialized();
            await this.rateLimit(); // Apply rate limiting

            const prompt = `
            Analyze the following video content and provide insights about:
            1. Target audience
            2. Content difficulty level
            3. Key learning objectives (if educational)
            4. Suggested improvements for better discoverability
            5. Content quality assessment

            Video Title: "${videoData.title}"
            Video Description: "${videoData.description || 'No description provided'}"

            Please provide your analysis in a structured format.
            `;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const analysis = response.text().trim();

            return {
                success: true,
                analysis: analysis
            };
        } catch (error) {
            console.error('Error in analyzeContent:', error);
            // Check if this is a quota error
            if (error.message && (error.message.includes('429') || error.message.includes('quota'))) {
                return {
                    success: false,
                    error: 'Quota exceeded: You have reached your daily limit for Google Gemini API. Please try again tomorrow or upgrade your plan.',
                    analysis: null
                };
            }
            return {
                success: false,
                error: error.message,
                analysis: null
            };
        }
    }

    /**
     * Generate a summary for video content
     */
    async generateSummary(videoData) {
        try {
            await this.ensureInitialized();
            await this.rateLimit(); // Apply rate limiting

            const prompt = `
            Create a concise and engaging summary for the following video content.
            The summary should be 2-3 sentences that capture the main value proposition and what viewers will learn.

            Video Title: "${videoData.title}"
            Video Description: "${videoData.description || 'No description provided'}"

            Summary:
            `;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const summary = response.text().trim();

            return {
                success: true,
                summary: summary
            };
        } catch (error) {
            console.error('Error in generateSummary:', error);
            // Check if this is a quota error
            if (error.message && (error.message.includes('429') || error.message.includes('quota'))) {
                return {
                    success: false,
                    error: 'Quota exceeded: You have reached your daily limit for Google Gemini API. Please try again tomorrow or upgrade your plan.',
                    summary: null
                };
            }
            return {
                success: false,
                error: error.message,
                summary: null
            };
        }
    }

    /**
     * Generate SEO metadata for a video
     */
    async generateMetadata(videoData) {
        try {
            await this.ensureInitialized();
            await this.rateLimit(); // Apply rate limiting

            const prompt = `
            Generate SEO-optimized metadata for the following video content:
            1. An SEO-friendly title (60 characters max)
            2. A meta description (150-160 characters)
            3. 5-10 relevant keywords

            Video Title: "${videoData.title}"
            Video Description: "${videoData.description || 'No description provided'}"

            Format your response as:
            SEO Title: [title here]
            Meta Description: [description here]
            Keywords: [keyword1, keyword2, keyword3, ...]
            `;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const metadataText = response.text().trim();

            // Parse the response
            const lines = metadataText.split('\n');
            const metadata = {
                seoTitle: '',
                metaDescription: '',
                keywords: []
            };

            lines.forEach(line => {
                if (line.startsWith('SEO Title:')) {
                    metadata.seoTitle = line.substring(10).trim();
                } else if (line.startsWith('Meta Description:')) {
                    metadata.metaDescription = line.substring(17).trim();
                } else if (line.startsWith('Keywords:')) {
                    const keywordsText = line.substring(9).trim();
                    metadata.keywords = keywordsText.split(',').map(k => k.trim()).filter(k => k.length > 0);
                }
            });

            return {
                success: true,
                metadata: metadata
            };
        } catch (error) {
            console.error('Error in generateMetadata:', error);
            // Check if this is a quota error
            if (error.message && (error.message.includes('429') || error.message.includes('quota'))) {
                return {
                    success: false,
                    error: 'Quota exceeded: You have reached your daily limit for Google Gemini API. Please try again tomorrow or upgrade your plan.',
                    metadata: null
                };
            }
            return {
                success: false,
                error: error.message,
                metadata: null
            };
        }
    }

    /**
     * Batch process multiple videos for categorization and tagging
     */
    async batchProcess(videos, operations = ['categorize', 'tags']) {
        const results = [];

        for (const video of videos) {
            const result = {
                videoId: video.id,
                title: video.title,
                operations: {}
            };

            // Process each requested operation
            for (const operation of operations) {
                try {
                    switch (operation) {
                        case 'categorize':
                            result.operations.categorize = await this.categorizeVideo(video);
                            break;
                        case 'tags':
                            result.operations.tags = await this.generateTags(video);
                            break;
                        case 'analysis':
                            result.operations.analysis = await this.analyzeContent(video);
                            break;
                        case 'summary':
                            result.operations.summary = await this.generateSummary(video);
                            break;
                        case 'metadata':
                            result.operations.metadata = await this.generateMetadata(video);
                            break;
                    }
                } catch (error) {
                    result.operations[operation] = {
                        success: false,
                        error: error.message
                    };
                }
            }

            results.push(result);
        }

        return {
            success: true,
            processedCount: results.length,
            results: results
        };
    }

    /**
     * Check AI service status
     */
    async getStatus() {
        // Check if we have an API key from environment
        let hasEnvApiKey = !!process.env.GEMINI_API_KEY;
        let hasDbApiKey = false;

        // Check database for API key if database is available
        if (this.db) {
            try {
                const setting = await Settings.get(this.db, 'geminiApiKey');
                hasDbApiKey = !!(setting && setting.value);
            } catch (error) {
                console.warn('Could not check database for API key:', error.message);
            }
        }

        return {
            initialized: this.initialized,
            hasEnvApiKey: hasEnvApiKey,
            hasDbApiKey: hasDbApiKey,
            hasApiKey: hasEnvApiKey || hasDbApiKey,
            model: this.model ? 'gemini-1.5-flash' : null,
            status: this.initialized ? 'ready' : 'not_initialized'
        };
    }
}

module.exports = new AIService();