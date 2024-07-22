/*
  Warnings:

  - A unique constraint covering the columns `[emuCode]` on the table `CarwashService` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "CarwashService" ADD COLUMN     "emuCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CarwashService_emuCode_key" ON "CarwashService"("emuCode");
