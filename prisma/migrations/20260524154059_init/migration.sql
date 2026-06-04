-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'LEERLING',
    "actief" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Klas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "naam" TEXT NOT NULL,
    "beschrijving" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Vak" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "naam" TEXT NOT NULL,
    "beschrijving" TEXT,
    "categorie" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "KlasVak" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "klasId" TEXT NOT NULL,
    "vakId" TEXT NOT NULL,
    CONSTRAINT "KlasVak_klasId_fkey" FOREIGN KEY ("klasId") REFERENCES "Klas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "KlasVak_vakId_fkey" FOREIGN KEY ("vakId") REFERENCES "Vak" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KlasDocent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "klasId" TEXT NOT NULL,
    "docentId" TEXT NOT NULL,
    CONSTRAINT "KlasDocent_klasId_fkey" FOREIGN KEY ("klasId") REFERENCES "Klas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "KlasDocent_docentId_fkey" FOREIGN KEY ("docentId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KlasLeerling" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "klasId" TEXT NOT NULL,
    "leerlingId" TEXT NOT NULL,
    CONSTRAINT "KlasLeerling_klasId_fkey" FOREIGN KEY ("klasId") REFERENCES "Klas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "KlasLeerling_leerlingId_fkey" FOREIGN KEY ("leerlingId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Cijfer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "waarde" REAL NOT NULL,
    "omschrijving" TEXT,
    "datum" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vakId" TEXT NOT NULL,
    "leerlingId" TEXT NOT NULL,
    CONSTRAINT "Cijfer_vakId_fkey" FOREIGN KEY ("vakId") REFERENCES "Vak" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Cijfer_leerlingId_fkey" FOREIGN KEY ("leerlingId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Les" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "datum" DATETIME NOT NULL,
    "begintijd" TEXT NOT NULL,
    "eindtijd" TEXT NOT NULL,
    "lokaal" TEXT,
    "klasId" TEXT NOT NULL,
    CONSTRAINT "Les_klasId_fkey" FOREIGN KEY ("klasId") REFERENCES "Klas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Aanwezigheid" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL,
    "lesId" TEXT NOT NULL,
    "leerlingId" TEXT NOT NULL,
    CONSTRAINT "Aanwezigheid_lesId_fkey" FOREIGN KEY ("lesId") REFERENCES "Les" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Aanwezigheid_leerlingId_fkey" FOREIGN KEY ("leerlingId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Huiswerk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titel" TEXT NOT NULL,
    "beschrijving" TEXT,
    "deadline" DATETIME,
    "vakId" TEXT NOT NULL,
    "lesId" TEXT,
    CONSTRAINT "Huiswerk_vakId_fkey" FOREIGN KEY ("vakId") REFERENCES "Vak" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Huiswerk_lesId_fkey" FOREIGN KEY ("lesId") REFERENCES "Les" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Inlevering" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inhoud" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "huiswerkId" TEXT NOT NULL,
    "leerlingId" TEXT NOT NULL,
    CONSTRAINT "Inlevering_huiswerkId_fkey" FOREIGN KEY ("huiswerkId") REFERENCES "Huiswerk" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Inlevering_leerlingId_fkey" FOREIGN KEY ("leerlingId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Bericht" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "onderwerp" TEXT NOT NULL,
    "inhoud" TEXT NOT NULL,
    "gelezen" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verzenderId" TEXT NOT NULL,
    "ontvangerId" TEXT NOT NULL,
    CONSTRAINT "Bericht_verzenderId_fkey" FOREIGN KEY ("verzenderId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Bericht_ontvangerId_fkey" FOREIGN KEY ("ontvangerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "KlasVak_klasId_vakId_key" ON "KlasVak"("klasId", "vakId");

-- CreateIndex
CREATE UNIQUE INDEX "KlasDocent_klasId_docentId_key" ON "KlasDocent"("klasId", "docentId");

-- CreateIndex
CREATE UNIQUE INDEX "KlasLeerling_klasId_leerlingId_key" ON "KlasLeerling"("klasId", "leerlingId");

-- CreateIndex
CREATE UNIQUE INDEX "Aanwezigheid_lesId_leerlingId_key" ON "Aanwezigheid"("lesId", "leerlingId");

-- CreateIndex
CREATE UNIQUE INDEX "Inlevering_huiswerkId_leerlingId_key" ON "Inlevering"("huiswerkId", "leerlingId");
