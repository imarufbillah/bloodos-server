# BloodOS Server 🩸

<div align="center">

**RESTful API backend for blood donation coordination in Bangladesh**

[Live API](https://bloodos-server.onrender.com) • [Client Repo](https://github.com/imarufbillah/bloodos-client) • [Report Bug](https://github.com/imarufbillah/bloodos-server/issues)

[![Node.js](https://img.shields.io/badge/Node.js-20.x-green?style=flat&logo=node.js)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.2.1-black?style=flat&logo=express)](https://expressjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.2-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Native-green?style=flat&logo=mongodb)](https://www.mongodb.com/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

</div>

---

## 📖 Project Overview

BloodOS Server is a robust, type-safe RESTful API backend built with Express.js 5 and TypeScript for managing blood donation coordination in Bangladesh. It provides comprehensive endpoints for blood request management, donor discovery, user authentication, notifications, and administrative functions.

The server features a sophisticated state machine for request lifecycle management, eligibility checking for donors, JWT-based authentication via Better Auth, MongoDB for data persistence, and optional Redis caching for improved performance. Built with strict TypeScript configuration and comprehensive validation using Zod schemas.

---

## 🚀 Key Features

### 🔐 **Authentication & Authorization**

- JWT-based authentication with Better Auth
- Session validation with frontend integration
- Role-based access control (User, Admin)
- Secure password hashing
- Token refresh mechanism
- Middleware-based route protection

### 🩸 **Blood Request Management**

- Create, read, update, and delete blood requests
- State machine for request lifecycle (Pending → Fulfilled/Cancelled/Expired)
- Automatic expiration based on needed-by date
- Urgency levels (Critical, Urgent, Moderate)
- Request filtering by blood group, district, urgency, status
- Pagination support
- Request ownership validation

### 👥 **Donor Management**

- Donor registration and profile management
- Eligibility calculation based on last donation (90-day rule)
- Donor filtering by blood group and district
- Availability status tracking
- Phone number masking for privacy (01XXX***XXX)
- Donation history tracking

### 📊 **Statistics & Analytics**

- Total requests by status
- Total donors count
- Fulfilled requests count
- Active requests tracking
- Admin dashboard metrics

### 🔔 **Notification System**

- Email notifications for new requests (configurable)
- Real-time notification creation
- Notification read/unread status
- Bulk notification sending to matching donors

### 🛡️ **Admin Features**

- User management (list, suspend, ban, promote)
- Platform-wide statistics
- Content moderation
- Role assignment
- User activity monitoring

### 📸 **File Upload**

- Avatar upload via IMGBB API
- Image validation and size limits
- Secure file handling with Multer

### 🗄️ **Database**

- MongoDB native driver (no Mongoose)
- Optimized indexes for performance
- Compound indexes for complex queries
- Idempotent seed script for demo data
- Aggregation pipelines for statistics

### ⚡ **Performance & Caching**

- Optional Redis caching layer
- Graceful degradation without Redis
- Connection pooling
- Query optimization
- Efficient data structures

---

## 🛠️ Technologies Used

### **Core Framework**

- **[Node.js 20.x](https://nodejs.org/)** - JavaScript runtime
- **[Express.js 5.2.1](https://expressjs.com/)** - Web framework
- **[TypeScript 5.7.2](https://www.typescriptlang.org/)** - Type safety with ESM

### **Database & Caching**

- **[MongoDB](https://www.mongodb.com/)** - NoSQL database (native driver)
- **[Redis](https://redis.io/)** - Optional caching layer (ioredis)

### **Authentication & Security**

- **[Better Auth](https://www.better-auth.com/)** - Modern authentication
- **[jose](https://github.com/panva/jose)** - JWT operations
- **[bcrypt](https://github.com/kelektiv/node.bcrypt.js)** - Password hashing
- **[helmet](https://helmetjs.github.io/)** - Security headers
- **[cors](https://github.com/expressjs/cors)** - CORS handling

### **Validation & Schemas**

- **[Zod](https://zod.dev/)** - TypeScript-first schema validation
- Custom validation middleware

### **File Upload**

- **[Multer](https://github.com/expressjs/multer)** - Multipart/form-data handling
- **[Axios](https://axios-http.com/)** - HTTP client for IMGBB API

### **Development & Testing**

- **[Vitest](https://vitest.dev/)** - Unit testing framework
- **[Nodemon](https://nodemon.io/)** - Development auto-reload
- **[ts-node](https://typestrong.org/ts-node/)** - TypeScript execution
- **[ESLint](https://eslint.org/)** - Code linting
- **[Prettier](https://prettier.io/)** - Code formatting

### **Utilities**

- **[dotenv](https://github.com/motdotla/dotenv)** - Environment configuration
- **[date-fns](https://date-fns.org/)** - Date manipulation

---

## 📦 Dependencies

### **Production Dependencies**

```json
{
  "express": "^5.2.1",
  "typescript": "~5.7.2",
  "mongodb": "^6.12.0",
  "ioredis": "^5.4.2",
  "better-auth": "^1.4.3",
  "jose": "^5.9.6",
  "bcrypt": "^5.1.1",
  "zod": "^3.24.2",
  "helmet": "^8.0.0",
  "cors": "^2.8.5",
  "multer": "^1.4.5-lts.1",
  "axios": "^1.7.9",
  "dotenv": "^16.4.7",
  "date-fns": "^4.1.0"
}
```

### **Development Dependencies**

```json
{
  "@types/node": "^22.10.2",
  "@types/express": "^5.0.0",
  "@types/bcrypt": "^5.0.2",
  "@types/cors": "^2.8.17",
  "@types/multer": "^1.4.12",
  "vitest": "^2.1.8",
  "nodemon": "^3.1.9",
  "ts-node": "^10.9.2",
  "eslint": "^9.17.0",
  "prettier": "^3.4.2"
}
```

---

## 🚦 Getting Started

### **Prerequisites**

Ensure you have the following installed:

- **Node.js** 18.17 or later
- **npm** 9.x or later (or **yarn** / **pnpm**)
- **MongoDB** 6.0 or later (local or Atlas)
- **Redis** (optional, for caching)
- **Git**

### **Installation**

1. **Clone the repository**

   ```bash
   git clone https://github.com/imarufbillah/bloodos-server.git
   cd bloodos-server
   ```

2. **Install dependencies**

   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

3. **Set up environment variables**

   Create a `.env` file in the root directory:

   ```env
   # Server Configuration
   PORT=5000
   NODE_ENV=development

   # MongoDB Configuration
   MONGODB_URI=mongodb://localhost:27017/bloodos
   # Or for MongoDB Atlas:
   # MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/bloodos

   # Redis Configuration (Optional)
   REDIS_URL=redis://localhost:6379
   # Set to 'false' to disable Redis
   REDIS_ENABLED=true

   # Better Auth Configuration
   BETTER_AUTH_SECRET=your-secret-key-min-32-chars
   BETTER_AUTH_URL=http://localhost:5000

   # Frontend URL (for CORS)
   FRONTEND_URL=http://localhost:3000

   # IMGBB API (for avatar uploads)
   IMGBB_API_KEY=your-imgbb-api-key

   # Optional: Email Configuration (for notifications)
   # SMTP_HOST=smtp.gmail.com
   # SMTP_PORT=587
   # SMTP_USER=your-email@gmail.com
   # SMTP_PASS=your-app-password
   ```

   **Important:**
   - Replace `your-secret-key-min-32-chars` with a secure random string (at least 32 characters)
   - Get your IMGBB API key from [https://api.imgbb.com/](https://api.imgbb.com/)
   - For MongoDB Atlas, replace the connection string with your cluster URL

4. **Initialize the database**

   Create MongoDB indexes:

   ```bash
   npm run init-indexes
   ```

   (Optional) Seed demo data:

   ```bash
   npm run seed
   ```

---

## 💻 Running the Project Locally

### **Development Mode**

Start the development server with auto-reload:

```bash
npm run dev
```

The API will be available at **http://localhost:5000**

### **Production Build**

Build and run the production version:

```bash
npm run build
npm run start
```

### **Database Commands**

```bash
# Create MongoDB indexes
npm run init-indexes

# Verify indexes
npm run verify-indexes

# Seed demo data (idempotent - safe to run multiple times)
npm run seed
```

### **Testing**

Run the test suite:

```bash
# Run tests once
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### **Linting & Formatting**

```bash
# Lint code
npm run lint

# Format code
npm run format
```

---

## 📁 Project Structure

```
bloodos-server/
├── src/
│   ├── controllers/           # Route controllers
│   │   ├── auth.controller.ts
│   │   ├── requests.controller.ts
│   │   ├── donors.controller.ts
│   │   ├── users.controller.ts
│   │   ├── admin.controller.ts
│   │   ├── notifications.controller.ts
│   │   ├── donations.controller.ts
│   │   ├── stats.controller.ts
│   │   ├── contact.controller.ts
│   │   └── upload.controller.ts
│   ├── routes/                # Express routes
│   │   ├── auth.routes.ts
│   │   ├── requests.routes.ts
│   │   ├── donors.routes.ts
│   │   ├── users.routes.ts
│   │   ├── admin.routes.ts
│   │   ├── notifications.routes.ts
│   │   ├── donations.routes.ts
│   │   ├── stats.routes.ts
│   │   ├── contact.routes.ts
│   │   └── upload.routes.ts
│   ├── services/              # Business logic
│   │   ├── request.service.ts
│   │   ├── donor.service.ts
│   │   ├── user.service.ts
│   │   ├── notification.service.ts
│   │   ├── donation.service.ts
│   │   ├── eligibility.service.ts
│   │   └── __tests__/         # Service tests
│   ├── middleware/            # Express middleware
│   │   ├── auth.middleware.ts
│   │   ├── validation.middleware.ts
│   │   ├── error.middleware.ts
│   │   └── rate-limit.middleware.ts
│   ├── validators/            # Zod schemas
│   │   ├── request.validator.ts
│   │   ├── user.validator.ts
│   │   ├── auth.validator.ts
│   │   └── donation.validator.ts
│   ├── lib/                   # Utilities
│   │   ├── auth.ts           # Better Auth config
│   │   ├── db.ts             # MongoDB connection
│   │   ├── redis.ts          # Redis client
│   │   └── upload.ts         # File upload utilities
│   ├── db/                    # Database
│   │   ├── collections.ts    # Typed collection getters
│   │   └── indexes.ts        # Index definitions
│   ├── types/                 # TypeScript types
│   │   ├── shared.ts         # Shared enums and types
│   │   └── dto/              # Data transfer objects
│   ├── scripts/               # Utility scripts
│   │   ├── seed.ts           # Database seeding
│   │   ├── init-indexes.ts   # Create indexes
│   │   └── verify-indexes.ts # Verify indexes
│   ├── app.ts                 # Express app setup
│   └── server.ts              # Server entry point
├── .env                       # Environment variables (create this)
├── tsconfig.json              # TypeScript config
├── package.json               # Project dependencies
└── vitest.config.ts           # Vitest configuration
```

---

## 🔌 API Endpoints

### **Authentication**

```
POST   /api/auth/sign-up       - Register new user
POST   /api/auth/sign-in       - Login user
POST   /api/auth/sign-out      - Logout user
GET    /api/auth/session       - Get current session
```

### **Blood Requests**

```
GET    /api/requests           - List all requests (with filters)
GET    /api/requests/:id       - Get request by ID
POST   /api/requests           - Create new request (protected)
PATCH  /api/requests/:id       - Update request (protected, owner only)
DELETE /api/requests/:id       - Delete request (protected, owner only)
PATCH  /api/requests/:id/status - Update request status (protected, owner only)
```

### **Donors**

```
GET    /api/donors             - List all donors (with filters)
GET    /api/donors/:id         - Get donor by ID
```

### **User Management**

```
GET    /api/users/me           - Get current user profile (protected)
PATCH  /api/users/me           - Update current user profile (protected)
POST   /api/users/me/avatar    - Upload avatar (protected)
```

### **Donations**

```
GET    /api/donations          - List user's donations (protected)
POST   /api/donations          - Log new donation (protected)
```

### **Notifications**

```
GET    /api/notifications      - List user's notifications (protected)
PATCH  /api/notifications/:id/read - Mark notification as read (protected)
```

### **Statistics**

```
GET    /api/stats              - Get platform statistics
```

### **Contact**

```
POST   /api/contact            - Send contact form message
```

### **Admin**

```
GET    /api/admin/users        - List all users (admin only)
PATCH  /api/admin/users/:id/suspend - Suspend/unsuspend user (admin only)
PATCH  /api/admin/users/:id/role - Change user role (admin only)
```

For detailed API documentation with request/response examples, see [API_DOCS.md](API_DOCS.md).

---

## 🗄️ Database Schema

### **Users Collection**

```typescript
{
  _id: ObjectId,
  name: string,
  email: string,
  emailVerified: boolean,
  image?: string,
  createdAt: Date,
  updatedAt: Date,
  phone?: string,
  district?: District,
  bloodGroup?: BloodGroup,
  isDonor: boolean,
  role: 'user' | 'admin',
  isSuspended: boolean,
  suspendedAt?: Date,
  suspendedBy?: ObjectId,
  suspensionReason?: string
}
```

### **Requests Collection**

```typescript
{
  _id: ObjectId,
  patientName: string,
  bloodGroup: BloodGroup,
  unitsNeeded: number,
  hospitalName: string,
  hospitalAddress: string,
  district: District,
  urgency: 'critical' | 'urgent' | 'moderate',
  neededByDate: Date,
  contactPhone: string,
  additionalNotes?: string,
  status: 'pending' | 'fulfilled' | 'cancelled' | 'expired',
  requesterId: ObjectId,
  createdAt: Date,
  updatedAt: Date,
  fulfilledAt?: Date,
  cancelledAt?: Date,
  expiresAt: Date
}
```

### **Donations Collection**

```typescript
{
  _id: ObjectId,
  donorId: ObjectId,
  donationDate: Date,
  location?: string,
  notes?: string,
  createdAt: Date
}
```

### **Notifications Collection**

```typescript
{
  _id: ObjectId,
  userId: ObjectId,
  type: string,
  title: string,
  message: string,
  read: boolean,
  createdAt: Date
}
```

---

## 🧪 Testing

The project includes comprehensive service-level tests:

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

Test coverage includes:

- ✅ Blood compatibility checking
- ✅ Donor eligibility calculation (90-day rule)
- ✅ Request state machine transitions
- ✅ Business logic validation

---

## 🌐 Deployment

### **Railway / Render (Recommended)**

1. Push your code to GitHub
2. Connect your repository to [Railway](https://railway.app/) or [Render](https://render.com/)
3. Add environment variables in the dashboard
4. Deploy!

### **Environment Variables for Production**

```env
NODE_ENV=production
PORT=5000
MONGODB_URI=your-production-mongodb-uri
REDIS_URL=your-production-redis-url (optional)
BETTER_AUTH_SECRET=your-production-secret
BETTER_AUTH_URL=https://your-api-domain.com
FRONTEND_URL=https://your-frontend-domain.com
IMGBB_API_KEY=your-imgbb-api-key
```

### **Docker Deployment**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 5000
CMD ["npm", "start"]
```

---

## 🔗 Important Links

- **Live API:** [https://bloodos-server.onrender.com](https://bloodos-server.onrender.com)
- **Frontend Application:** [https://bloodos.vercel.app](https://bloodos.vercel.app)
- **Client Repository:** [https://github.com/imarufbillah/bloodos-client](https://github.com/imarufbillah/bloodos-client)
- **API Documentation:** [API_DOCS.md](API_DOCS.md)
- **Report Issues:** [GitHub Issues](https://github.com/imarufbillah/bloodos-server/issues)

---

## 🧩 Key Features Explained

### **State Machine for Requests**

Blood requests follow a strict lifecycle:

```
Pending → Fulfilled (when blood is received)
       → Cancelled (when requester cancels)
       → Expired (when needed-by date passes)
```

### **Donor Eligibility**

Donors are considered eligible to donate if:

- At least 90 days have passed since their last donation
- They have registered as a donor
- Their account is not suspended

### **Phone Number Masking**

For privacy, phone numbers are displayed as: `01XXX***XXX` (first 5 + last 3 digits visible)

### **Redis Caching (Optional)**

The server gracefully degrades if Redis is not available. Cache is used for:

- Frequently accessed statistics
- User session data (optional)
- Rate limiting data

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

Please ensure your code:

- Follows TypeScript strict mode
- Includes appropriate tests
- Follows the existing code style
- Includes JSDoc comments for public APIs

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Author

**Md. Maruf Billah**

- GitHub: [@imarufbillah](https://github.com/imarufbillah)
- LinkedIn: [Md. Maruf Billah](https://linkedin.com/in/imarufbillah)
- Email: contact@marufbillah.com

---

## 🙏 Acknowledgments

- [Express.js Team](https://expressjs.com/) for the robust web framework
- [MongoDB](https://www.mongodb.com/) for the flexible NoSQL database
- [Better Auth](https://www.better-auth.com/) for modern authentication
- [Zod](https://zod.dev/) for type-safe validation
- All the blood donors who inspire this project 🩸

---

## ⭐ Show Your Support

If this project helped you, please give it a ⭐️ on GitHub!

---

<div align="center">

**Made with ❤️ for the people of Bangladesh**

[⬆ Back to Top](#bloodos-server-)

</div>
