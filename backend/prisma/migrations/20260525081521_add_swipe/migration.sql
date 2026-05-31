-- CreateEnum
CREATE TYPE "SwipeAction" AS ENUM ('LIKE', 'SKIP');

-- CreateTable
CREATE TABLE "Swipe" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "action" "SwipeAction" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Swipe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Swipe_userId_idx" ON "Swipe"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Swipe_userId_targetUserId_key" ON "Swipe"("userId", "targetUserId");
