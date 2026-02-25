-- AddColumn sesion_id to Consumo
ALTER TABLE "Consumo" ADD COLUMN "sesion_id" TEXT;

-- Index for fast lookup of related records by session
CREATE INDEX "Consumo_sesion_id_idx" ON "Consumo"("sesion_id");
