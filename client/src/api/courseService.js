const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4040/api';

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  if (!token) return {};
  return {
    'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
  };
}

export const courseService = {
  // 1. Получить ВСЕ публичные курсы
  getAll: async () => {
    try {
      // КОНТРАКТ: GET /courses — public
      const response = await fetch(`${API_URL}/courses`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) throw new Error('Failed to fetch courses');
      
      const data = await response.json();
      const coursesList = data.data || data || [];
      
      const detailedCourses = await Promise.all(
        coursesList.map(async (shortCourse) => {
          try {
            const courseId = shortCourse._id || shortCourse.id;

            // Запрашиваем полный курс чтобы достать links
            // КОНТРАКТ: GET /courses/:id — public
            const detailRes = await fetch(`${API_URL}/courses/${courseId}`);
            const detailData = await detailRes.json();
            const fullCourse = detailData.data || shortCourse;

            // title/description/skills лежат в trans[0]
            const trans0 = fullCourse.trans?.[0] || {};

            // Запрашиваем автора
            // КОНТРАКТ: GET /users/:id — public (без токена)
            let authorName = 'Unknown';
            const uId = fullCourse.userId?._id || fullCourse.userId;
            if (uId) {
              try {
                const userRes = await fetch(`${API_URL}/users/${uId}`);
                if (userRes.ok) {
                  const userData = await userRes.json();
                  authorName = userData.data?.nickname || authorName;
                }
              } catch (e) { /* ignore */ }
            }

            return {
              ...shortCourse,
              title: trans0.title || shortCourse.title || '',
              description: trans0.description || shortCourse.description || '',
              skills: trans0.skills || shortCourse.skills || [],
              links: fullCourse.links || [],
              author: authorName
            };
          } catch (e) {
            return shortCourse;
          }
        })
      );

      return detailedCourses;
    } catch (error) {
      console.error('getAll courses error:', error);
      return [];
    }
  },

  // 2. Получить один курс по ID
  // КОНТРАКТ: GET /courses/:id — public
  getById: async (id) => {
    try {
      const response = await fetch(`${API_URL}/courses/${id}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) throw new Error('Failed to fetch course');
      
      const data = await response.json();
      const course = data.data || data;

      // Разворачиваем trans[0] для удобства компонентов
      const trans0 = course.trans?.[0] || {};
      return {
        ...course,
        title: trans0.title || course.title || '',
        description: trans0.description || course.description || '',
        skills: trans0.skills || course.skills || [],
      };
    } catch (error) {
      console.error(`getById error for ${id}:`, error);
      throw error;
    }
  },

  // 3. Создать новый курс
  // КОНТРАКТ: POST /courses — create+
  // ВАЖНО: title/description/skills идут внутри trans[]
  create: async (courseData) => {
    try {
      const payload = {
        direction: courseData.direction,
        level: courseData.level,
        price: Number(courseData.price) || 0,
        base_lang: courseData.base_lang || 'en',
        courseType: courseData.courseType || 'SELF_TAUGHT',
        trans: [
          {
            title: courseData.title,
            description: courseData.description || '',
            skills: courseData.skills || []
          }
        ]
      };

      const response = await fetch(`${API_URL}/courses`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let errorMessage = 'Failed to create course';
        const responseText = await response.text();
        try {
          errorMessage = JSON.parse(responseText).message || errorMessage;
        } catch (e) {
          errorMessage = responseText || errorMessage;
        }
        throw new Error(`Server Error (${response.status}): ${errorMessage}`);
      }

      const data = await response.json();
      return data.data || data;
    } catch (error) {
      console.error('create course error:', error);
      throw error;
    }
  },

  // 4. Обновить курс
  // КОНТРАКТ: PATCH /courses/:id — create+
  update: async (id, updatedData) => {
    try {
      // Если передают title/description/skills — оборачиваем в trans
      const payload = { ...updatedData };
      if (updatedData.title || updatedData.description || updatedData.skills) {
        payload.trans = [
          {
            title: updatedData.title || '',
            description: updatedData.description || '',
            skills: updatedData.skills || []
          }
        ];
        delete payload.title;
        delete payload.description;
        delete payload.skills;
      }

      const response = await fetch(`${API_URL}/courses/${id}`, {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Failed to update course');
      
      const data = await response.json();
      return data.data || data;
    } catch (error) {
      console.error('update course error:', error);
      throw error;
    }
  },

  // 5. Удалить курс
  // КОНТРАКТ: DELETE /courses/:id — create+
  delete: async (id) => {
    try {
      const response = await fetch(`${API_URL}/courses/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (!response.ok) throw new Error('Failed to delete course');
      return true;
    } catch (error) {
      console.error('delete course error:', error);
      throw error;
    }
  },

  // 6. Загрузить обложку (thumbnail)
  // КОНТРАКТ: POST /courses/:id/files?thumbnail=true — create+
  uploadThumbnail: async (courseId, file) => {
    if (!file) return null;
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_URL}/courses/${courseId}/files?thumbnail=true`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData
      });

      if (!response.ok) throw new Error(`Thumbnail upload failed: ${response.statusText}`);
      
      const data = await response.json();
      return data.data || null;
    } catch (error) {
      console.error('uploadThumbnail error:', error);
      throw error;
    }
  },

  // 7. Загрузить несколько файлов
  // КОНТРАКТ: POST /courses/:id/files/multiple — create+
  uploadContentFiles: async (courseId, files) => {
    if (!files || files.length === 0) return [];
    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('files', file);
      });

      const response = await fetch(`${API_URL}/courses/${courseId}/files/multiple`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData
      });

      if (!response.ok) throw new Error(`Content files upload failed: ${response.statusText}`);
      
      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('uploadContentFiles error:', error);
      throw error;
    }
  }
};