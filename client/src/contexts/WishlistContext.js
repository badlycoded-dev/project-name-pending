import React, { createContext, useState, useEffect, useContext } from 'react';

const WishlistContext = createContext();

export const useWishlist = () => useContext(WishlistContext);

export const WishlistProvider = ({ children }) => {
  // При загрузке сайта достаем список избранного из памяти браузера
  const [wishlist, setWishlist] = useState(() => {
    const saved = localStorage.getItem('wishlist');
    return saved ? JSON.parse(saved) : [];
  });

  // Если список меняется — автоматически сохраняем его в память
  useEffect(() => {
    localStorage.setItem('wishlist', JSON.stringify(wishlist));
  }, [wishlist]);

  // Функция переключения (добавить/удалить)
  const toggleWishlist = (course) => {
    setWishlist(prev => {
      // Ищем курс по _id (или id, если у вас так названо)
      const courseId = course._id || course.id; 
      const exists = prev.find(item => (item._id || item.id) === courseId);
      
      if (exists) {
        // Если уже есть — удаляем
        return prev.filter(item => (item._id || item.id) !== courseId);
      } else {
        // Если нет — добавляем в конец
        return [...prev, course];
      }
    });
  };

  // Проверка: находится ли курс в избранном (чтобы закрашивать сердечко красным)
  const isInWishlist = (courseId) => {
    return wishlist.some(item => (item._id || item.id) === courseId);
  };

  return (
    <WishlistContext.Provider value={{ wishlist, toggleWishlist, isInWishlist }}>
      {children}
    </WishlistContext.Provider>
  );
};