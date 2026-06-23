import * as XLSX from 'xlsx'
import { CATEGORIA_KEYS, MAX_FILE_SIZE_BYTES } from './constants'
import { sanitizeText } from './validation'

const CLASE_MAP = {
  reagent: 'Reactivo',
  calibrator: 'Calibrador',
  consumable: 'Consumible',
  control: 'Control',
  mcc: 'MCC',
  reactivo: 'Reactivo',
  calibrador: 'Calibrador',
  consumible: 'Consumible',
}

const HEADER_ALIASES = {
  codigo: 'codigo',
  descripcion: 'descripcion',
  clase: 'clase',
  costo: 'costo',
}

function normalizeHeader(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function isEmptyRow(row) {
  return row.every((cell) => String(cell ?? '').trim() === '')
}

function isHeaderValue(value) {
  const normalized = normalizeHeader(value)
  return normalized === 'codigo' || normalized === 'descripcion' || normalized === 'clase' || normalized === 'costo'
}

function parseCosto(value) {
  if (value == null || value === '') return null

  const parsed = typeof value === 'number'
    ? value
    : Number(String(value).replace(/[$,\s]/g, ''))

  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.round(parsed * 100) / 100
}

function normalizeClase(value) {
  const key = normalizeHeader(value)
  return CLASE_MAP[key] ?? null
}

function findHeaderRow(rows) {
  for (let i = 0; i < rows.length; i += 1) {
    const normalized = rows[i].map(normalizeHeader)
    const hasCodigo = normalized.includes('codigo')
    const hasCosto = normalized.includes('costo')

    if (hasCodigo && hasCosto) {
      const columnMap = {}
      normalized.forEach((header, index) => {
        if (HEADER_ALIASES[header]) {
          columnMap[HEADER_ALIASES[header]] = index
        }
      })

      if (
        columnMap.codigo != null &&
        columnMap.descripcion != null &&
        columnMap.clase != null &&
        columnMap.costo != null
      ) {
        return { headerIndex: i, columnMap }
      }
    }
  }

  return null
}

function validateCategoria(categoria) {
  if (!CATEGORIA_KEYS.includes(categoria)) {
    throw new Error('Categoría inválida')
  }
}

function validateFile(file) {
  if (!file) throw new Error('Seleccione un archivo')
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error('El archivo supera el límite de 10 MB')
  }

  const name = file.name.toLowerCase()
  const validExtension = ['.ods', '.xlsx', '.xls'].some((ext) => name.endsWith(ext))
  if (!validExtension) {
    throw new Error('Formato no soportado. Use archivos ODS o XLSX')
  }
}

/**
 * Parsea un archivo ODS/XLSX y devuelve filas válidas + errores por fila.
 */
export async function parseODSFile(file, categoria) {
  validateCategoria(categoria)
  validateFile(file)

  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false })

  if (!workbook.SheetNames.length) {
    throw new Error('El archivo no contiene hojas de cálculo')
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

  const headerInfo = findHeaderRow(rows)
  if (!headerInfo) {
    throw new Error('No se encontraron las columnas Codigo, Descripcion, Clase y Costo')
  }

  const { headerIndex, columnMap } = headerInfo
  const validRows = []
  const errors = []
  let totalFilas = 0

  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const row = rows[i]
    if (isEmptyRow(row)) continue

    totalFilas += 1
    const rowNumber = i + 1
    const codigoRaw = row[columnMap.codigo]
    const descripcionRaw = row[columnMap.descripcion]
    const claseRaw = row[columnMap.clase]
    const costoRaw = row[columnMap.costo]

    const codigo = sanitizeText(codigoRaw, 50)

    if (!codigo || isHeaderValue(codigo)) continue

    const costo = parseCosto(costoRaw)
    if (costo == null) {
      if (codigoRaw === '' || codigoRaw == null || costoRaw === '' || costoRaw == null) {
        continue
      }
      errors.push({
        fila: rowNumber,
        codigo: codigo || '(vacío)',
        mensaje: 'Costo inválido o no positivo',
      })
      continue
    }

    const descripcion = sanitizeText(descripcionRaw, 500)
    if (!descripcion) {
      errors.push({
        fila: rowNumber,
        codigo,
        mensaje: 'Descripción vacía',
      })
      continue
    }

    const clase = normalizeClase(claseRaw)
    if (!clase) {
      errors.push({
        fila: rowNumber,
        codigo,
        mensaje: `Clase desconocida: "${sanitizeText(claseRaw, 50)}"`,
      })
      continue
    }

    validRows.push({
      codigo,
      descripcion,
      clase,
      precio_base: costo,
      categoria,
    })
  }

  return {
    validRows,
    errors,
    totalFilas,
  }
}
