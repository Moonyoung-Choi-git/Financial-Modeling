import { PrismaClient } from '@prisma/client'

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

declare global {
  var __prisma: undefined | ReturnType<typeof prismaClientSingleton>
}

// Ensure Prisma client is always defined
const prisma = globalThis.__prisma ?? prismaClientSingleton()

// Validate Prisma client is properly initialized
if (!prisma) {
  throw new Error('Prisma client failed to initialize. Check DATABASE_URL environment variable.')
}

// Cache in development to avoid exhausting database connections
if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma
}

export default prisma