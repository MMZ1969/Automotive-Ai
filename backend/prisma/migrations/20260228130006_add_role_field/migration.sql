-- CreateEnum
CREATE TYPE "Role" AS ENUM ('DIYER', 'MECHANIC');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'DIYER';
