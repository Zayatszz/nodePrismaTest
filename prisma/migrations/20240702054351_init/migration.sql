-- CreateTable
CREATE TABLE "Carwash" (
    "id" SERIAL NOT NULL,
    "location" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "phoneNumber" VARCHAR(15) NOT NULL,
    "name" TEXT NOT NULL,
    "province" TEXT NOT NULL DEFAULT '',
    "imageUrls" TEXT[],
    "stars" INTEGER NOT NULL,

    CONSTRAINT "Carwash_pkey" PRIMARY KEY ("id")
);
