// Client-side downloads of table data as CSV or XLSX.

export type ExportValue = string | number

export interface ExportSheet {
  headers: string[]
  rows: ExportValue[][]
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

// Names are free text: a leading quote stops a spreadsheet from running one
// that starts with "=" as a formula.
function csvCell(value: ExportValue): string {
  if (typeof value === 'number') return String(value)
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}

export function toCsv({ headers, rows }: ExportSheet): string {
  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
}

export function downloadCsv(sheet: ExportSheet, fileName: string) {
  // The BOM makes Excel read the file as UTF-8.
  saveBlob(new Blob(['﻿', toCsv(sheet)], { type: 'text/csv;charset=utf-8' }), fileName)
}

// The library is loaded on demand, to keep it out of the main bundle.
export async function downloadXlsx({ headers, rows }: ExportSheet, fileName: string) {
  const { default: writeExcelFile } = await import('write-excel-file/browser')
  saveBlob(await writeExcelFile([headers, ...rows]).toBlob(), fileName)
}
