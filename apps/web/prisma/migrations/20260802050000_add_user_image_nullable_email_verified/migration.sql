-- @auth/prisma-adapter's createUser() always sends a standard Auth.js user
-- shape for brand-new OAuth sign-ins: { name, email, image, emailVerified }.
-- Our User table was missing `image` entirely, and had `emailVerified` as a
-- non-nullable Boolean while the adapter explicitly writes
-- `emailVerified: null` for new users -- both rejected the insert outright
-- with a PrismaClientValidationError, blocking every first-time Google
-- sign-in. Purely additive: no data is dropped or renamed.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "image" TEXT;
ALTER TABLE "User" ALTER COLUMN "emailVerified" DROP NOT NULL;
