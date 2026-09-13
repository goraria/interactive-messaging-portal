import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client/index"
import { Pool } from "@gorth/structure/cores/pg"
import { databaseUrl } from "@/lib/utils/environment"

const connectionString = `${databaseUrl}`
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

export { prisma }

// import { PrismaClient } from '@prisma/client/index';

// declare global {
//   var prisma: PrismaClient | undefined;
// }

// // Prisma Client singleton pattern for serverless environments
// // In serverless (Vercel), each function invocation may reuse the same container,
// // so we use global to prevent multiple Prisma Client instances
// let prisma: PrismaClient;

// if (isProduction) {
//   // Production: create a single instance with optimized connection pool
//   prisma = global.prisma ?? new PrismaClient({
//     log: ['error'],
//     datasources: {
//       db: {
//         url: databaseUrl,
//       },
//     },
//   });
//   if (!global.prisma) {
//     global.prisma = prisma;
//   }
// } else {
//   // Development: create a new instance with connection pool
//   prisma = global.prisma ?? new PrismaClient({
//     log: isProduction ? ["error"] : ["error", "warn"],
//     datasources: {
//       db: {
//         url: databaseUrl,
//       },
//     },
//   });
//   if (!global.prisma) {
//     global.prisma = prisma;
//   }
// }

// export default prisma;

// import { PrismaClient } from '@prisma/client/index';
//
// declare global {
//   var prisma: PrismaClient | undefined;
// }
//
// // export const prisma =
// //   global.prisma ?? new PrismaClient({
// //     log: isProduction ? ["error"] : ["query", "error", "warn"],
// //   });
// //
// // if (!isProduction) global.prisma = prisma;
//
// let prisma: PrismaClient;
// if (!global.prisma) {
//   global.prisma = new PrismaClient();
// }
// prisma = global.prisma;
//
// export default prisma;
