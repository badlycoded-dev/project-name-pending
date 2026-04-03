/**
 * Link Filtering Utility - Role-based access control for user/course links
 * 
 * This utility provides functions to filter links based on user role/access level
 * Ensures default users see only public information, while admins/managers see everything
 */

/**
 * Access level hierarchy (higher = more access)
 * default < create < manage < admin < root
 */
const ACCESS_LEVELS = {
    default: 0,
    create: 1,
    manage: 2,
    admin: 3,
    root: 4
};

/**
 * Check if user has access to a link based on access level
 * @param {string} userAccessLevel - User's access level (role.accessLevel)
 * @param {string} linkAccessLevel - Required access level for the link
 * @returns {boolean} true if user has access
 */
module.exports.hasLinkAccess = (userAccessLevel, linkAccessLevel) => {
    if (!userAccessLevel) userAccessLevel = 'default';
    if (!linkAccessLevel) linkAccessLevel = 'default';
    
    const userLevel = ACCESS_LEVELS[userAccessLevel] || 0;
    const linkLevel = ACCESS_LEVELS[linkAccessLevel] || 0;
    
    return userLevel >= linkLevel;
};

/**
 * Filter links array based on user access level
 * @param {Array} links - Array of link objects
 * @param {string} userAccessLevel - User's access level
 * @returns {Array} Filtered links that user has access to
 */
module.exports.filterLinksByAccess = (links, userAccessLevel) => {
    if (!links || !Array.isArray(links)) {
        return [];
    }
    
    if (!userAccessLevel) userAccessLevel = 'default';
    
    return links.filter(link => {
        return module.exports.hasLinkAccess(userAccessLevel, link.accessLevel);
    });
};

/**
 * Filter user data to remove sensitive links not accessible to requester
 * @param {Object} user - User document from database
 * @param {string} requesterAccessLevel - Requester's access level
 * @returns {Object} User object with filtered links
 */
module.exports.filterUserData = (user, requesterAccessLevel) => {
    if (!user) return null;
    
    // Convert to plain object if it's a Mongoose document
    const userData = user.toObject ? user.toObject() : user;
    
    // Filter links based on access level
    if (userData.links) {
        userData.links = module.exports.filterLinksByAccess(userData.links, requesterAccessLevel);
    }
    
    return userData;
};

/**
 * Filter array of users
 * @param {Array} users - Array of user documents
 * @param {string} requesterAccessLevel - Requester's access level
 * @returns {Array} Array of users with filtered links
 */
module.exports.filterUsersData = (users, requesterAccessLevel) => {
    if (!users || !Array.isArray(users)) {
        return [];
    }
    
    return users.map(user => module.exports.filterUserData(user, requesterAccessLevel));
};

/**
 * Filter course data to remove sensitive links not accessible to requester
 * @param {Object} course - Course document from database
 * @param {string} requesterAccessLevel - Requester's access level
 * @returns {Object} Course object with filtered links
 */
module.exports.filterCourseData = (course, requesterAccessLevel) => {
    if (!course) return null;
    
    // Convert to plain object if it's a Mongoose document
    const courseData = course.toObject ? course.toObject() : course;
    
    // Filter links based on access level
    if (courseData.links) {
        courseData.links = module.exports.filterLinksByAccess(courseData.links, requesterAccessLevel);
    }
    
    return courseData;
};

/**
 * Filter array of courses
 * @param {Array} courses - Array of course documents
 * @param {string} requesterAccessLevel - Requester's access level
 * @returns {Array} Array of courses with filtered links
 */
module.exports.filterCoursesData = (courses, requesterAccessLevel) => {
    if (!courses || !Array.isArray(courses)) {
        return [];
    }
    
    return courses.map(course => module.exports.filterCourseData(course, requesterAccessLevel));
};

/**
 * Get user's access level from their role
 * @param {Object} user - User document with populated role
 * @returns {string} User's access level
 */
module.exports.getUserAccessLevel = (user) => {
    if (!user) return 'default';
    
    // If role is populated
    if (user.role && user.role.accessLevel) {
        return user.role.accessLevel;
    }
    
    // If role is just an ID, default to 'default' (should fetch role separately)
    return 'default';
};

/**
 * Export access levels for reference
 */
module.exports.ACCESS_LEVELS = ACCESS_LEVELS;
