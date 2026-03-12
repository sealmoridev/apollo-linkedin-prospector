-- CreateTable
CREATE TABLE "PendingPhone" (
    "id" TEXT NOT NULL,
    "apollo_person_id" TEXT NOT NULL,
    "linkedin_url" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingPhone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PendingPhone_apollo_person_id_key" ON "PendingPhone"("apollo_person_id");
