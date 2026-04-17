# Job Tracker API

A robust, production-ready RESTful API for tracking job applications, built with **Fastify**, **TypeScript**, **PostgreSQL**, and **Redis**. This application provides a complete backend solution for managing job application workflows with authentication, rate limiting, activity logging, and real-time statistics.

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [Authentication & Security](#authentication--security)
- [Application Status Workflow](#application-status-workflow)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [Testing](#testing)
- [API Documentation](#api-documentation)
- [Contributing](#contributing)

---

## ✨ Features

- 🔐 **JWT-based Authentication** - Secure access/refresh token flow with cookie storage
- 📊 **Application Tracking** - Full CRUD operations for job applications
- 🔄 **Status State Machine** - Enforced valid transitions between application statuses
- 📝 **Activity Logging** - Automatic audit trail for all status changes
- 📈 **Statistics Dashboard** - Real-time analytics on application data
- 🛡️ **Rate Limiting** - Configurable per-route and global rate limits
- 🚫 **Comprehensive Error Handling** - Standardized error responses with proper HTTP codes
- 🔒 **Security Headers** - Helmet.js for enhanced security
- 🧪 **Test Coverage** - Extensive unit and integration tests with Vitest
- 📖 **OpenAPI Specification** - Fully documented API with OpenAPI 3.0
- 🎯 **Type Safety** - End-to-end TypeScript with Zod validation

---

## 🛠 Tech Stack

| Category | Technology |
|----------|------------|
| **Runtime** | Node.js |
| **Language** | TypeScript |
| **Framework** | Fastify v5 |
| **Database** | PostgreSQL |
| **ORM** | Drizzle ORM |
| **Cache/Session** | Redis (ioredis) |
| **Validation** | Zod |
| **Authentication** | JWT (jose) |
| **Password Hashing** | bcrypt |
| **Testing** | Vitest + supertest |
| **Package Manager** | pnpm |

---

## 🏗 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
│                    (Frontend / Mobile / Postman)                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API Gateway Layer                           │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ Rate Limiter│  │ CORS/Helmet  │  │ Cookie Parser        │   │
│  └─────────────┘  └──────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Routing Layer                              │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ Auth Routes │  │ Application  │  │ Stats Routes         │   │
│  │ /v1/auth/*  │  │ Routes       │  │ /v1/stats            │   │
│  │             │  │ /v1/apps/*   │  │                      │   │
│  └─────────────┘  └──────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Middleware Layer                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Authentication Middleware                   │    │
│  │         (JWT Verification + User Resolution)             │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Controller Layer                             │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ Auth        │  │ Application  │  │ Stats                │   │
│  │ Controller  │  │ Controller   │  │ Controller           │   │
│  └─────────────┘  └──────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Service Layer                               │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ Auth        │  │ Application  │  │ Activity             │   │
│  │ Service     │  │ Service      │  │ Service              │   │
│  └─────────────┘  └──────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Data Access Layer                           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                  Drizzle ORM                             │    │
│  └─────────────────────────────────────────────────────────┘    │
│         │                                    │                   │
│         ▼                                    ▼                   │
│  ┌─────────────┐                    ┌──────────────┐            │
│  │ PostgreSQL  │                    │    Redis     │            │
│  │  (Primary)  │                    │  (Cache/     │            │
│  │             │                    │   Blacklist) │            │
│  └─────────────┘                    └──────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

### Architecture Patterns

- **Layered Architecture**: Clear separation of concerns across routing, controllers, services, and data access layers
- **Dependency Injection**: Fastify's plugin system for modular component registration
- **State Machine Pattern**: Enforced status transitions for job applications
- **Repository Pattern**: Database operations abstracted through Drizzle ORM
- **Middleware Chain**: Authentication, rate limiting, and error handling as composable middleware

---

## 📁 Project Structure

```
job-tracker-api/
├── src/
│   ├── db/
│   │   ├── index.ts          # Database connection & Drizzle instance
│   │   ├── schema.ts         # Database table definitions
│   │   └── migrations/       # Generated migration files
│   │
│   ├── lib/
│   │   └── response.ts       # Standardized response builders
│   │
│   ├── middleware/
│   │   └── auth.middleware.ts # JWT authentication middleware
│   │
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.routes.ts
│   │   │   └── auth.schema.ts
│   │   │
│   │   ├── applications/
│   │   │   ├── application.controller.ts
│   │   │   ├── applications.service.ts
│   │   │   ├── applications.routes.ts
│   │   │   ├── application.schema.ts
│   │   │   └── status-machine.ts    # State machine for status transitions
│   │   │
│   │   ├── activity/
│   │   │   └── activity.service.ts  # Activity logging service
│   │   │
│   │   └── stats/
│   │       └── stats.routes.ts      # Statistics endpoints
│   │
│   ├── plugins/
│   │   ├── error-handler.ts    # Global error handler plugin
│   │   └── rate-limit.ts       # Rate limiting configuration
│   │
│   ├── schemas/
│   │   └── schema.ts           # Zod validation schemas
│   │
│   ├── types/
│   │   └── fastify.d.ts        # TypeScript type augmentations
│   │
│   ├── utils/
│   │   ├── auth/
│   │   │   └── token.ts        # JWT token generation & verification
│   │   │
│   │   └── errors/
│   │       ├── base.error.ts
│   │       ├── error.handler.ts
│   │       ├── error.types.ts
│   │       ├── error.utils.ts
│   │       └── http.errors.ts
│   │
│   ├── server.ts             # Application entry point
│   └── server.test.ts        # Integration tests
│
├── .env.example              # Environment variable template
├── drizzle.config.ts         # Drizzle ORM configuration
├── openapi.yaml              # OpenAPI 3.0 specification
├── package.json              # Dependencies & scripts
├── postman-collection.json   # Postman API collection
├── tsconfig.json             # TypeScript configuration
└── vitest.config.ts          # Vitest testing configuration
```

---

## 🗄 Database Schema

### Tables

#### `users`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT RANDOM |
| email | TEXT | UNIQUE, NOT NULL |
| password_hash | TEXT | NOT NULL |
| name | TEXT | NOT NULL |
| created_at | TIMESTAMP | DEFAULT NOW |
| updated_at | TIMESTAMP | DEFAULT NOW |

#### `applications`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT RANDOM |
| user_id | UUID | FOREIGN KEY → users.id (CASCADE DELETE) |
| company_name | TEXT | NOT NULL |
| role_title | TEXT | NOT NULL |
| status | ENUM | DEFAULT 'APPLIED' |
| location | TEXT | NULLABLE |
| job_url | TEXT | NULLABLE |
| salary_min | INTEGER | NULLABLE |
| salary_max | INTEGER | NULLABLE |
| notes | TEXT | NULLABLE |
| applied_at | TIMESTAMP | DEFAULT NOW |
| created_at | TIMESTAMP | DEFAULT NOW |
| updated_at | TIMESTAMP | DEFAULT NOW |

#### `activity_logs`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT RANDOM |
| application_id | UUID | FOREIGN KEY → applications.id (CASCADE DELETE) |
| from_status | ENUM | NULLABLE |
| to_status | ENUM | NOT NULL |
| note | TEXT | NULLABLE |
| created_at | TIMESTAMP | DEFAULT NOW |

#### `refresh_tokens`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT RANDOM |
| user_id | UUID | FOREIGN KEY → users.id (CASCADE DELETE) |
| token | TEXT | UNIQUE, NOT NULL |
| expires_at | TIMESTAMP | NOT NULL |
| created_at | TIMESTAMP | DEFAULT NOW |

### Enums

#### `application_status`
```
APPLIED → SCREENING → INTERVIEW → OFFER → ACCEPTED
    ↓         ↓           ↓          ↓
    └────→ REJECTED ←────┴──────────┘
              ↓
         WITHDRAWN
```

---

## 🌐 API Endpoints

### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/v1/auth/register` | Register new user | ❌ |
| POST | `/v1/auth/login` | Login user | ❌ |
| GET | `/v1/auth/me` | Get current user | ✅ |
| DELETE | `/v1/auth/logout` | Logout user | ✅ |
| POST | `/v1/auth/refresh` | Refresh access token | ❌ |

### Applications

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/v1/applications` | Create application | ✅ |
| GET | `/v1/applications` | List all applications | ✅ |
| GET | `/v1/applications/:id` | Get single application | ✅ |
| GET | `/v1/applications/:id/activity` | Get activity log | ✅ |
| PATCH | `/v1/applications/:id` | Update application | ✅ |
| PATCH | `/v1/applications/:id/status` | Update status | ✅ |
| DELETE | `/v1/applications/:id` | Delete application | ✅ |

### Statistics

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/v1/stats` | Get application statistics | ✅ |

### Health Check

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/health` | Health check | ❌ |

---

## 🔐 Authentication & Security

### Token Strategy

The application uses a **dual-token JWT system**:

1. **Access Token** (Short-lived: 15 minutes)
   - Stored in HTTP-only cookie
   - Used for API authentication
   - Supports revocation via Redis blacklist

2. **Refresh Token** (Long-lived: 7 days)
   - Stored securely server-side
   - Used to obtain new access tokens
   - JTI (JWT ID) stored in database for revocation

### Security Features

- **Password Hashing**: bcrypt with configurable salt rounds (default: 12)
- **Token Blacklisting**: Revoked tokens stored in Redis
- **Rate Limiting**: 
  - Global: 100 requests/minute
  - Strict (auth): 5 requests/minute
  - Per-route customization
- **Security Headers**: Helmet.js for XSS, content-type sniffing protection
- **CORS**: Configurable cross-origin resource sharing
- **Input Validation**: Zod schemas for all request bodies
- **Type Safety**: Full TypeScript coverage with strict mode

### JWT Payload Structure

```typescript
{
  sub: string;      // User ID
  email: string;    // User email
  type: "access" | "refresh";
  iat: number;      // Issued at
  exp: number;      // Expiration
  iss: string;      // Issuer
  aud: string;      // Audience
  jti: string;      // JWT ID (for revocation)
}
```

---

## 🔄 Application Status Workflow

The application implements a **state machine** to enforce valid status transitions:

```
                    ┌─────────────┐
                    │   APPLIED   │
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
   ┌───────────┐    ┌───────────┐    ┌─────────────┐
   │ SCREENING │    │  REJECTED │    │  WITHDRAWN  │
   └─────┬─────┘    └────┬──────┘    └─────────────┘
         │               │
         │         ┌─────┴─────┐
         │         │           │
         ▼         │           │
   ┌───────────┐   │           │
   │ INTERVIEW │   │           │
   └─────┬─────┘   │           │
         │         │           │
    ┌────┴────┐    │           │
    │         │    │           │
    ▼         ▼    │           │
┌───────┐ ┌────────┴┴───────────┘
│ OFFER │ │
└───┬───┘ │
    │     │
    ▼     │
┌─────────┴┘
│ ACCEPTED │
└──────────┘
```

### Valid Transitions

| From Status | To Statuses |
|-------------|-------------|
| APPLIED | SCREENING, REJECTED, WITHDRAWN |
| SCREENING | INTERVIEW, REJECTED, WITHDRAWN |
| INTERVIEW | OFFER, REJECTED, WITHDRAWN |
| OFFER | ACCEPTED, REJECTED |
| ACCEPTED | *(terminal state)* |
| REJECTED | *(terminal state)* |
| WITHDRAWN | *(terminal state)* |

Invalid transitions throw an error and are logged.

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18+ 
- **pnpm** v8+
- **PostgreSQL** v14+
- **Redis** v6+

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd job-tracker-api
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start Redis and PostgreSQL**
   ```bash
   # Using Docker (recommended)
   docker run -d --name redis -p 6379:6379 redis:latest
   docker run -d --name postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=job_tracker -p 5432:5432 postgres:latest
   ```

5. **Run database migrations**
   ```bash
   pnpm db:push
   # or
   pnpm db:generate && pnpm db:migrate
   ```

6. **Start the development server**
   ```bash
   pnpm dev
   ```

The API will be available at `http://localhost:3000`

---

## ⚙️ Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection string | - | ✅ |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` | ✅ |
| `PORT` | Server port | `3000` | ❌ |
| `NODE_ENV` | Environment | `development` | ❌ |
| `JWT_ACCESS_SECRET` | Access token signing secret | - | ✅ |
| `JWT_REFRESH_SECRET` | Refresh token signing secret | - | ✅ |
| `COOKIE_SECRET` | Cookie signing secret | - | ✅ |
| `JWT_ISSUER` | JWT issuer claim | `your-app-name.com` | ❌ |
| `JWT_AUDIENCE` | JWT audience claim | `your-app-client` | ❌ |
| `ACCESS_TOKEN_TTL` | Access token expiration | `15m` | ❌ |
| `REFRESH_TOKEN_TTL` | Refresh token expiration | `7d` | ❌ |
| `SALT_ROUNDS` | bcrypt salt rounds | `12` | ❌ |

### Example `.env` File

```env
DATABASE_URL=postgresql://user:password@localhost:5432/job_tracker
REDIS_URL=redis://localhost:6379
PORT=3000
NODE_ENV=development
JWT_ACCESS_SECRET=your-super-secret-access-key-min-32-chars
JWT_REFRESH_SECRET=your-super-secret-refresh-key-min-32-chars
COOKIE_SECRET=your-cookie-secret-key
JWT_ISSUER=job-tracker-api
JWT_AUDIENCE=job-tracker-client
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=7d
SALT_ROUNDS=12
```

---

## 📦 Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server with hot reload |
| `pnpm build` | Compile TypeScript to JavaScript |
| `pnpm start` | Start production server |
| `pnpm test` | Run test suite |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm test:coverage` | Run tests with coverage report |
| `pnpm db:generate` | Generate Drizzle migrations |
| `pnpm db:migrate` | Run database migrations |
| `pnpm db:push` | Push schema directly to database |
| `pnpm db:studio` | Open Drizzle Studio (DB GUI) |

---

## 🧪 Testing

The project uses **Vitest** for testing with a comprehensive test suite covering:

- Unit tests for services and utilities
- Integration tests for API endpoints
- Middleware tests
- Error handler tests

### Run Tests

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch

# With coverage
pnpm test:coverage
```

### Test Files Location

Tests are co-located with source files using the `.test.ts` suffix:
- `src/modules/auth/auth.service.test.ts`
- `src/modules/applications/application.controller.test.ts`
- `src/middleware/auth.middleware.test.ts`
- `src/server.test.ts`

---

## 📖 API Documentation

### OpenAPI Specification

The API is fully documented using OpenAPI 3.0. View the specification:

- **File**: [`openapi.yaml`](./openapi.yaml)
- **Swagger UI**: Import the YAML file into Swagger Editor or any OpenAPI-compatible viewer

### Postman Collection

A ready-to-use Postman collection is available:

- **File**: [`postman-collection.json`](./postman-collection.json)
- Import directly into Postman for easy API testing

### Quick Start Guide

1. **Register a new user**
   ```bash
   curl -X POST http://localhost:3000/v1/auth/register \
     -H "Content-Type: application/json" \
     -d '{"name":"John Doe","email":"john@example.com","password":"securepassword123"}'
   ```

2. **Login**
   ```bash
   curl -X POST http://localhost:3000/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"john@example.com","password":"securepassword123"}'
   ```

3. **Create an application** (requires auth cookie from login)
   ```bash
   curl -X POST http://localhost:3000/v1/applications \
     -H "Content-Type: application/json" \
     -H "Cookie: token=<access_token>" \
     -d '{"companyName":"Acme Corp","roleTitle":"Software Engineer","location":"Remote"}'
   ```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- TypeScript strict mode enabled
- ESLint configuration for code consistency
- Prettier for code formatting
- Meaningful commit messages following conventional commits

---

## 📄 License

ISC

---

## 🙏 Acknowledgments

- [Fastify](https://www.fastify.io/) - Blazing fast web framework
- [Drizzle ORM](https://orm.drizzle.team/) - TypeScript ORM
- [Vitest](https://vitest.dev/) - Next-gen testing framework
- [Zod](https://zod.dev/) - TypeScript-first schema validation

---

**Built with ❤️ using Fastify and TypeScript**
