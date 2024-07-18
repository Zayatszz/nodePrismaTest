-- CreateTable
CREATE TABLE "CarwashService" (
    "id" SERIAL NOT NULL,
    "location" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "phoneNumber" VARCHAR(15) NOT NULL,
    "name" TEXT NOT NULL,
    "district" TEXT NOT NULL DEFAULT '',
    "province" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "pincode" TEXT,
    "stars" INTEGER NOT NULL,

    CONSTRAINT "CarwashService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QPayInvoice" (
    "id" SERIAL NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentDetail" TEXT,
    "callbackUrl" TEXT NOT NULL,

    CONSTRAINT "QPayInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" SERIAL NOT NULL,
    "scheduledTime" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "carWashTypeId" INTEGER,
    "washType" TEXT,
    "carSize" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "endTime" TIMESTAMP(3) NOT NULL,
    "paymentDetail" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "timetableId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "carWashServiceId" INTEGER NOT NULL,
    "carNumber" TEXT,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarWashType" (
    "id" SERIAL NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "duration" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "size" TEXT NOT NULL,

    CONSTRAINT "CarWashType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Timetable" (
    "id" SERIAL NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "holidays" TIMESTAMP(3)[],

    CONSTRAINT "Timetable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rating" (
    "id" SERIAL NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "stars" INTEGER NOT NULL,
    "feedback" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QPayInvoice_invoiceId_key" ON "QPayInvoice"("invoiceId");

-- CreateIndex
CREATE INDEX "QPayInvoice_bookingId_idx" ON "QPayInvoice"("bookingId");

-- CreateIndex
CREATE INDEX "Booking_carWashServiceId_idx" ON "Booking"("carWashServiceId");

-- AddForeignKey
ALTER TABLE "QPayInvoice" ADD CONSTRAINT "QPayInvoice_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_carWashTypeId_fkey" FOREIGN KEY ("carWashTypeId") REFERENCES "CarWashType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_timetableId_fkey" FOREIGN KEY ("timetableId") REFERENCES "Timetable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_carWashServiceId_fkey" FOREIGN KEY ("carWashServiceId") REFERENCES "CarwashService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarWashType" ADD CONSTRAINT "CarWashType_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "CarwashService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timetable" ADD CONSTRAINT "Timetable_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "CarwashService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "CarwashService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
