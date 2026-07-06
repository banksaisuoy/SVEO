document.addEventListener('DOMContentLoaded', () => {
    const titleInput = document.getElementById('setting-title');
    const colorInput = document.getElementById('setting-primary');
    const colorTextInput = document.getElementById('setting-primary-text');
    const themeToggle = document.getElementById('setting-theme');
    const previewTitle = document.getElementById('preview-title');
    const form = document.getElementById('settings-form');
    const saveBtn = document.getElementById('save-settings-btn');
    const toastContainer = document.getElementById('toast-container');
    const body = document.body;

    // Helper: fetch wrapper with credentials
    async function apiFetch(url, opts = {}) {
        opts.credentials = 'include';
        return fetch(url, opts);
    }

    // Helper: Show toast notification
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = type === 'success' ? `<i class="fas fa-check-circle mr-2"></i>${message}` : `<i class="fas fa-exclamation-circle mr-2"></i>${message}`;
        toastContainer.appendChild(toast);

        // Trigger reflow
        void toast.offsetWidth;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Load settings on init
    async function loadSettings() {
        try {
            const res = await apiFetch('/api/settings');
            if (res.ok) {
                const s = await res.json();
                applySettingsToDOM(s.title || 'VISIONHUB', s.primaryColor || '#0b5dbb', s.theme || 'dark');
            } else {
                throw new Error('API failed, falling back to local storage');
            }
        } catch (err) {
            console.warn(err.message);
            // Fallback to local storage (Mock Data)
            const title = localStorage.getItem('site_title') || 'VISIONHUB';
            const primaryColor = localStorage.getItem('site_primary_color') || '#0b5dbb';
            const theme = localStorage.getItem('theme') || 'dark';
            applySettingsToDOM(title, primaryColor, theme);
        }
    }

    // Apply settings to form and preview
    function applySettingsToDOM(title, color, theme) {
        // Update inputs
        titleInput.value = title;
        colorInput.value = color;
        colorTextInput.value = color;
        themeToggle.checked = theme === 'dark';

        // Update preview DOM
        updatePreviewTitle(title);
        updatePreviewColor(color);
        updatePreviewTheme(theme);
    }

    function updatePreviewTitle(val) {
        previewTitle.textContent = val || 'VISIONHUB';
    }

    function updatePreviewColor(val) {
        document.documentElement.style.setProperty('--primary', val);
    }

    function updatePreviewTheme(val) {
        if (val === 'light') {
            body.classList.add('light-theme');
        } else {
            body.classList.remove('light-theme');
        }
    }

    // Live preview event listeners
    titleInput.addEventListener('input', (e) => updatePreviewTitle(e.target.value));

    colorInput.addEventListener('input', (e) => {
        colorTextInput.value = e.target.value;
        updatePreviewColor(e.target.value);
    });

    colorTextInput.addEventListener('input', (e) => {
        const val = e.target.value;
        if (/^#[0-9A-F]{6}$/i.test(val)) {
            colorInput.value = val;
            updatePreviewColor(val);
        }
    });

    themeToggle.addEventListener('change', (e) => {
        updatePreviewTheme(e.target.checked ? 'dark' : 'light');
    });

    // Save settings
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const title = titleInput.value.trim();
        const primaryColor = colorInput.value;
        const theme = themeToggle.checked ? 'dark' : 'light';

        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Saving...';

        try {
            const res = await apiFetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, primaryColor, theme })
            });

            if (res.ok) {
                showToast('Settings saved successfully!');
                // Also update localStorage as a fallback/sync for frontend
                localStorage.setItem('site_title', title);
                localStorage.setItem('site_primary_color', primaryColor);
                localStorage.setItem('theme', theme);
            } else {
                throw new Error('Failed to save to server');
            }
        } catch (err) {
            console.warn(err.message);
            // Fallback to local storage (Mock Data saving)
            localStorage.setItem('site_title', title);
            localStorage.setItem('site_primary_color', primaryColor);
            localStorage.setItem('theme', theme);
            showToast('Settings saved locally (API offline)', 'success');
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save mr-2"></i> Save Changes';
        }
    });

    // Init
    loadSettings();
});