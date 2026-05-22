# CogniBloom - AI-Native K12 Learning Platform

A production-grade AI learning companion platform that combines tutoring, journaling, knowledge management, and analytics for K-12 students.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- pnpm 9+
- PostgreSQL (Neon recommended)
- Git

### Setup

1. **Clone and install dependencies**

```bash
git clone https://github.com/yourusername/cognibleom.git
cd cognibleom
pnpm install
```

2. **Configure environment variables**

```bash
cp .env.example .env.local
```

Fill in the required environment variables in `.env.local`:
- Database credentials (Neon)
- Clerk authentication keys
- AI provider API keys (Google, Groq, Anthropic)
- Cloudflare R2 storage credentials
- Stripe billing keys
- Resend email service keys

3. **Setup database**

```bash
pnpm db:migrate
pnpm db:seed  # Optional: populate with sample data
```

4. **Start development server**

```bash
pnpm dev
```

The application will be available at `http://localhost:3000`.

## 📁 Project Structure

```
cognibleom/
├── apps/
│   └── web/                 # Next.js 15 application
│       ├── app/             # App Router pages & layouts
│       ├── components/      # React components
│       ├── hooks/           # Custom React hooks
│       ├── lib/             # Utilities & abstractions
│       ├── prisma/          # Database schema & migrations
│       └── public/          # Static assets
├── packages/                # Shared packages (future)
├── .github/
│   └── workflows/           # GitHub Actions CI/CD
└── docs/                    # Documentation
```

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js 15 with App Router
- **UI Library**: React 19
- **Styling**: TailwindCSS + shadcn/ui
- **Animation**: Framer Motion
- **Form Validation**: Zod + React Hook Form

### Backend
- **Runtime**: Next.js Route Handlers
- **Database**: PostgreSQL (Neon)
- **Vector DB**: Vercel Vector DB
- **ORM**: Prisma
- **Authentication**: Clerk

### AI Integration
- **Providers**: Google (Gemini), Groq (Llama), Anthropic (Claude)
- **Multi-provider routing**: Automatic model detection
- **Streaming**: Server-Sent Events (SSE) for real-time responses
- **Embeddings**: Semantic search & RAG

### Infrastructure
- **Hosting**: Vercel
- **Storage**: Cloudflare R2
- **Email**: Resend + React Email
- **Background Jobs**: Vercel QStash
- **CI/CD**: GitHub Actions
- **Monitoring**: Sentry (optional)

## 🔐 Security

- All inputs validated with Zod schemas
- Prompt injection protection
- Rate limiting on API endpoints
- Child safety content filters
- RBAC (Role-Based Access Control)
- Secure environment variable management
- CORS properly configured

## 📊 Database Schema

Key entities:
- `User` - Student, parent, and admin accounts
- `Note` - Rich text journals with metadata
- `TutorSession` - AI chat conversations
- `Quiz` - Assessments and practice questions
- `Upload` - File storage with processing pipeline
- `DailyReport` - Analytics and progress reports
- `Subscription` - Billing and plan management

Run `pnpm db:studio` to explore the database with Prisma Studio.

## 🤖 AI Features

### Chat & Tutoring
- Streaming responses with citations
- Multiple tutor modes (Math, Coding, Language, etc.)
- Context-aware memory system
- Live educational content retrieval
- Vision support (images, documents)

### Content Generation
- AI-generated quizzes and practice problems
- Daily knowledge feed personalization
- Educational content summarization
- Grading and feedback automation

## 🚀 Deployment

### Vercel Deployment

```bash
# Push to main branch
git push origin main

# GitHub Actions automatically deploys to Vercel
```

Environment variables should be configured in Vercel project settings.

### Database Migrations

Migrations are automatically applied during deployment via GitHub Actions.

For manual migration:
```bash
pnpm db:migrate
```

## 📈 API Endpoints

### Authentication
- `GET /api/auth/user` - Current user profile
- `POST /api/auth/logout` - Sign out

### Notes
- `GET /api/notes` - List notes
- `POST /api/notes` - Create note
- `GET /api/notes/:id` - Get single note
- `PUT /api/notes/:id` - Update note
- `DELETE /api/notes/:id` - Delete note
- `POST /api/notes/search` - Vector search

### Chat/Tutoring
- `POST /api/tutor/chat` - Start/continue chat session (streaming)
- `GET /api/tutor/sessions` - List sessions
- `GET /api/tutor/modes` - Available tutor modes

### Quizzes
- `POST /api/quiz` - Generate quiz
- `GET /api/quiz/:id` - Get quiz
- `POST /api/quiz/:id/submit` - Submit answers

### Feed
- `GET /api/feed` - Daily knowledge feed
- `POST /api/feed/:id/engagement` - Track engagement

### Analytics
- `GET /api/analytics/profile` - Learning profile
- `GET /api/analytics/report` - Daily report

## 🧪 Testing

### Run all tests
```bash
pnpm test
```

### Unit tests
```bash
pnpm test
```

### E2E tests
```bash
pnpm test:e2e
```

### Test coverage
```bash
pnpm test --coverage
```

## 📝 Code Standards

- **TypeScript**: Strict mode, strict null checks
- **Formatting**: Prettier + ESLint
- **Components**: Functional, max 400 lines
- **Testing**: Minimum 80% coverage
- **Commits**: Conventional Commits format

Run linting:
```bash
pnpm lint
```

Run type checking:
```bash
pnpm type-check
```

Format code:
```bash
pnpm format
```

## 🔄 Development Workflow

1. Create feature branch
2. Make changes
3. Run tests and linting
4. Create pull request
5. GitHub Actions validates
6. Deploy to Vercel preview
7. Merge to main
8. Auto-deploy to production

## 📚 Documentation

- [Architecture Plan](docs/ARCHITECTURE.md)
- [API Documentation](docs/API.md)
- [Contributing Guidelines](CONTRIBUTING.md)
- [Deployment Guide](docs/DEPLOYMENT.md)

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines and follow the code standards.

## 📄 License

This project is proprietary software. All rights reserved.

## 🆘 Support

For issues and questions:
- GitHub Issues: [Project Issues](https://github.com/yourusername/cognibleom/issues)
- Email: support@cognibleom.com

## 🎯 Roadmap

### Phase 1: Foundation ✅
- Monorepo setup
- Authentication (Clerk)
- Database schema
- GitHub Actions CI/CD
- Vercel deployment

### Phase 2: Core Learning (In Progress)
- Rich note editor
- AI tutor (streaming chat)
- Vector embeddings & search
- Basic dashboard

### Phase 3: Knowledge & Practice
- Quiz generation
- Practice problems
- Knowledge tracking
- Daily feed

### Phase 4: Advanced Features
- File upload system
- Reviewer agent
- Email reports
- Parent dashboard

### Phase 5: Production
- Stripe billing
- Advanced analytics
- Admin dashboard
- Performance optimization

---

**Built with ❤️ for K-12 learning**
