-- Nullable fields keep existing messages and older clients compatible.
ALTER TABLE "ChatMessage" ADD COLUMN "requestKey" TEXT, ADD COLUMN "clientMessageId" TEXT;
CREATE UNIQUE INDEX "ChatMessage_requestKey_key" ON "ChatMessage"("requestKey");
