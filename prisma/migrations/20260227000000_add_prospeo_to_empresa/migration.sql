-- AlterTable
ALTER TABLE "Empresa" ADD COLUMN "prospeo_api_key" TEXT;
ALTER TABLE "Empresa" ADD COLUMN "enrichment_provider" TEXT NOT NULL DEFAULT 'apollo';
