This is the **Financial Modeling Web Platform (FMWP)** project.

> "데이터의 무결성 위에 예술적인 인터랙션을 얹다."

## Project Goal
To provide a production-grade financial modeling platform that is **Auditable**, **Reproducible**, and **Immutable**.

## Tech Stack
- **Frontend**: Next.js 15 (App Router), Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes, Node.js 22 LTS
- **Database**: PostgreSQL 16
- **Queue/Cache**: Redis, BullMQ
- **Infrastructure**: Docker, AWS ECS

## Getting Started

### 1. Environment Setup
Copy the example environment file:

```bash
cp .env.example .env
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start Infrastructure
Run PostgreSQL and Redis using Docker Compose:

```bash
docker-compose up -d
```

### 4. Initialize Database Schema

```bash
npm run db:push
npm run db:seed
```

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
