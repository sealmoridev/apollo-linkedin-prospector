-- CreateTable
CREATE TABLE "CreditRate" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "field_type" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditRate_provider_field_type_key" ON "CreditRate"("provider", "field_type");

-- AlterTable
ALTER TABLE "Consumo" ADD COLUMN "credit_breakdown" JSONB;
