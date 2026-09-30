-- Chat read state: when the customer and the Admin team last read the conversation.
-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "adminChatReadAt" TIMESTAMP(3),
ADD COLUMN     "chatReadAt" TIMESTAMP(3);

