import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/roles";
import { clasificarConvenio } from "@/lib/devaluacion";
import { ConveniosClient, type ConvenioRow, type DuplicadoPar } from "./convenios-client";

export const dynamic = "force-dynamic";

// Normaliza para detectar variantes ortográficas
const normalizar = (s: string): string =>
  s
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,;:/\\()&"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Levenshtein con cutoff
function distancia(a: string, b: string, max = 3): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      if (dp[i][j] < rowMin) rowMin = dp[i][j];
    }
    if (rowMin > max) return max + 1;
  }
  return dp[m][n];
}

export default async function ConveniosAdminPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isAdmin(role)) redirect("/");

  const cuentas = await prisma.cuentaPorCobrar.findMany({
    include: { reporte: { select: { fecha: true, tasaCambio: true } } },
    orderBy: { reporte: { fecha: "asc" } },
  });

  // Agrupar por nombre exacto (ya no hay variantes ortográficas tras Fase 2A)
  type Agg = {
    nombre: string;
    tipo: "SEGURO" | "ANUALIDAD" | "OTRO";
    apariciones: number;
    primeraFecha: Date;
    ultimaFecha: Date;
    tasaOrigen: number;
    saldoActualBs: number;
    saldoActualUsd: number;
  };
  const map = new Map<string, Agg>();
  for (const c of cuentas) {
    const key = c.nombreConvenio;
    const fecha = c.reporte.fecha;
    const tasa = c.reporte.tasaCambio || 1;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        nombre: c.nombreConvenio,
        tipo: clasificarConvenio(c.nombreConvenio),
        apariciones: 1,
        primeraFecha: fecha,
        ultimaFecha: fecha,
        tasaOrigen: tasa,
        saldoActualBs: c.totalBs,
        saldoActualUsd: c.totalBs / tasa,
      });
    } else {
      existing.apariciones += 1;
      if (fecha < existing.primeraFecha) {
        existing.primeraFecha = fecha;
        existing.tasaOrigen = tasa;
      }
      if (fecha >= existing.ultimaFecha) {
        existing.ultimaFecha = fecha;
        existing.saldoActualBs = c.totalBs;
        existing.saldoActualUsd = c.totalBs / tasa;
      }
    }
  }

  const convenios: ConvenioRow[] = Array.from(map.values())
    .map((v) => ({
      nombre: v.nombre,
      tipo: v.tipo,
      apariciones: v.apariciones,
      saldoActualBs: v.saldoActualBs,
      saldoActualUsd: v.saldoActualUsd,
      primeraFecha: v.primeraFecha.toISOString(),
      ultimaFecha: v.ultimaFecha.toISOString(),
    }))
    .sort((a, b) => b.apariciones - a.apariciones);

  // ── Buscar duplicados por similitud ──────────────────────────────────
  const normInfo = convenios.map((c) => ({
    nombre: c.nombre,
    norm: normalizar(c.nombre),
    apariciones: c.apariciones,
    saldoBs: c.saldoActualBs,
    saldoUsd: c.saldoActualUsd,
    tipo: c.tipo,
  }));

  const duplicados: DuplicadoPar[] = [];
  // Heurística: ignorar diferencias que se ven como montos (ANUALIDAD 100$ vs 200$)
  const pareceMontoDistinto = (a: string, b: string) => {
    // Si ambos tienen un número distinto al final, son convenios diferentes
    const numA = a.match(/(\d+)\s*\$?\s*$/)?.[1];
    const numB = b.match(/(\d+)\s*\$?\s*$/)?.[1];
    return numA && numB && numA !== numB;
  };

  for (let i = 0; i < normInfo.length; i++) {
    for (let j = i + 1; j < normInfo.length; j++) {
      const A = normInfo[i];
      const B = normInfo[j];
      if (Math.abs(A.norm.length - B.norm.length) > 3) continue;
      if (pareceMontoDistinto(A.norm, B.norm)) continue;
      const d = distancia(A.norm, B.norm, 3);
      if (d <= 3) {
        duplicados.push({
          a: A.nombre,
          b: B.nombre,
          distancia: d,
          aparA: A.apariciones,
          aparB: B.apariciones,
          saldoA: A.saldoBs,
          saldoB: B.saldoBs,
          tipoA: A.tipo,
          tipoB: B.tipo,
        });
      }
    }
  }

  // Ordenar: menor distancia primero, luego los de mayor impacto
  duplicados.sort((x, y) => {
    if (x.distancia !== y.distancia) return x.distancia - y.distancia;
    return y.aparA + y.aparB - (x.aparA + x.aparB);
  });

  return (
    <ConveniosClient
      convenios={convenios}
      duplicados={duplicados.slice(0, 50)}
      totalDuplicados={duplicados.length}
    />
  );
}
