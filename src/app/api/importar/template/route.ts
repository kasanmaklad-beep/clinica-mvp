import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canEditReports } from "@/lib/roles";
import * as XLSX from "xlsx";

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!canEditReports(role)) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const [especialidades, unidades] = await Promise.all([
    prisma.especialidad.findMany({ where: { activa: true }, orderBy: { orden: "asc" }, select: { nombre: true } }),
    prisma.unidadServicio.findMany({ where: { activa: true }, orderBy: { orden: "asc" }, select: { nombre: true } }),
  ]);

  const rows: (string | number)[][] = [];
  rows.push(["REPORTE DIARIO — HOSPITAL CLÍNICAS DEL ESTE"]);
  rows.push([]);
  rows.push(["INSTRUCCIONES:"]);
  rows.push(["1) Llene la Fecha (formato YYYY-MM-DD) y la Tasa del día."]);
  rows.push(["2) En cada sección complete solo las filas que apliquen. Deje en blanco las que no."]);
  rows.push(["3) No modifique el orden ni los títulos de sección."]);
  rows.push(["4) Guarde el archivo y súbalo en la sección 'Cargar Excel'."]);
  rows.push([]);
  rows.push(["Fecha (YYYY-MM-DD)", ""]);
  rows.push(["Tasa (Bs/$)", ""]);
  rows.push(["Observaciones", ""]);
  rows.push([]);
  rows.push(["CONSULTAS"]);
  rows.push(["Especialidad", "Pacientes", "Total Bs.", "Divisa $"]);
  for (const esp of especialidades) rows.push([esp.nombre, "", "", ""]);
  rows.push([]);
  rows.push(["LABORATORIO / IMÁGENES"]);
  rows.push(["Unidad", "Pacientes", "Total Bs.", "Divisa $"]);
  for (const uni of unidades) rows.push([uni.nombre, "", "", ""]);
  rows.push([]);
  rows.push(["PACIENTES POR ÁREA"]);
  rows.push(["Área", "Pacientes"]);
  rows.push(["Emergencia", ""]);
  rows.push(["Hospitalización", ""]);
  rows.push(["UCI", ""]);
  rows.push([]);
  rows.push(["ANTICIPOS (opcional)"]);
  rows.push(["Tipo", "Paciente", "Total Bs.", "Divisa $"]);
  rows.push(["(HOSPITALIZACION / EMERGENCIA / ESTUDIOS)", "", "", ""]);
  for (let i = 0; i < 5; i++) rows.push(["", "", "", ""]);
  rows.push([]);
  rows.push(["APS (opcional)"]);
  rows.push(["Campo", "Valor"]);
  rows.push(["Consultas", ""]);
  rows.push(["Laboratorios/Imágenes", ""]);
  rows.push(["Movimientos del día", ""]);
  rows.push(["Total facturados", ""]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 44 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Reporte");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="plantilla-reporte.xlsx"`,
    },
  });
}
