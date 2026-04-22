-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'LECTOR',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Especialidad" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "honorarioClinica" REAL NOT NULL DEFAULT 10.0,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activa" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "UnidadServicio" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activa" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "DailyReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fecha" DATETIME NOT NULL,
    "tasaCambio" REAL NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
    "observaciones" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "cerradoAt" DATETIME,
    "creadoPorId" TEXT NOT NULL,
    "editadoPorId" TEXT,
    CONSTRAINT "DailyReport_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DailyReport_editadoPorId_fkey" FOREIGN KEY ("editadoPorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConsultaLinea" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reporteId" TEXT NOT NULL,
    "especialidadId" TEXT NOT NULL,
    "totalUsd" REAL NOT NULL DEFAULT 0,
    "totalBs" REAL NOT NULL DEFAULT 0,
    "numPacientes" INTEGER NOT NULL DEFAULT 0,
    "porcentajeClinica" REAL NOT NULL DEFAULT 0,
    "comentarios" TEXT,
    CONSTRAINT "ConsultaLinea_reporteId_fkey" FOREIGN KEY ("reporteId") REFERENCES "DailyReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConsultaLinea_especialidadId_fkey" FOREIGN KEY ("especialidadId") REFERENCES "Especialidad" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ServicioLinea" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reporteId" TEXT NOT NULL,
    "unidadServicioId" TEXT NOT NULL,
    "totalUsd" REAL NOT NULL DEFAULT 0,
    "totalBs" REAL NOT NULL DEFAULT 0,
    "numPacientes" INTEGER NOT NULL DEFAULT 0,
    "porcentajeClinica" REAL NOT NULL DEFAULT 0,
    "comentarios" TEXT,
    CONSTRAINT "ServicioLinea_reporteId_fkey" FOREIGN KEY ("reporteId") REFERENCES "DailyReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ServicioLinea_unidadServicioId_fkey" FOREIGN KEY ("unidadServicioId") REFERENCES "UnidadServicio" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PacienteArea" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reporteId" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "numPacientes" INTEGER NOT NULL DEFAULT 0,
    "comentarios" TEXT,
    CONSTRAINT "PacienteArea_reporteId_fkey" FOREIGN KEY ("reporteId") REFERENCES "DailyReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Anticipo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reporteId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "totalUsd" REAL NOT NULL DEFAULT 0,
    "totalBs" REAL NOT NULL DEFAULT 0,
    "numPacientes" INTEGER NOT NULL DEFAULT 1,
    "pacienteNombre" TEXT,
    "comentarios" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    CONSTRAINT "Anticipo_reporteId_fkey" FOREIGN KEY ("reporteId") REFERENCES "DailyReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CuentaPorCobrar" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reporteId" TEXT NOT NULL,
    "nombreConvenio" TEXT NOT NULL,
    "totalUsd" REAL NOT NULL DEFAULT 0,
    "totalBs" REAL NOT NULL DEFAULT 0,
    "numPacientes" INTEGER NOT NULL DEFAULT 0,
    "comentarios" TEXT,
    CONSTRAINT "CuentaPorCobrar_reporteId_fkey" FOREIGN KEY ("reporteId") REFERENCES "DailyReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "APS" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reporteId" TEXT NOT NULL,
    "consultas" INTEGER NOT NULL DEFAULT 0,
    "laboratoriosImagenes" INTEGER NOT NULL DEFAULT 0,
    "movimientosDia" INTEGER NOT NULL DEFAULT 0,
    "totalFacturados" INTEGER NOT NULL DEFAULT 0,
    "noFacturadosComentarios" TEXT,
    "facturadosComentarios" TEXT,
    CONSTRAINT "APS_reporteId_fkey" FOREIGN KEY ("reporteId") REFERENCES "DailyReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Especialidad_codigo_key" ON "Especialidad"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Especialidad_nombre_key" ON "Especialidad"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "UnidadServicio_codigo_key" ON "UnidadServicio"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "UnidadServicio_nombre_key" ON "UnidadServicio"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "DailyReport_fecha_key" ON "DailyReport"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "ConsultaLinea_reporteId_especialidadId_key" ON "ConsultaLinea"("reporteId", "especialidadId");

-- CreateIndex
CREATE UNIQUE INDEX "ServicioLinea_reporteId_unidadServicioId_key" ON "ServicioLinea"("reporteId", "unidadServicioId");

-- CreateIndex
CREATE UNIQUE INDEX "PacienteArea_reporteId_area_key" ON "PacienteArea"("reporteId", "area");

-- CreateIndex
CREATE UNIQUE INDEX "APS_reporteId_key" ON "APS"("reporteId");
