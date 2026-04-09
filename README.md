# 🎓 Course Platform - Full Stack Application

A complete online learning platform with video conferencing, course management, and real-time communication.

## ✨ Features

- **📚 Courses** - Browse and enroll in courses
- **🎥 Video Conferencing** - Real-time meetings with WebRTC
- **🔐 Authentication** - Secure JWT-based auth
- **👨‍🏫 Course Management** - Create and manage courses (instructors)
- **📱 Responsive Design** - Works on mobile and desktop
- **🌍 Multi-language** - i18n support

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
cp .env .env.local
cp docker-compose.yml docker-compose.local.yml

# 3. Update environment file
nano .env.local
# Edit: MONGO_URI=mongodb+srv://your-username:your-password@...
# Edit: SERVER_HOST=***.***.***.***

# 4. Start all services
docker-compose -f docker-compose.local.yml up -d --build

# 5. Wait for startup (~30 seconds)

# 6. Check services
docker-compose -f docker-compose.local.yml ps
```

**Access your app:**
- Frontend: http://SERVER_HOST:3000
- Frontend(possibly protected): https://SERVER_HOST:3003
- Panel: http://SERVER_HOST:4000
- Panel(possibly protected): https://SERVER_HOST:4004
- API Health: http://SERVER_HOST:4040/api/health
- API Health(possibly protected): http://SERVER_HOST:4043/api/health

---

## ⚙️ Configuration

### Environment Variables

Copy `/.env` to `/.env.local` and configure:

```bash
# ── Your server's IP or domain ────────────────────────────────────────────────
# VPN testing:    SERVER_HOST=***.***.***.***   (your Radmin/Hamachi VPN IP)
# LAN testing:    SERVER_HOST=192.168.***.***   (your local network IP)
# Production:     SERVER_HOST=your-domain.com
SERVER_HOST=<ip-of-whole-system>

# ── HTTPS ─────────────────────────────────────────────────────────────────────
# false = HTTP  (use for local/VPN testing)
# true  = HTTPS (requires a real domain + valid certs)
USE_HTTPS=true

# ── Database (MongoDB) ────────────────────────────────────────────────────────
DB_NAME=<db-name>
DB_URL=<address-or-connection-string-to-database>
MONGODB_URI=<address-or-connection-string-to-database>
MONGO_URI=<address-or-connection-string-to-database>

# ── JWT & Security ────────────────────────────────────────────────────────────
# NOTE: values with special characters ($, #, !, etc.) must be quoted
JWT_SECRET=<your-jwt-secret>
SECRET=<your-secret>

# ── TURN server credentials ───────────────────────────────────────────────────
TURN_USERNAME=<username>
TURN_CREDENTIAL=<pass-or-cridentials>

# ── EmailJS ───────────────────────────────────────────────────────────────────
REACT_APP_EMAILJS_PUBLIC_KEY=<key>

# ── Node ──────────────────────────────────────────────────────────────────────
NODE_ENV=development
NODE_TLS_REJECT_UNAUTHORIZED=0
```

---

## 🐳 Docker Commands

### Start Services
```bash
# Local testing (uses docker-compose.local.yml(basically same as production))
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
# Test API
curl https://localhost:4043/api/health

# Test RTC
curl http://localhost:5050/health
# Test RTC
curl https://localhost:5051/health
```

---

## 🐛 Troubleshooting

### CORS Errors
- ✅ Ensure using correct `.env(.env.local)` file
- ✅ Check `REACT_APP_API_URL` matches running port
- ✅ Restart web service: `docker-compose restart web`

### MongoDB Connection Failed
- ✅ Check `MONGO_URI` is correct in `.env(.env.local)`
- ✅ Verify credentials are valid
- ✅ Ensure IP whitelist allows your server

### View Detailed Logs
```bash
docker-compose logs app | tail -50
docker-compose logs web | tail -50
docker-compose logs rtc | tail -50
```

---

---

<div align="center">

`Made as test of skills at request for ITSTEP`

</div>

**Built with ❤️ for learning**

Happy coding! 🚀
