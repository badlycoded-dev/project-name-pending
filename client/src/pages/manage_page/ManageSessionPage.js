import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

function ManageSessionPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('overview');

  // Состояния для модальных окон
  const [showAddClassModal, setShowAddClassModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);

  // Состояния для данных из форм
  const [newClassData, setNewClassData] = useState({ title: '', date: '', time: '', type: 'Lecture' });
  const [newGroupData, setNewGroupData] = useState({ name: '', instructor: '', schedule: '' });

  // Моковые данные
  const sessionData = {
    title: 'MERN Stack Web Development',
    status: 'Active',
    type: 'Bootcamp',
    duration: '12 Weeks',
    enrolled: 45,
    maxCapacity: 50
  };

  const scheduleData = [
    { id: 1, title: 'Introduction to React', date: 'Oct 15, 2026', time: '18:00 - 20:00', type: 'Lecture', status: 'Completed' },
    { id: 2, title: 'State & Props', date: 'Oct 17, 2026', time: '18:00 - 20:00', type: 'Practice', status: 'Upcoming' },
    { id: 3, title: 'Node.js Basics', date: 'Oct 22, 2026', time: '18:00 - 20:00', type: 'Lecture', status: 'Upcoming' }
  ];

  const membersData = [
    { id: 1, name: 'Alex Johnson', email: 'alex.j@example.com', role: 'Student', progress: '45%', joined: 'Oct 10, 2026' },
    { id: 2, name: 'Maria Garcia', email: 'maria.g@example.com', role: 'Student', progress: '12%', joined: 'Oct 12, 2026' },
    { id: 3, name: 'Никита', email: 'admin@nure.ua', role: 'Instructor', progress: '—', joined: 'Oct 01, 2026' }
  ];

  const groupsData = [
    { id: 1, name: 'Group A - Evening', instructor: 'Никита', students: 25, schedule: 'Mon, Wed 18:00' },
    { id: 2, name: 'Group B - Weekend', instructor: 'Misha', students: 20, schedule: 'Sat 10:00' }
  ];

  // Обработчики форм
  const handleAddClass = (e) => {
    e.preventDefault();
    console.log('Отправляем новый урок на сервер:', newClassData);
    setShowAddClassModal(false);
    setNewClassData({ title: '', date: '', time: '', type: 'Lecture' });
  };

  const handleCreateGroup = (e) => {
    e.preventDefault();
    console.log('Отправляем новую группу на сервер:', newGroupData);
    setShowCreateGroupModal(false);
    setNewGroupData({ name: '', instructor: '', schedule: '' });
  };

  return (
    <div className="min-vh-100 py-4 page-bg position-relative">
      <div className="container">
        
        {/* Хлебные крошки и Шапка */}
        <nav aria-label="breadcrumb" className="mb-3">
          <ol className="breadcrumb small">
            <li className="breadcrumb-item"><a href="/account" className="text-muted text-decoration-none">{t('manageSession.myCourses') || 'My Courses'}</a></li>
            <li className="breadcrumb-item active fw-bold" aria-current="page">{sessionData.title}</li>
          </ol>
        </nav>

        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
          <div>
            <div className="d-flex align-items-center gap-3 mb-1">
              <h2 className="fw-bold mb-0">{sessionData.title}</h2>
              <span className="badge bg-success shadow-sm">{sessionData.status}</span>
            </div>
            <p className="text-muted mb-0">
              <i className="bi bi-tag-fill me-1"></i> {sessionData.type} &nbsp;•&nbsp; 
              <i className="bi bi-clock-fill me-1 ms-2"></i> {sessionData.duration}
            </p>
          </div>
          <div className="d-flex gap-2">
            <button className="btn btn-outline-secondary fw-bold">
              <i className="bi bi-pencil me-1"></i> {t('manageSession.editCourse') || 'Edit Course'}
            </button>
          </div>
        </div>

        {/* Навигация по вкладкам */}
        <div className="card shadow-sm border-0 mb-4 overflow-hidden">
          <div className="card-header bg-transparent border-bottom-0 pt-3 pb-0 px-4">
            <ul className="nav nav-tabs border-bottom-0 gap-4" style={{ marginBottom: '-1px' }}>
              {['overview', 'schedule', 'groups', 'members', 'settings'].map((tab) => (
                <li className="nav-item" key={tab}>
                  <button 
                    className={`nav-link border-0 text-capitalize pb-3 px-1 ${activeTab === tab ? 'active fw-bold text-primary' : 'text-muted'}`}
                    style={{ 
                      backgroundColor: 'transparent', 
                      borderBottom: activeTab === tab ? '3px solid var(--primary-color)' : '3px solid transparent',
                      borderRadius: 0
                    }}
                    onClick={() => setActiveTab(tab)}
                  >
                    {t(`manageSession.tabs.${tab}`) || tab}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* СОДЕРЖИМОЕ ВКЛАДОК */}
        <div className="tab-content">
          
          {/* Вкладка: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="row g-4">
              <div className="col-lg-8">
                <div className="card shadow-sm border-0 h-100 p-4">
                  <h5 className="fw-bold mb-4">{t('manageSession.progressAnalytics') || 'Course Progress & Analytics'}</h5>
                  <div className="row g-4 text-center mb-4">
                    <div className="col-sm-4">
                      <div className="p-3 bg-light rounded-3">
                        <h3 className="fw-bold text-primary mb-1">{sessionData.enrolled}<span className="text-muted fs-6 fw-normal">/{sessionData.maxCapacity}</span></h3>
                        <span className="text-muted small text-uppercase fw-semibold">{t('manageSession.studentsEnrolled') || 'Students Enrolled'}</span>
                      </div>
                    </div>
                    <div className="col-sm-4">
                      <div className="p-3 bg-light rounded-3">
                        <h3 className="fw-bold text-success mb-1">12</h3>
                        <span className="text-muted small text-uppercase fw-semibold">{t('manageSession.sessionsTotal') || 'Sessions Total'}</span>
                      </div>
                    </div>
                    <div className="col-sm-4">
                      <div className="p-3 bg-light rounded-3">
                        <h3 className="fw-bold text-warning mb-1"><i className="bi bi-star-fill text-warning me-1"></i>4.8</h3>
                        <span className="text-muted small text-uppercase fw-semibold">{t('manageSession.averageRating') || 'Average Rating'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-lg-4">
                <div className="card shadow-sm border-0 h-100 p-4">
                  <h5 className="fw-bold mb-3">{t('manageSession.quickActions') || 'Quick Actions'}</h5>
                  <div className="d-grid gap-2">
                    <button className="btn btn-outline-secondary text-start"><i className="bi bi-envelope me-2"></i> {t('common.messageAllStudents')}</button>
                    <button className="btn btn-outline-secondary text-start"><i className="bi bi-file-earmark-arrow-up me-2"></i> {t('common.uploadMaterials')}</button>
                    <button className="btn btn-outline-secondary text-start"><i className="bi bi-camera-video me-2"></i> {t('common.generateMeetLink')}</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Вкладка: SCHEDULE */}
          {activeTab === 'schedule' && (
            <div className="card shadow-sm border-0 overflow-hidden">
              <div className="card-header bg-transparent d-flex justify-content-between align-items-center p-4 border-bottom">
                <h5 className="fw-bold mb-0">{t('common.upcomingClasses')}</h5>
                <button 
                  className="btn btn-sm btn-primary fw-bold shadow-sm"
                  onClick={() => setShowAddClassModal(true)}
                >
                  <i className="bi bi-plus-lg me-1"></i> {t('common.addClass')}
                </button>
              </div>
              <div className="table-responsive">
                <table className="table table-hover mb-0 align-middle">
                  <thead className="table-light text-muted small text-uppercase">
                    <tr>
                      <th className="py-3 px-4">{t('common.topic')}</th>
                      <th className="py-3">{t('common.dateTime')}</th>
                      <th className="py-3">{t('common.typeColumn')}</th>
                      <th className="py-3 text-center">{t('common.status')}</th>
                      <th className="py-3 px-4 text-end">{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="border-top-0">
                    {scheduleData.map(lesson => (
                      <tr key={lesson.id}>
                        <td className="py-3 px-4 fw-medium">{lesson.title}</td>
                        <td className="py-3 text-muted small">{lesson.date} • {lesson.time}</td>
                        <td className="py-3"><span className="badge bg-secondary">{lesson.type}</span></td>
                        <td className="py-3 text-center">
                          <span className={`badge ${lesson.status === 'Completed' ? 'bg-success' : 'bg-primary'}`}>{lesson.status}</span>
                        </td>
                        <td className="py-3 px-4 text-end">
                          <button className="btn btn-sm btn-primary fw-bold me-2" onClick={() => window.open(`/live/${lesson.id}`, '_blank')}>
                            <i className="bi bi-play-circle me-1"></i> {t('common.start') || 'Start'}
                          </button>
                          <button className="btn btn-sm btn-light rounded-circle me-1"><i className="bi bi-pencil"></i></button>
                          <button className="btn btn-sm btn-light rounded-circle text-danger"><i className="bi bi-trash"></i></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Вкладка: GROUPS */}
          {activeTab === 'groups' && (
            <div className="card shadow-sm border-0 overflow-hidden">
              <div className="card-header bg-transparent d-flex justify-content-between align-items-center p-4 border-bottom">
                <h5 className="fw-bold mb-0">{t('manageSession.studyGroups') || 'Study Groups'}</h5>
                <button 
                  className="btn btn-sm btn-primary fw-bold shadow-sm"
                  onClick={() => setShowCreateGroupModal(true)}
                >
                  <i className="bi bi-plus-lg me-1"></i> {t('manageSession.createGroup') || 'Create Group'}
                </button>
              </div>
              <div className="table-responsive">
                <table className="table table-hover mb-0 align-middle">
                  <thead className="table-light text-muted small text-uppercase">
                    <tr>
                      <th className="py-3 px-4">{t('manageSession.groupName') || 'Group Name'}</th>
                      <th className="py-3">{t('manageSession.instructor') || 'Instructor'}</th>
                      <th className="py-3">{t('manageSession.students') || 'Students'}</th>
                      <th className="py-3">{t('common.schedule') || 'Schedule'}</th>
                      <th className="py-3 px-4 text-end">{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="border-top-0">
                    {groupsData.map(group => (
                      <tr key={group.id}>
                        <td className="py-3 px-4 fw-medium text-primary">{group.name}</td>
                        <td className="py-3"><i className="bi bi-person-badge me-2 text-muted"></i>{group.instructor}</td>
                        <td className="py-3">{group.students} / 30</td>
                        <td className="py-3 text-muted small">{group.schedule}</td>
                        <td className="py-3 px-4 text-end">
                          <button className="btn btn-sm btn-light rounded-circle"><i className="bi bi-gear"></i></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Вкладка: MEMBERS */}
          {activeTab === 'members' && (
            <div className="card shadow-sm border-0 overflow-hidden">
              <div className="card-header bg-transparent d-flex justify-content-between align-items-center p-4 border-bottom">
                <h5 className="fw-bold mb-0">{t('manageSession.enrolledMembers') || 'Enrolled Members'}</h5>
                <button className="btn btn-sm btn-outline-primary fw-bold"><i className="bi bi-person-plus me-1"></i> {t('manageSession.inviteUser') || 'Invite User'}</button>
              </div>
              <div className="table-responsive">
                <table className="table table-hover mb-0 align-middle">
                  <thead className="table-light text-muted small text-uppercase">
                    <tr>
                      <th className="py-3 px-4">{t('common.name') || 'Name'}</th>
                      <th className="py-3">{t('common.role') || 'Role'}</th>
                      <th className="py-3">{t('manageSession.progress') || 'Progress'}</th>
                      <th className="py-3">{t('manageSession.joined') || 'Joined'}</th>
                      <th className="py-3 px-4 text-end">{t('common.manage') || 'Manage'}</th>
                    </tr>
                  </thead>
                  <tbody className="border-top-0">
                    {membersData.map(member => (
                      <tr key={member.id}>
                        <td className="py-3 px-4">
                          <div className="fw-bold">{member.name}</div>
                          <div className="small text-muted">{member.email}</div>
                        </td>
                        <td className="py-3">
                          <span className={`badge ${member.role === 'Instructor' ? 'bg-danger' : 'bg-info text-dark'}`}>{member.role}</span>
                        </td>
                        <td className="py-3 fw-medium">{member.progress}</td>
                        <td className="py-3 text-muted small">{member.joined}</td>
                        <td className="py-3 px-4 text-end">
                          <button className="btn btn-sm btn-light text-danger"><i className="bi bi-x-circle me-1"></i> {t('common.remove')}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Вкладка: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="card shadow-sm border-0 p-4 p-md-5">
              <h4 className="fw-bold mb-4">{t('manageSession.courseSettings') || 'Course Settings'}</h4>
              <form>
                <div className="row g-4 mb-4">
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">{t('manageSession.courseTitle') || 'Course Title'}</label>
                    <input type="text" className="form-control" defaultValue={sessionData.title} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">{t('manageSession.maxCapacity') || 'Max Capacity'}</label>
                    <input type="number" className="form-control" defaultValue={sessionData.maxCapacity} />
                  </div>
                </div>
                <div className="mb-4">
                  <label className="form-label fw-semibold">{t('manageSession.sessionStatus') || 'Session Status'}</label>
                  <select className="form-select" defaultValue="active">
                    <option value="active">{t('manageSession.statusActive') || 'Active (Visible to students)'}</option>
                    <option value="draft">{t('manageSession.statusDraft') || 'Draft (Hidden)'}</option>
                    <option value="archived">{t('manageSession.statusArchived') || 'Archived'}</option>
                  </select>
                </div>
                <div className="d-flex justify-content-end gap-2">
                  <button type="button" className="btn btn-outline-danger">{t('manageSession.deleteSession') || 'Delete Session'}</button>
                  <button type="button" className="btn btn-primary">{t('common.saveChanges') || 'Save Changes'}</button>
                </div>
              </form>
            </div>
          )}

        </div>
      </div>

      {/* ==========================================
          МОДАЛЬНОЕ ОКНО: ДОБАВИТЬ УРОК (SCHEDULE)
          ========================================== */}
      {showAddClassModal && (
        <>
          <div className="modal show d-block" tabIndex="-1" style={{ zIndex: 1055 }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content border-0 shadow-lg rounded-4">
                <div className="modal-header border-bottom-0 pb-0">
                  <h5 className="modal-title fw-bold">{t('manageSession.scheduleNewClass') || 'Schedule New Class'}</h5>
                  <button type="button" className="btn-close" onClick={() => setShowAddClassModal(false)}></button>
                </div>
                <div className="modal-body">
                  <form onSubmit={handleAddClass}>
                    <div className="mb-3">
                      <label className="form-label fw-semibold small text-muted text-uppercase">{t('manageSession.topicTitle') || 'Topic / Title'}</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder={t('manageSession.placeholderTopic') || 'e.g. Introduction to Express.js'}
                        required
                        value={newClassData.title}
                        onChange={(e) => setNewClassData({...newClassData, title: e.target.value})}
                      />
                    </div>
                    <div className="row g-3 mb-3">
                      <div className="col-md-6">
                        <label className="form-label fw-semibold small text-muted text-uppercase">{t('common.date') || 'Date'}</label>
                        <input 
                          type="date" 
                          className="form-control" 
                          required
                          value={newClassData.date}
                          onChange={(e) => setNewClassData({...newClassData, date: e.target.value})}
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold small text-muted text-uppercase">{t('common.time') || 'Time'}</label>
                        <input 
                          type="time" 
                          className="form-control" 
                          required
                          value={newClassData.time}
                          onChange={(e) => setNewClassData({...newClassData, time: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="mb-4">
                      <label className="form-label fw-semibold small text-muted text-uppercase">{t('manageSession.classType') || 'Class Type'}</label>
                      <select 
                        className="form-select"
                        value={newClassData.type}
                        onChange={(e) => setNewClassData({...newClassData, type: e.target.value})}
                      >
                        <option value="Lecture">{t('manageSession.typeLecture') || 'Lecture'}</option>
                        <option value="Practice">{t('manageSession.typePractice') || 'Practice / Seminar'}</option>
                        <option value="Q&A">{t('manageSession.typeQA') || 'Q&A Session'}</option>
                        <option value="Exam">{t('manageSession.typeExam') || 'Exam / Quiz'}</option>
                      </select>
                    </div>
                    <div className="d-grid gap-2">
                      <button type="submit" className="btn btn-primary fw-bold py-2">{t('manageSession.addToSchedule') || 'Add to Schedule'}</button>
                      <button type="button" className="btn btn-light" onClick={() => setShowAddClassModal(false)}>{t('common.cancel') || 'Cancel'}</button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop show" style={{ zIndex: 1050 }}></div>
        </>
      )}

      {/* ==========================================
          МОДАЛЬНОЕ ОКНО: СОЗДАТЬ ГРУППУ (GROUPS)
          ========================================== */}
      {showCreateGroupModal && (
        <>
          <div className="modal show d-block" tabIndex="-1" style={{ zIndex: 1055 }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content border-0 shadow-lg rounded-4">
                <div className="modal-header border-bottom-0 pb-0">
                  <h5 className="modal-title fw-bold">{t('manageSession.createStudyGroup') || 'Create Study Group'}</h5>
                  <button type="button" className="btn-close" onClick={() => setShowCreateGroupModal(false)}></button>
                </div>
                <div className="modal-body">
                  <form onSubmit={handleCreateGroup}>
                    <div className="mb-3">
                      <label className="form-label fw-semibold small text-muted text-uppercase">{t('manageSession.groupName') || 'Group Name'}</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder={t('manageSession.placeholderGroupName') || 'e.g. Group C - Morning'}
                        required
                        value={newGroupData.name}
                        onChange={(e) => setNewGroupData({...newGroupData, name: e.target.value})}
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-semibold small text-muted text-uppercase">{t('manageSession.assignInstructor') || 'Assign Instructor'}</label>
                      <select 
                        className="form-select"
                        required
                        value={newGroupData.instructor}
                        onChange={(e) => setNewGroupData({...newGroupData, instructor: e.target.value})}
                      >
                        <option value="" disabled>{t('manageSession.selectInstructor') || 'Select an instructor...'}</option>
                        <option value="Никита">Никита (You)</option>
                        <option value="Misha">Misha</option>
                      </select>
                    </div>
                    <div className="mb-4">
                      <label className="form-label fw-semibold small text-muted text-uppercase">{t('manageSession.standardSchedule') || 'Standard Schedule'}</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder={t('manageSession.placeholderSchedule') || 'e.g. Tue, Thu 14:00'}
                        value={newGroupData.schedule}
                        onChange={(e) => setNewGroupData({...newGroupData, schedule: e.target.value})}
                      />
                    </div>
                    <div className="d-grid gap-2">
                      <button type="submit" className="btn btn-primary fw-bold py-2">{t('manageSession.createGroup') || 'Create Group'}</button>
                      <button type="button" className="btn btn-light" onClick={() => setShowCreateGroupModal(false)}>{t('common.cancel') || 'Cancel'}</button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop show" style={{ zIndex: 1050 }}></div>
        </>
      )}

    </div>
  );
}

export default ManageSessionPage;