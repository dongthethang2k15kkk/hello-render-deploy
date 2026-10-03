-- Sign in with Discord: the Discord user id links the account; the username helps Admins recognise customers.
ALTER TABLE "Customer" ADD COLUMN "discordId" TEXT, ADD COLUMN "discordUsername" TEXT;
CREATE UNIQUE INDEX "Customer_discordId_key" ON "Customer"("discordId");
