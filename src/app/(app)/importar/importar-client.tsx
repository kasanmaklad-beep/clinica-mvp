"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Upload, CheckCircle, AlertCircle, AlertTriangle } from "lucide-react";

interface Resultado {
  id: string;
  fecha: string;
  resumen: { consultas: number; servicios: number; anticipos: number; pacientesArea: number; aps: number };
  warnings: string[];
}

export function ImportarClient() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<Resultado | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function subir() {
    if (!file) return;
    setUploading(true); setError(null); setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/importar", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al importar");
      } else {
        setResult(data);
        setFile(null);
        const input = document.getElementById("excel-input") as HTMLInputElement | null;
        if (input) input.value = "";
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-5 pb-10">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Cargar Excel</h1>
        <p className="text-[var(--muted-foreground)] mt-1 text-sm">Importar reportes diarios desde plantilla Excel</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Paso 1 — Descargar plantilla</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--muted-foreground)] mb-3">
            La plantilla incluye todas las especialidades y unidades activas. Llena una fecha por archivo.
          </p>
          <Button asChild variant="outline">
            <a href="/api/importar/template" download>
              <Download className="h-4 w-4" /> Descargar plantilla
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Paso 2 — Subir el archivo llenado</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <input
            id="excel-input"
            type="file"
            accept=".xlsx,.xls"
            onChange={e => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[var(--primary)] file:text-white file:cursor-pointer"
          />
          <div className="flex items-center gap-3">
            <Button onClick={subir} disabled={!file || uploading}>
              <Upload className="h-4 w-4" />{uploading ? "Subiendo..." : "Importar"}
            </Button>
            {file && <span className="text-xs text-[var(--muted-foreground)] truncate">{file.name}</span>}
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">
            El reporte se guarda directamente como <strong>CERRADO</strong>. El administrador puede editarlo después si es necesario.
          </p>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-300 bg-red-50 dark:bg-red-950/20">
          <CardContent className="py-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
            <div className="text-sm text-red-900 dark:text-red-300">{error}</div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className="border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20">
          <CardContent className="py-4 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
              <div className="font-semibold">Reporte importado: {result.fecha}</div>
            </div>
            <div className="text-sm text-[var(--muted-foreground)] flex flex-wrap gap-x-4 gap-y-1">
              <span>{result.resumen.consultas} consultas</span>
              <span>·</span>
              <span>{result.resumen.servicios} servicios</span>
              <span>·</span>
              <span>{result.resumen.anticipos} anticipos</span>
              <span>·</span>
              <span>{result.resumen.pacientesArea} áreas</span>
              {result.resumen.aps > 0 && <><span>·</span><span>APS ✓</span></>}
            </div>
            {result.warnings.length > 0 && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-300 p-3 text-sm">
                <div className="flex items-center gap-2 font-medium text-amber-900 dark:text-amber-300 mb-1">
                  <AlertTriangle className="h-4 w-4" /> Avisos
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-amber-900 dark:text-amber-300">
                  {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}
            <Button asChild size="sm">
              <Link href={`/reportes/${result.id}`}>Ver reporte</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
