import { CLASES_REQUIEREN_REACTIVO } from './cartValidation'
import { sanitizeText } from './validation'

export const CLASES_CON_GRUPO = ['Reactivo', ...CLASES_REQUIEREN_REACTIVO]

/**
 * Normaliza código leído desde ODS/XLSX (guiones unicode, espacios, números).
 */
export function normalizeCodigo(codigoRaw) {
  if (codigoRaw == null || codigoRaw === '') return ''

  const str =
    typeof codigoRaw === 'number'
      ? String(codigoRaw)
      : String(codigoRaw).trim()

  return str
    .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D/－\u00AD]/g, '-')
    .replace(/[^\w.-]/g, '')
}

/**
 * Grupo de prueba derivado del código:
 * - 02G22-01 → 02G22
 * - 006C3727 (sin guion) → 006C3727
 */
export function deriveGrupoFromCodigo(codigo) {
  const normalized = normalizeCodigo(codigo)
  if (!normalized) return null

  const idx = normalized.lastIndexOf('-')
  if (idx > 0) {
    return sanitizeText(normalized.slice(0, idx), 100) || null
  }

  return sanitizeText(normalized, 100) || null
}

/**
 * Resuelve grupo_prueba: columna Grupo del ODS, o derivado del código.
 */
export function resolveGrupoPrueba({ codigo, clase, grupo_prueba }) {
  const explicit = sanitizeText(grupo_prueba, 100) || null
  if (explicit) return explicit

  if (!CLASES_CON_GRUPO.includes(clase)) return null

  return deriveGrupoFromCodigo(codigo)
}

export function requiereGrupoPrueba(clase) {
  return CLASES_CON_GRUPO.includes(clase)
}

export function mensajeGrupoPruebaFaltante(codigo, clase) {
  return `Reactivo, Calibrador y Control requieren grupo de prueba (columna Grupo alineada con los datos, o prefijo del código): ${codigo} (${clase})`
}
