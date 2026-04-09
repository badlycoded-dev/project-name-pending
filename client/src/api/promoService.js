const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4040/api';

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  if (!token) return {};
  return {
    'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
  };
}

export const promoService = {
  // Валидировать промокод для конкретного курса
  // КОНТРАКТ: POST /promos/validate — Bearer
  validate: async (code, courseId) => {
    try {
      const response = await fetch(`${API_URL}/promos/validate`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          courseId: courseId
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to validate promo: ${response.statusText}`);
      }

      const data = await response.json();
      return data; // { valid: boolean, reason?: string, discountType, discountValue, etc. }
    } catch (error) {
      console.error('promo validate error:', error);
      return { valid: false, reason: error.message };
    }
  },

  // Валидировать промокод для нескольких курсов
  // Проверит код для первого курса из списка
  validateForCart: async (code, courseIds) => {
    if (!courseIds || courseIds.length === 0) {
      return { valid: false, reason: 'No courses in cart' };
    }

    // Пытаемся валидировать для первого курса
    // Более идеально было бы проверить для всех, но API требует один courseId
    return await promoService.validate(code, courseIds[0]);
  },

  // Применить промокод (добавить курс в библиотеку)
  // КОНТРАКТ: POST /promos/apply — Bearer
  apply: async (code, courseId) => {
    try {
      const response = await fetch(`${API_URL}/promos/apply`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          courseId: courseId
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `Failed to apply promo: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('promo apply error:', error);
      throw error;
    }
  },

  // Получить список всех доступных промокодов (для manage+)
  // КОНТРАКТ: GET /promos — create+
  getAll: async () => {
    try {
      const response = await fetch(`${API_URL}/promos`, {
        method: 'GET',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch promos: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('get promos error:', error);
      return [];
    }
  }
};
