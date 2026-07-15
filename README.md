# BloodOS Server

Backend API for BloodOS - Blood Donor Coordination Platform

## Environment Variables

Required:
- `MONGODB_URI` - MongoDB connection string
- `FRONTEND_URL` - Frontend URL for CORS (e.g., `https://your-app.vercel.app`)
- `IMGBB_API_KEY` - IMGBB API key for avatar uploads

Optional:
- `PORT` - Server port (default: 5000)
- `NODE_ENV` - `development` | `production` | `test`
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB` - Redis cache (optional)

## Local Development

```bash
npm install
npm run dev
```

## Production Build

```bash
npm run build
npm start
```

## Deployment Options

### Railway.app (Recommended)

1. Push code to GitHub
2. Go to [railway.app](https://railway.app)
3. New Project → Deploy from GitHub repo
4. Add environment variables in Settings
5. Railway auto-detects Node.js and deploys

### Render.com

1. Push code to GitHub
2. Go to [render.com](https://render.com)
3. New Web Service → Connect repo
4. Build command: `npm install && npm run build`
5. Start command: `node dist/server.js`
6. Add environment variables

### Fly.io

```bash
fly launch
fly secrets set MONGODB_URI=... FRONTEND_URL=... IMGBB_API_KEY=...
fly deploy
```

### Docker

```bash
docker build -t bloodos-server .
docker run -p 5000:5000 \
  -e MONGODB_URI=... \
  -e FRONTEND_URL=... \
  -e IMGBB_API_KEY=... \
  bloodos-server
```

## API Endpoints

- `GET /health` - Health check
- `/api/requests` - Blood request management
- `/api/donors` - Donor management
- `/api/users` - User management
- `/api/donations` - Donation tracking
- `/api/notifications` - Notifications
- `/api/admin` - Admin operations
- `/api/contact` - Contact form
- `/api/stats` - Statistics
