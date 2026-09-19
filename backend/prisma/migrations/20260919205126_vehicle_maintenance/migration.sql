-- CreateEnum
CREATE TYPE "VehicleMaintenanceType" AS ENUM ('INSPECTION', 'OIL_CHANGE', 'TIRE', 'OTHER');

-- CreateTable
CREATE TABLE "VehicleMaintenance" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "maintenanceType" "VehicleMaintenanceType" NOT NULL,
    "lastServiceDate" DATE NOT NULL,
    "nextDueDate" DATE NOT NULL,
    "note" TEXT,
    "lastDueAlertAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleMaintenance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VehicleMaintenance_staffId_idx" ON "VehicleMaintenance"("staffId");

-- CreateIndex
CREATE INDEX "VehicleMaintenance_nextDueDate_idx" ON "VehicleMaintenance"("nextDueDate");

-- AddForeignKey
ALTER TABLE "VehicleMaintenance" ADD CONSTRAINT "VehicleMaintenance_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
