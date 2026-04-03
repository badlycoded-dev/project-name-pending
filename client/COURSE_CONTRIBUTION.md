# Course Contribution (Client-side notes)

This document describes the client-side expectations for the instructor 'Add Course' form.

Endpoint (backend)
- POST /api/courses
- Auth: required (Bearer token)
- Content-Type: application/json (for now; can be multipart if files are uploaded)

Payload
- {
  title: string (required),
  repoUrl: string (required) // GitHub repository URL where course materials are stored
  description: string,
  tags: [string],
  price: number (USD),
  visibility: 'draft' | 'published'
}

Responses
- Success: 201 Created with { ok: true, message, courseId }
- Error: 4xx with { message }

Notes for backend team
- Validate repoUrl is a valid URL and optionally verify it is a GitHub repo (host=github.com)
- Accept tags as an array and store them as normalized values
- Store course metadata in DB; if course includes assets in client future, support file uploads or presigned URLs
- Only authenticated users with role "teacher" should be allowed to create courses

Client-side
- UI: `src/components/AddCourseForm.js`, page: `src/pages/instructor/AddCoursePage.js`
- Translations: keys prefixed with `course.` in `SettingsContext` translations

