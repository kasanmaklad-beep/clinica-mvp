import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canEditReports } from "@/lib/roles";
import { parsePdfText } from "@/lib/pdf-parser";
import { randomUUID } from "crypto";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const role = (session.user as { role?: string }).role;
  if (!canEditReports(role))
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const userId = (session.user as { id: string }).id;

  // ── Leer el archivo ────────────────────────────────────────────────────
  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file)
    return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 });

  let parsed;
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buf });
    const result = await parser.getText();
    parsed = parsePdfText(result.text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `No se pudo leer el PDF: ${msg}` },
      { status: 400 }
    );
  }

  // ── Verificar duplicado ────────────────────────────────────────────────
  const fechaDate = new Date(parsed.fecha + "T12:00:00.000Z");
  const existing = await prisma.dailyReport.findUnique({
    where: { fecha: fechaDate },
  });
  if (existing) {
    return NextResponse.json(
      { error: `Ya existe un reporte para ${parsed.fecha}`, id: existing.id },
      { status: 409 }
    );
  }

  // ── Cargar catálogos ───────────────────────────────────────────────────
  const [espList, unidList] = await Promise.all([
    prisma.especialidad.findMany(),
    prisma.unidadServicio.findMany(),
  ]);

  // Mapa por código y por nombre normalizado
  const espByCodigo = new Map(espList.map((e) => [e.codigo, e]));
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  const unidByNombre = new Map(unidList.map((u) => [norm(u.nombre), u]));

  let maxUnidCodigo = Math.max(0, ...unidList.map((u) => u.codigo));
  const warnings: string[] = [];

  // ── Helper: obtener/crear especialidad ─────────────────────────────────
  const getEsp = async (codigo: number, nombre: string) => {
    if (espByCodigo.has(codigo)) return espByCodigo.get(codigo)!;
    // Intento por nombre normalizado
    const byName = espList.find((e) => norm(e.nombre) === norm(nombre));
    if (byName) return byName;
    // Crear nueva
    const nueva = await prisma.especialidad.create({
      data: {
        id: randomUUID(),
        codigo,
        nombre,
        honorarioClinica: 10,
        modeloNegocio: "Fijo por paciente",
        orden: codigo,
        activa: true,
      },
    });
    espByCodigo.set(codigo, nueva);
    warnings.push(`Nueva especialidad creada: "${nombre}" (código ${codigo})`);
    return nueva;
  };

  // ── Helper: obtener/crear unidad de servicio ───────────────────────────
  const getUnid = async (nombre: string) => {
    const key = norm(nombre);
    if (unidByNombre.has(key)) return unidByNombre.get(key)!;
    maxUnidCodigo += 1;
    const nueva = await prisma.unidadServicio.create({
      data: {
        id: randomUUID(),
        codigo: maxUnidCodigo,
        nombre,
        categoria: "SERVICIO",
        orden: maxUnidCodigo,
        activa: true,
      },
    });
    unidByNombre.set(key, nueva);
    warnings.push(`Nueva unidad de servicio creada: "${nombre}"`);
    return nueva;
  };

  // ── Resolver IDs antes de crear el reporte ─────────────────────────────
  const consultasData = await Promise.all(
    parsed.consultas.map(async (c) => {
      const esp = await getEsp(c.codigo, c.nombre);
      return {
        id: randomUUID(),
        especialidadId: esp.id,
        numPacientes: c.numPacientes,
        totalBs: c.totalBs,
        ingresoDivisa: c.ingresoDivisa,
        porcentajeClinica: c.porcentajeClinica,
      };
    })
  );

  const serviciosData = await Promise.all(
    parsed.servicios.map(async (s) => {
      const unid = await getUnid(s.nombre);
      return {
        id: randomUUID(),
        unidadServicioId: unid.id,
        numPacientes: s.numPacientes,
        totalBs: s.totalBs,
        ingresoDivisa: s.ingresoDivisa,
        porcentajeClinica: 0,
      };
    })
  );

  const pacientesData = parsed.pacientesArea.map((p) => ({
    id: randomUUID(),
    area: p.area,
    numPacientes: p.numPacientes,
  }));

  const anticiposData = parsed.anticipos.map((a) => ({
    id: randomUUID(),
    tipo: a.tipo as "HOSPITALIZACION" | "EMERGENCIA" | "ESTUDIOS",
    totalBs: a.totalBs,
    ingresoDivisa: a.ingresoDivisa,
    numPacientes: 1,
    pacienteNombre: a.pacienteNombre,
    estado: "PENDIENTE" as const,
  }));

  const cuentasData = parsed.cuentas.map((c) => ({
    id: randomUUID(),
    nombreConvenio: c.nombreConvenio,
    totalBs: c.totalBs,
    ingresoDivisa: c.ingresoDivisa,
    numPacientes: 0,
  }));

  // ── Crear reporte en DB ────────────────────────────────────────────────
  const reporte = await prisma.dailyReport.create({
    data: {
      id: randomUUID(),
      fecha: fechaDate,
      tasaCambio: parsed.tasaCambio,
      estado: "CERRADO",
      cerradoAt: new Date(),
      creadoPorId: userId,
      consultas: { create: consultasData },
      servicios: { create: serviciosData },
      pacientesArea: { create: pacientesData },
      anticipos: { create: anticiposData },
      cuentasPorCobrar: { create: cuentasData },
      ...(parsed.aps
        ? {
            aps: {
              create: {
                id: randomUUID(),
                consultas: parsed.aps.consultas,
                laboratoriosImagenes: parsed.aps.laboratoriosImagenes,
                movimientosDia: parsed.aps.movimientosDia,
                totalFacturados: parsed.aps.totalFacturados,
                noFacturadosComentarios: "No Facturados dependen de resultados",
                facturadosComentarios: "Facturados de servicios anteriores",
              },
            },
          }
        : {}),
    },
  });

  return NextResponse.json({
    id: reporte.id,
    fecha: parsed.fecha,
    resumen: {
      consultas: consultasData.length,
      servicios: serviciosData.length,
      anticipos: anticiposData.length,
      pacientesArea: pacientesData.length,
      cuentas: cuentasData.length,
      aps: parsed.aps ? 1 : 0,
    },
    warnings,
  });
}
