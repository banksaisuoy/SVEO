// VisionHub - Category Management Module
// This file contains category management functionality for the admin panel

class CategoryManagement {
    constructor(app) {
        this.app = app;
    }

    async render() {
        const adminContent = document.getElementById('admin-content');

        try {
            const response = await this.app.api.get('/categories');
            const categories = response.success ? response.categories : [];

            const tableHtml = `
                <div class="flex justify-end mb-4">
                    <button id="add-category-btn" class="btn btn-primary">Add New Category</button>
                </div>
                <div class="table-container">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Category Name</th>
                                <th>Videos</th>
                                <th>Created</th>
                                <th class="text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${categories.map(category => {
                                const videoCount = this.app.state.allVideos.filter(v => v.categoryId === category.id).length;
                                return `
                                    <tr>
                                        <td class="font-medium">${category.name}</td>
                                        <td>${videoCount}</td>
                                        <td>${new Date(category.created_at).toLocaleDateString()}</td>
                                        <td class="text-right">
                                            <div class="action-buttons">
                                                <button class="btn btn-sm btn-secondary edit-category-btn" data-id="${category.id}">Edit</button>
                                                <button class="btn btn-sm btn-danger delete-category-btn" data-id="${category.id}">Delete</button>
                                            </div>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;

            adminContent.innerHTML = tableHtml;

            document.getElementById('add-category-btn').addEventListener('click', () => this.showCategoryForm());
            document.querySelectorAll('.edit-category-btn').forEach(btn => {
                btn.addEventListener('click', (e) => this.handleEditCategory(e));
            });
            document.querySelectorAll('.delete-category-btn').forEach(btn => {
                btn.addEventListener('click', (e) => this.handleDeleteCategory(e));
            });
        } catch (error) {
            console.error('Error rendering category management:', error);
            adminContent.innerHTML = '<div class="text-center text-error">Error loading categories</div>';
        }
    }

    async handleEditCategory(event) {
        const categoryId = event.currentTarget.dataset.id;
        try {
            const response = await this.app.api.get(`/categories/${categoryId}`);
            if (response.success) {
                this.showCategoryForm(response.category);
            }
        } catch (error) {
            console.error('Error loading category:', error);
            this.app.showToast('Error loading category', 'error');
        }
    }

    async handleDeleteCategory(event) {
        const categoryId = event.currentTarget.dataset.id;

        this.app.showConfirmationModal(
            'Are you sure you want to delete this category?',
            async () => {
                try {
                    await this.app.api.delete(`/categories/${categoryId}`);
                    this.app.showToast('Category deleted successfully', 'success');
                    await this.app.loadAllVideos();
                    this.render();
                } catch (error) {
                    console.error('Error deleting category:', error);
                    this.app.showToast('Error deleting category', 'error');
                }
            }
        );
    }

    showCategoryForm(category = null) {
        const formTitle = category ? 'Edit Category' : 'Add New Category';
        const modalHtml = `
            <div class="modal-content">
                <h3 class="modal-title">${formTitle}</h3>
                <form id="category-form" class="space-y-4">
                    <input type="hidden" id="category-id" value="${category ? category.id : ''}">
                    <div class="form-group">
                        <label for="form-category-name" class="form-label">Category Name</label>
                        <input type="text" id="form-category-name" value="${category ? category.name : ''}" class="form-input" required>
                    </div>
                    <div class="modal-footer">
                        <button type="button" id="cancel-btn" class="btn btn-secondary">Cancel</button>
                        <button type="submit" class="btn btn-primary">Save</button>
                    </div>
                </form>
            </div>
        `;

        this.app.showModal(modalHtml);

        document.getElementById('category-form').addEventListener('submit', (e) => this.handleCategoryFormSubmit(e, category));
        document.getElementById('cancel-btn').onclick = () => this.app.hideModal();
    }

    async handleCategoryFormSubmit(event, category) {
        event.preventDefault();
        const categoryId = document.getElementById('category-id').value;
        const name = document.getElementById('form-category-name').value;

        try {
            if (category) {
                await this.app.api.put(`/categories/${categoryId}`, { name });
                this.app.showToast('Category updated successfully', 'success');
            } else {
                await this.app.api.post('/categories', { name });
                this.app.showToast('Category created successfully', 'success');
            }

            this.app.hideModal();
            await this.app.loadAllVideos();
            this.render();
        } catch (error) {
            console.error('Error saving category:', error);
            this.app.showToast('Error saving category', 'error');
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CategoryManagement;
}