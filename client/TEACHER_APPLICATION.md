# Teacher Application API Contract / Документация для бекэнда

Краткая спецификация для интеграции клиент-формы заявок преподавателей.

Note: UI strings are internationalized via `SettingsContext` (translation keys prefixed with `teacher.`) — please coordinate if you need specific field labels or messages to be changed.


Endpoint
- POST /api/teacher-applications
- Auth: optional; если пользователь авторизован — можно требовать токен Bearer
- Content-Type: multipart/form-data

Формат запроса (поля form-data)
- name: string (required)
- email: string (required)
- bio: string (required, min 50 chars)
- subjects: string (comma-separated tags)
- experience: number (years, optional)
- cert: file (required) — PDF/JPG/PNG
- id: file (required) — PDF/JPG/PNG (удостоверение личности)
- sample: file (optional) — MP4/JPG/PNG (пример урока)

Ответы
- Успех: 201 Created с телом { ok: true, message: '...' , applicationId: '...' }
- Ошибка валидации: 400 Bad Request с { ok: false, message: 'Описание ошибки' }
- Ошибка сервера: 500

Рекомендации по бекэнду
- Хранить файлы в защищённом хранилище (S3 или аналог), а не в публичной веб-папке
- Валидировать mime-type и размер (например, 10MB для документов, 100MB для видео)
- Создавать ресурс "teacher_application" со статусом: pending, approved, rejected
- Отправлять уведомление админам на рассмотрение (email или в админ-панели)
- По одобрению присваивать пользователю роль "teacher" и уведомлять его

Примечание для разработчиков
- Клиент ожидает в ответе поле `message` с описанием результата, и код ответа 200/201 при успехе.
- В случае ошибок желательно вернуть JSON с `message` для отображения пользователю.

---

Русская версия подробно:

1) Эндпойнт
- POST /api/teacher-applications
- Аутентификация: рекомендуется требовать Bearer токен (чтобы знать, кто подаёт заявку); если не хотите требовать — принимайте поле `email`, но лучше хранить ссылку на userId.
- Content-Type: multipart/form-data

2) Поля (form-data)
- name: string (required)
- email: string (required)
- bio: string (required, min 50)
- subjects: string (comma-separated)
- experience: number (optional)
- cert: file (required) — PDF/JPG/PNG, max ~10MB
- id: file (required) — PDF/JPG/PNG, max ~10MB
- sample: file (optional) — MP4/JPG/PNG, max ~100MB

3) Что сервер должен делать
- Валидировать поля и файлы (mime-type, размер). Если файл не соответствует требованиям — возвращать 4xx с JSON { message: '...' }.
- Сохранить файлы в защищённом хранилище (S3 или аналог), не в публичной директории веб-сервера.
- Создать запись в таблице/коллекции `teacher_applications` с полями: id, userId (если аутентифицирован), name, email, bio, subjects (array), experience, certUrl, idUrl, sampleUrl, status ('pending'), createdAt, updatedAt, reviewerId (null).
- Вернуть 201 Created с { ok: true, message: 'Application received', applicationId: '<id>' }.

4) Админский рабочий процесс
- Создать админ-интерфейс (или endpoint) для просмотра заявок, скачивания файлов, и изменения статуса (approve/reject).
- При одобрении (approve):
  - Обновить запись заявки: status='approved', reviewerId=<adminId>, reviewedAt = now
  - Присвоить пользователю роль `teacher` (например, в таблице users: role='teacher' или флаг isTeacher=true)
  - Отправить пользователю уведомление (email) о статусе и дальнейших инструкциях (например, как создать первый курс)
- При отклонении (reject): сохранить причину (reason) и уведомить пользователя.

5) Безопасность и проверки
- Проверять mime-type и расширение файлов и ограничивать размер.
- Если хотите, делать ручную проверку содержимого (например, проверить сертификат на соответствие выданному формату).
- Логи действий админа и доступа к файлам должны храниться.

6) Рекомендации по API и ответам
- Успех: 201 { ok: true, message: 'Application received', applicationId }
- Валидция: 400 { ok: false, message: '...' }
- Ошибки сервера: 500 { ok: false, message: 'Server error' }

7) Присваивание роли — важно
- Клиент ожидает, что после одобрения на серверной стороне у пользователя появится роль `teacher` (или флаг `isTeacher`). Клиент показывает дополнительные возможности (Add Course) когда `user.role === 'teacher' || user.isTeacher`.
- В идеале endpoint, который админ использует для approve, должен либо: a) вернуть обновлённого пользователя, b) или вызывать уведомление, и фронтенд / клиент должен обновить локальный профиль (например, при следующем логине).

8) Для быстрого локального тестирования (dev)
- На клиенте реализована вспомогательная кнопка (только для разработки) — **"Grant teacher role (dev)"** в `AccountPage`. Нажатие на неё устанавливает `user.role='teacher'` и `user.isTeacher=true` в `localStorage` (т.е. локально) и перезагружает страницу, чтобы вы могли проверить UI для преподавателя без бекенда.
- Пожалуйста, не используйте этот механизм в продакшене. Он предназначен только для разработки/демо.

9) Пример схемы базы (Postgres-like)
- teacher_applications (
  id UUID PRIMARY KEY,
  user_id UUID NULL,
  name TEXT,
  email TEXT,
  bio TEXT,
  subjects TEXT[],
  experience INTEGER,
  cert_url TEXT,
  id_url TEXT,
  sample_url TEXT,
  status TEXT CHECK (status IN ('pending','approved','rejected')) DEFAULT 'pending',
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  reviewer_id UUID NULL,
  reason TEXT NULL
)

10) Тесты и QA
- Тесты API: отправка валидных/невалидных файлов, проверка статусов, права доступа (только админ может approve)
- Тесты интеграции: после approve — пользователь действительно получает роль `teacher` и может использовать `POST /api/courses`