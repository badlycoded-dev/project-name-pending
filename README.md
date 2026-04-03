# 🎓 Course Platform - Full Stack Application

A complete online learning platform with video conferencing, course management, and real-time communication.

## ✨ Features

- **📚 Courses** - Browse and enroll in courses
- **🎥 Video Conferencing** - Real-time meetings with WebRTC
- **🔐 Authentication** - Secure JWT-based auth
- **👨‍🏫 Course Management** - Create and manage courses (instructors)
- **📱 Responsive Design** - Works on mobile and desktop
- **🌍 Multi-language** - i18n support
- **🔄 Auto SSL Renewal** - Let's Encrypt with automatic renewal

## 🛠 Tech Stack

| Layer | Technologies |
|-------|--------------|
| **Frontend** | React, React Router, i18n, WebRTC |
| **Backend** | Node.js, Express, JWT, Passport |
| **Database** | MongoDB Atlas (cloud) |
| **Real-time** | Socket.io, WebRTC |
| **Deployment** | Docker, Docker Compose, Nginx |
| **SSL** | Let's Encrypt (auto-renewal) |

## 📋 Prerequisites

- **Docker** & **Docker Compose** installed
- **MongoDB Atlas** account (free tier available at mongodb.com)
- **Git** for version control
- **4GB RAM** minimum (8GB recommended)
- **Domain name** (optional for local testing)

## 🚀 Quick Start

### Option 1: Local Testing (Fastest - 5 minutes)

Perfect for testing before deployment:

```bash
# 1. Clone repository
git clone <your-repo-url>
cd project-name-pending

# 2. Create local config from template
cd server
cp .env.example .env.local

# 3. Update MongoDB credentials
nano .env.local
# Edit: MONGO_URI=mongodb+srv://your-username:your-password@...

# 4. Start all services
docker-compose -f docker-compose.local.yml up -d --build

# 5. Wait for startup (~30 seconds)
sleep 30

# 6. Check services
docker-compose -f docker-compose.local.yml ps
```

**Access your app:**
- Frontend: http://localhost:4000
- API: http://localhost:4040/api
- API Health: http://localhost:4040/api/health

For full testing guide: [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md)

### Option 2: Production Deployment (15 minutes)

Deploy to your own server:

```bash
# 1. Clone repository
git clone <your-repo-url>
cd project-name-pending/server

# 2. Get a domain (free: duckdns.org, noip.com)
# Point domain DNS to your server IP

# 3. Create production config
cp .env.example .env

# 4. Edit configuration
nano .env
# SERVER_HOST=your-domain.com
# USE_HTTPS=true
# MONGO_URI=mongodb+srv://user:pass@...

# 5. Generate SSL certificate (one-time)
docker-compose down
bash init-ssl-cert.sh your-domain.com admin@your-domain.com

# 6. Start services
docker-compose up -d --build

# 7. Access your app
# Frontend: https://your-domain.com:4004
# API: https://your-domain.com:4043/api
```

For detailed guide: [server/SSL_SETUP.md](server/SSL_SETUP.md)

---

## 📚 Documentation

### Getting Started
- **[Local Development](LOCAL_DEVELOPMENT.md)** - Full local testing walkthrough
- **[Docker Setup](server/DOCKER_SETUP.md)** - Architecture and configuration

### HTTPS & SSL Certificates
- **[SSL Setup Guide](server/SSL_SETUP.md)** - Complete Let's Encrypt setup
- **[SSL Troubleshooting](server/SSL_TROUBLESHOOTING.md)** - Fix certificate issues
- **[SSL Quick Ref](server/SSL_QUICK_REFERENCE.txt)** - One-page cheat sheet

### API Reference
- **[API Contract](server/console/API_CONTRACT.json)** - Full endpoint documentation
- **[RTC Guide](server/rtc/README.md)** - WebRTC/video setup

---

## 📁 Project Structure

```
.
├── client/                        # React frontend (port 4000)
│   ├── src/
│   │   ├── pages/                # Home, Login, Courses, etc.
│   │   ├── components/           # Reusable UI components
│   │   ├── api/                  # API service layer
│   │   └── utils/                # Auth, helpers
│   └── package.json
│
├── server/                        # Node.js backend
│   ├── console/                   # REST API (port 4040)
│   │   ├── index.js
│   │   ├── config/               # Configuration
│   │   ├── controllers/          # Request handlers
│   │   ├── routes/               # API routes
│   │   ├── models/               # Data models
│   │   └── Dockerfile
│   │
│   ├── rtc/                       # WebRTC server (port 5050)
│   │   ├── index.js
│   │   ├── handlers.js           # Socket handlers
│   │   ├── rooms.js              # Room management
│   │   └── Dockerfile
│   │
│   ├── web/                       # Static frontend server
│   │   └── Dockerfile
│   │
│   ├── docker-compose.yml         # Production setup
│   ├── docker-compose.local.yml   # Local dev setup
│   ├── .env.example               # Config template
│   ├── .env.local                 # Local config (not in git)
│   ├── init-ssl-cert.sh           # Setup SSL
│   └── renew-ssl-cert.sh          # Renewal script
│
└── README.md                       # This file
```

---

## ⚙️ Configuration

### Environment Variables

Copy `server/.env.example` to `server/.env` and configure:

```bash
# Server hostname (domain or IP)
SERVER_HOST=your-domain.com

# Enable HTTPS (true for production, false for local)
USE_HTTPS=true

# Database connection (MongoDB Atlas)
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/dbname

# JWT session secret (change this!)
JWT_SECRET=your-very-secret-key-here
JWT_EXPIRES_IN=14400  # 4 hours

# Frontend URLs (auto-computed, match SERVER_HOST)
REACT_APP_API_URL=https://your-domain.com:4043/api
REACT_APP_RTC_URL=https://your-domain.com:5051
```

For **local development**, use `server/.env.local` with `docker-compose.local.yml`.

---

## 🐳 Docker Commands

### Start Services
```bash
# Local testing (uses docker-compose.local.yml)
cd server && docker-compose -f docker-compose.local.yml up -d --build

# Production (uses docker-compose.yml)
cd server && docker-compose up -d --build
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f app       # REST API
docker-compose logs -f web       # Frontend
docker-compose logs -f rtc       # WebRTC
docker-compose logs -f certbot   # SSL renewal
```

### Stop Services
```bash
docker-compose down           # Keep volumes
docker-compose down -v        # Remove everything
```

### Health Checks
```bash
# Check running services
docker-compose ps

# Test API
curl http://localhost:4040/api/health

# Test RTC
curl http://localhost:5050/health
```

---

## 🔐 SSL/HTTPS Management

### Initial Setup (Production)
```bash
# One-time certificate generation
bash server/init-ssl-cert.sh your-domain.com admin@your-domain.com
```

### Automatic Renewal
Your certificate automatically renews:
- ✅ **Daily check** - Certbot monitors expiration
- ✅ **Auto-renewal** - At 60 days (30 before expiration)
- ✅ **Zero downtime** - Seamless renewal
- ✅ **No action needed** - Fully automatic

### Manual Renewal (if needed)
```bash
bash server/renew-ssl-cert.sh
```

See [server/SSL_SETUP.md](server/SSL_SETUP.md) for complete guide.

---

## 🧪 Testing

### Verify Local Setup

```bash
# 1. Start services
docker-compose -f docker-compose.local.yml up -d --build

# 2. Wait for startup
sleep 30

# 3. Check health
curl http://localhost:4040/api/health
curl http://localhost:5050/health

# 4. Open frontend
# Visit: http://localhost:4000

# 5. Check browser console (F12)
# Should see NO CORS errors
# API calls should be to http://localhost:4040/api/*
```

**For detailed testing**: See [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md)

---

## 🐛 Troubleshooting

### Port Already in Use
```bash
docker-compose down
# Or kill specific port:
# Mac/Linux: lsof -ti:4000 | xargs kill -9
# Windows: netstat -ano | findstr :4000
```

### CORS Errors
- ✅ Ensure using correct `.env` file
- ✅ Check `REACT_APP_API_URL` matches running port
- ✅ Restart web service: `docker-compose restart web`

### MongoDB Connection Failed
- ✅ Check `MONGO_URI` is correct in `.env`
- ✅ Verify credentials are valid
- ✅ Ensure IP whitelist allows your server

### Certificate Errors
See [server/SSL_TROUBLESHOOTING.md](server/SSL_TROUBLESHOOTING.md)

### View Detailed Logs
```bash
docker-compose logs app | tail -50
docker-compose logs web | tail -50
docker-compose logs rtc | tail -50
```

---

## 📊 System Architecture

```
┌────────────────────────────────────────────────────────┐
│             Docker Compose Network                     │
├─────────────────┬──────────────────┬──────────────────┤
│ Frontend        │ REST API         │ WebRTC Signaling │
│ (:4000)         │ (:4040)          │ (:5050)          │
│                 │                  │                  │
│ React App ←────→ Express Server ←─→ Socket.IO        │
└─────────────────┴────────┬─────────┴──────────────────┘
                         ↓
              MongoDB Atlas (Cloud)
```

---

## 🚀 Deployment

### Deploy to VPS (DigitalOcean, Linode, AWS, etc.)

```bash
# 1. SSH to server
ssh root@your-server-ip

# 2. Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 3. Clone and deploy
git clone <your-repo>
cd project-name-pending/server

# 4. Get domain & point DNS to server IP
# (Update at your registrar)

# 5. Create config
cp .env.example .env
nano .env  # Edit SERVER_HOST and MONGO_URI

# 6. Generate certificate
docker-compose down
bash init-ssl-cert.sh your-domain.com admin@your-domain.com

# 7. Start
docker-compose up -d --build
```

**Your app is now live!** 🎉

Access via:
- **Frontend**: https://your-domain.com:4004
- **API**: https://your-domain.com:4043/api

---

## 📝 API Endpoints

Quick reference (see [API_CONTRACT.json](server/console/API_CONTRACT.json) for full docs):

```
Authentication
  POST   /api/auth/login              Login
  POST   /api/auth/register          Register
  POST   /api/auth/logout            Logout

Courses  
  GET    /api/courses                List all
  POST   /api/courses                Create (instructor)
  GET    /api/courses/:id            Get course
  PUT    /api/courses/:id            Update (instructor)
  DELETE /api/courses/:id            Delete (instructor)

Users
  GET    /api/users/:id              Get profile
  PUT    /api/users/:id              Update profile

Enrollments
  POST   /api/enrollments            Enroll in course
  GET    /api/enrollments            My courses
  DELETE /api/enrollments/:courseId  Unenroll
```

---

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file

---

## 📞 Support & Docs

**Getting started?**
→ Start with [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md)

**Deploying to production?**
→ Follow [server/SSL_SETUP.md](server/SSL_SETUP.md)

**Having issues?**
→ Check [server/SSL_TROUBLESHOOTING.md](server/SSL_TROUBLESHOOTING.md) or [server/DOCKER_SETUP.md](server/DOCKER_SETUP.md)

**API questions?**
→ See [server/console/API_CONTRACT.json](server/console/API_CONTRACT.json)

---

## 🎯 Roadmap

- [ ] Mobile app (React Native)
- [ ] Live chat during sessions
- [ ] Assignment submission
- [ ] Progress tracking
- [ ] Certificates/badges
- [ ] Payment integration
- [ ] Advanced analytics

---

## 🙏 Acknowledgments

- React team for amazing frontend framework
- Node.js team for solid backend platform
- MongoDB for flexible database
- Let's Encrypt for free SSL certificates
- Docker for containerization

---

**Built with ❤️ for learning**

Happy coding! 🚀