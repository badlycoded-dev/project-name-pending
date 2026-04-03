const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4040/api';

// Умная функция для заголовков с токеном
function getAuthHeaders() {
  const token = localStorage.getItem('token');
  if (!token) return {};
  
  return {
    'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
  };
}

export const courseService = {
  // 1. Получить ВСЕ публичные курсы (для Главной и Поиска)
  getAll: async () => {
    try {
      const response = await fetch(`${API_URL}/courses`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' } 
      });
      
      if (!response.ok) throw new Error('Failed to fetch courses');
      
      const data = await response.json();
      const coursesList = data.data || data || [];
      
      //запрашиваем детали для каждого курса
      const detailedCourses = await Promise.all(
        coursesList.map(async (shortCourse) => {
          try {
            const courseId = shortCourse._id || shortCourse.id;

            // 1. Запрашиваем полный курс, чтобы достать массив links (картинки)
            const detailRes = await fetch(`${API_URL}/courses/${courseId}`);
            const detailData = await detailRes.json();
            const fullCourse = detailData.data || shortCourse;

            // 2. Запрашиваем автора по его ID, чтобы достать никнейм
            let authorName = 'Unknown';
            const uId = fullCourse.userId?._id || fullCourse.userId;
            if (uId) {
              try {
                const token = localStorage.getItem('token');
                const authHeader = token ? (token.startsWith('Bearer ') ? token : `Bearer ${token}`) : '';
                const userRes = await fetch(`${API_URL}/users/${uId}`, {
                  headers: authHeader ? { 'Authorization': authHeader } : {}
                });
                if (userRes.ok) {
                  const userData = await userRes.json();
                  authorName = userData.data?.nickname || authorName;
                }
              } catch (e) { /* Игнорируем ошибки, если нет доступа к юзеру */ }
            }

            // Отдаем странице Поиска уже "склеенный" красивый объект
            return {
              ...shortCourse,
              links: fullCourse.links || [], // Подсовываем скачанные картинки
              author: authorName             // Подсовываем скачанное имя
            };
          } catch (e) {
            return shortCourse; // Если что-то пошло не так, отдаем как есть
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
  getById: async (id) => {
    try {
      const response = await fetch(`${API_URL}/courses/${id}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) throw new Error('Failed to fetch course');
      
      const data = await response.json();
      return data.data || data;
    } catch (error) {
      console.error(`getById error for ${id}:`, error);
      throw error;
    }
  },

  // 3. Создать новый курс
  create: async (courseData, user) => {
    try {
      const payload = {
        userId: user.id || user._id,
        title: courseData.title,
        description: courseData.description,
        direction: courseData.direction,
        level: courseData.level,
        price: Number(courseData.price) || 0,
        skills: courseData.whatYouWillLearn || [],
        status: 'editing' // По умолчанию отправляем как черновик
      };

      const response = await fetch(`${API_URL}/manage/courses`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(), // Правильно передаем токен!
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let errorMessage = 'Failed to create course';
        const responseText = await response.text();
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.message || errorMessage;
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
  update: async (id, updatedData) => {
    try {
      const response = await fetch(`${API_URL}/manage/courses/${id}`, {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedData)
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
  delete: async (id) => {
    try {
      const response = await fetch(`${API_URL}/manage/courses/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders() // Передаем токен для удаления
      });

      if (!response.ok) throw new Error('Failed to delete course');
      return true;
    } catch (error) {
      console.error('delete course error:', error);
      throw error;
    }
  },

  // 6. Загрузить обложку (thumbnail)
  uploadThumbnail: async (courseId, file) => {
    if (!file) return null;
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_URL}/manage/courses/${courseId}/files?thumbnail=true`, {
        method: 'POST',
        headers: getAuthHeaders(), // ПРИМЕЧАНИЕ: Content-Type не передаем! Браузер сам поставит multipart/form-data
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

  // 7. Загрузить контент-файлы
  uploadContentFiles: async (courseId, files) => {
    if (!files || files.length === 0) return [];
    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('files', file);
      });

      const response = await fetch(`${API_URL}/manage/courses/${courseId}/files/multiple`, {
        method: 'POST',
        headers: getAuthHeaders(), // Без Content-Type
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