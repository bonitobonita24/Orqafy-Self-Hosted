-- ORQ-26: a storageKey may back at most ONE Document.
-- Additive only: a unique index. Without it a manage_files holder who learned an
-- SPI document's key could commit a second Document for the same object with
-- isSPI=false and download it without view_finances.
-- Pre-flight: fails if duplicate storageKeys already exist — check with
--   SELECT "storageKey", count(*) FROM "Document" GROUP BY 1 HAVING count(*) > 1;
-- and resolve manually (never auto-deleted here).

-- CreateIndex
CREATE UNIQUE INDEX "Document_storageKey_key" ON "Document"("storageKey");
