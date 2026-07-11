# BloodOS Backend API

Express.js backend for BloodOS blood donor coordination platform.

## Tech Stack

- **Runtime**: Node.js with TypeScript ESM
- **Framework**: Express.js 5.2.1
- **Database**: MongoDB (native driver)
- **Authentication**: better-auth + jose (JWKS verification)
- **Validation**: Zod
- **Rate Limiting**: express-rate-limit

## Project Structure

```
src/
├── middleware/     # Authentication, authorization, error handling
├── routes/         # API route handlers
├── services/       # Business logic (eligibility, notifications)
├── types/          # TypeScript type definitions
├── utils/          # Utility functions
└── server.ts       # Application entry point
```

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

3. Configure environment variables in `.env`:
   - MongoDB connection string
   - better-auth configuration
   - Frontend URL for CORS

4. Build TypeScript:
```bash
npm run build
```

5. Start server:
```bash
npm start
```

## Development

Run in development mode with auto-reload:
```bash
npm run dev
```

## Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Start production server
- `npm run dev` - Build and start with nodemon
- `npm run serve` - Start server from compiled dist/ (must build first)
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

## API Features

- JWT authentication with JWKS verification
- Role-based access control (user/admin)
- Rate limiting on authentication endpoints
- Standardized error responses
- Paginated API responses
- MongoDB native driver with connection pooling
- Comprehensive audit logging

## Configuration

### TypeScript
- Strict mode enabled
- ESM modules (`module: "nodenext"`)
- Compiles from `src/` to `dist/`

### ESLint
- TypeScript recommended rules
- Prettier integration
- Promise handling enforcement

### Prettier
- Single quotes
- 100 character line width
- Trailing commas (ES5)
- Semicolons enabled
