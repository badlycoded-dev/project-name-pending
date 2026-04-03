import { useEffect, useContext } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css'; // Обязательно импортируем стили
import { SettingsContext } from '../contexts/SettingsContext';

export default function OnboardingTour() {
  const { t } = useContext(SettingsContext);

  useEffect(() => {
    // Проверяем, проходил ли юзер тур
    const isCompleted = localStorage.getItem('tourCompleted');
    
    if (!isCompleted) {
      // Настраиваем наш тур
      const driverObj = driver({
        showProgress: true,
        animate: true,
        nextBtnText: t('tour.next') || 'Next',
        prevBtnText: t('tour.back') || 'Back',
        doneBtnText: t('tour.last') || 'Finish',
        steps: [
          { 
            popover: { 
              title: t('tour.step1Title'), 
              description: t('tour.step1Desc'),
              side: "center",
              align: 'start'
            } 
          },
          { 
            element: '#tour-theme-toggle', 
            popover: { 
              title: t('tour.step2Title'), 
              description: t('tour.step2Desc'),
              side: "bottom", 
              align: 'start' 
            } 
          },
          { 
            element: '#tour-cart', 
            popover: { 
              title: t('tour.step3Title'), 
              description: t('tour.step3Desc'),
              side: "bottom", 
              align: 'start' 
            } 
          },
          { 
            element: '#tour-user-menu', 
            popover: { 
              title: t('tour.step4Title'), 
              description: t('tour.step4Desc'),
              side: "bottom", 
              align: 'end' 
            } 
          }
        ],
        onDestroyStarted: () => {
          // Когда тур закрывают или проходят до конца - сохраняем в память
          localStorage.setItem('tourCompleted', 'true');
          driverObj.destroy();
        },
      });

      // Запускаем тур
      driverObj.drive();
    }
  }, [t]); 

  return null;
}