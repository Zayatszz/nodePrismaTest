/*
  Warnings:

  - You are about to drop the column `imageUrls` on the `Carwash` table. All the data in the column will be lost.
  - Added the required column `imageUrl` to the `Carwash` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Carwash" DROP COLUMN "imageUrls",
ADD COLUMN     "imageUrl" TEXT NOT NULL;
