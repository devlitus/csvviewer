# Plan: Soporte de Múltiples Delimitadores CSV

## Análisis del Estado Actual

El parser actual (`src/lib/csvParser.ts`) tiene el delimitador `,` hardcodeado en la función `parseCSVLines` (línea 58). Esto hace que archivos CSV separados por `;` (punto y coma), común en Europa y Excel español, se lean como una sola columna enorme.

### Puntos de uso de `parseCSVString`:
- `src/scripts/uploadPage.ts` → validación durante upload
- `src/scripts/visualizerPage/utils/dataLoader.ts` → parse para visualización

---

## Solución Propuesta

### Enfoque: Auto-detección + Parámetro Opcional

1. **Auto-detección automática** del delimitador al parsear → sin fricción para el usuario
2. **Parámetro opcional** `delimiter?` en `parseCSVString` para override explícito (extensible al futuro)
3. **Retornar el delimitador detectado** en `CSVParseResult` para mostrarlo en la UI
4. **Indicador visual** en la toolbar del visualizador mostrando qué delimitador se detectó

### Delimitadores a soportar:
- `,` — coma (default, estándar)
- `;` — punto y coma (estándar europeo / Excel ES)
- `\t` — tabulador (TSV)

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/lib/types.ts` | Agregar `delimiter?: string` a `CSVParseResult` |
| `src/lib/csvParser.ts` | Agregar `detectDelimiter()` + parámetro `delimiter?` a `parseCSVString` |
| `src/scripts/uploadPage.ts` | Sin cambios (ya funciona, auto-detección transparente) |
| `src/scripts/visualizerPage/utils/dataLoader.ts` | Pasar `delimiter` detectado al resultado |
| `src/components/visualizer/DataToolbar.astro` | Agregar badge de delimitador detectado |
| `src/scripts/visualizerPage/rendering/toolbarRenderer.ts` | Renderizar badge del delimitador |

---

## Implementación Paso a Paso

### Paso 1 — `src/lib/types.ts`

Agregar campo `delimiter` a `CSVParseResult`:

```typescript
export interface CSVParseResult {
  data: Record<string, string>[];
  rowCount: number;
  delimiter?: string;   // ← NUEVO: delimitador detectado/usado
  error?: string;
}
```

---

### Paso 2 — `src/lib/csvParser.ts`

#### 2a. Agregar función `detectDelimiter(content: string): string`

Cuenta ocurrencias de cada delimitador candidato en la primera línea. El más frecuente gana.

```typescript
const SUPPORTED_DELIMITERS = [",", ";", "\t"] as const;

export function detectDelimiter(content: string): string {
  const firstLine = content.split(/\r?\n/)[0] ?? "";

  let bestDelimiter = ",";
  let bestCount = 0;

  for (const delimiter of SUPPORTED_DELIMITERS) {
    const count = firstLine.split(delimiter).length - 1;
    if (count > bestCount) {
      bestCount = count;
      bestDelimiter = delimiter;
    }
  }

  return bestDelimiter;
}
```

#### 2b. Modificar `parseCSVString` para aceptar `delimiter?`

```typescript
export function parseCSVString(
  content: string,
  delimiter?: string
): CSVParseResult {
  try {
    if (!content.trim()) {
      return { data: [], rowCount: 0, error: "File is empty" };
    }

    const resolvedDelimiter = delimiter ?? detectDelimiter(content);
    const lines = parseCSVLines(content.trim(), resolvedDelimiter);

    // ... resto igual ...

    return { data, rowCount: data.length, delimiter: resolvedDelimiter };
  } catch (err) {
    // ...
  }
}
```

#### 2c. Modificar `parseCSVLines` para aceptar el delimitador

Reemplazar el `char === ","` hardcodeado:

```typescript
function parseCSVLines(text: string, delimiter: string): string[][] {
  // ...
  } else if (char === delimiter) {   // ← en lugar de char === ","
  // ...
}
```

> **Nota:** Para `\t` (tabulador, longitud 1) esto funciona igual. Si en el futuro se necesitan delimitadores de múltiples caracteres, se requiere refactoring adicional.

---

### Paso 3 — `src/scripts/visualizerPage/utils/dataLoader.ts`

Incluir el `delimiter` en el resultado de `LoadSuccess`:

```typescript
export interface LoadSuccess {
  success: true;
  file: CSVFile;
  columns: string[];
  rows: Record<string, string>[];
  rowCount: number;
  delimiter: string;   // ← NUEVO
}
```

Y en `loadAndParseFile`, extraer y retornar el delimiter:

```typescript
return {
  success: true,
  file,
  columns: Object.keys(firstRow),
  rows: parseResult.data,
  rowCount: parseResult.rowCount,
  delimiter: parseResult.delimiter ?? ",",  // ← NUEVO
};
```

---

### Paso 4 — UI: Badge de delimitador en el Visualizador

#### 4a. `src/scripts/visualizerPage/core/dataStore.ts`

Almacenar el delimiter detectado en el store de datos.

#### 4b. `src/components/visualizer/DataToolbar.astro`

Agregar un badge discreto junto a los controles existentes:

```
[ Rows: 25 ▼ ]  [ Delimiter: ; ]  [ 🔍 Filter ]  [ Export ↓ ]
```

El badge muestra: `,` → "CSV (coma)", `;` → "CSV (punto y coma)", `\t` → "TSV (tab)"

#### 4c. `src/scripts/visualizerPage/rendering/toolbarRenderer.ts`

Actualizar la función de renderizado de la toolbar para incluir el badge.

---

## Lógica de Auto-detección

```
Primera línea del CSV:
  "nombre;edad;ciudad"   → cuenta: ; → 2, , → 0, \t → 0  → delimitador: ";"
  "name,age,city"        → cuenta: , → 2, ; → 0, \t → 0  → delimitador: ","
  "name\tage\tcity"      → cuenta: \t → 2, , → 0, ; → 0  → delimitador: "\t"
  "nombre"               → todos → 0                       → default: ","
```

---

## Consideraciones

- **Retrocompatibilidad total**: `parseCSVString(content)` sin segundo parámetro funciona igual que antes gracias a auto-detección
- **Sin cambios en IndexedDB**: el archivo se guarda como está, sin guardar el delimiter (se re-detecta al visualizar)
- **Edge case**: archivos con igual cantidad de `,` y `;` → el orden en `SUPPORTED_DELIMITERS` define la prioridad (`,` primero)
- **No requiere cambios en upload**: la validación en upload también se beneficia automáticamente

---

## Archivos Nuevos

Ninguno. Solo modificaciones de archivos existentes.

---

## Orden de Implementación

1. `src/lib/types.ts` (agregar campo)
2. `src/lib/csvParser.ts` (lógica principal)
3. `src/scripts/visualizerPage/utils/dataLoader.ts` (propagar delimiter)
4. `src/scripts/visualizerPage/core/dataStore.ts` (almacenar delimiter)
5. `src/scripts/visualizerPage/rendering/toolbarRenderer.ts` (renderizar badge)
6. `src/components/visualizer/DataToolbar.astro` (slot para badge en HTML)

---

**Creado:** 2026-03-04
**Scope:** `parser`, `visualizer`
