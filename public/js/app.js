            const endpoint = isUpdate ? `/api/videos/${id}` : '/api/videos';
            const method = isUpdate ? 'PUT' : 'POST';
            
            const res = await fetch(endpoint, {
                method: method,
                body: formData
            });
            
            if (res.ok) {
                videoModal.classList.add('hidden');