-- D-28 (ORQ-23): task-scoped site-photo upload.
-- Additive only: a new Permission enum value (never DROP/CREATE the type) and a
-- nullable, unique idempotency key minted by the mobile outbox.

-- AlterEnum
ALTER TYPE "Permission" ADD VALUE 'upload_photo';

-- AlterTable
ALTER TABLE "Photo" ADD COLUMN "clientId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Photo_clientId_key" ON "Photo"("clientId");
