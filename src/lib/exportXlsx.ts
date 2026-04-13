import ExcelJS from 'exceljs'

export interface ExportLine {
  systemId: string
  upc: string
  name: string
  qty: number
}

/** Trigger a browser file download from a blob */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Sanitize a string for use in a filename */
function safeName(s: string): string {
  return s.replace(/[^a-zA-Z0-9 _-]/g, '').trim().replace(/\s+/g, '_')
}

/**
 * ETP template export — matches po_import_sample.xlsx exactly.
 * Sheet: po_import_sample
 * Columns: system_id, upc, quantity (bold header, no fill, plain data rows)
 */
export async function exportEtpXlsx(
  lines: ExportLine[],
  orderTitle: string,
): Promise<void> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Four Dogs Central'
  wb.created = new Date()

  const ws = wb.addWorksheet('po_import_sample')

  ws.columns = [
    { header: 'system_id', key: 'systemId', width: 20 },
    { header: 'upc',       key: 'upc',      width: 16 },
    { header: 'quantity',  key: 'qty',      width: 12 },
  ]

  // Bold header row, matching the sample template exactly
  const headerRow = ws.getRow(1)
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 10, bold: true }
  })

  // Data rows — only lines with qty > 0
  for (const line of lines.filter((l) => l.qty > 0)) {
    ws.addRow({ systemId: line.systemId, upc: line.upc, qty: line.qty })
  }

  const buf = await wb.xlsx.writeBuffer()
  downloadBlob(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `ETP_${safeName(orderTitle)}.xlsx`,
  )
}

/**
 * Full export — SystemID, UPC, Name, Qty with a branded header row.
 */
export async function exportFullXlsx(
  lines: ExportLine[],
  orderTitle: string,
): Promise<void> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Four Dogs Central'
  wb.created = new Date()

  const ws = wb.addWorksheet('Order')

  // Row 1: fancy title spanning all columns
  ws.mergeCells('A1:D1')
  const titleCell = ws.getCell('A1')
  titleCell.value = orderTitle
  titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF762123' } }
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
  ws.getRow(1).height = 28

  // Row 2: column headers
  ws.columns = [
    { key: 'systemId', width: 20 },
    { key: 'upc',      width: 16 },
    { key: 'name',     width: 48 },
    { key: 'qty',      width: 10 },
  ]
  const colHeaders = ['SystemID', 'UPC', 'Name', 'Qty']
  const headerRow = ws.getRow(2)
  colHeaders.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = h
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF006A71' } }
    cell.alignment = { vertical: 'middle', horizontal: i === 0 || i === 3 ? 'center' : 'left' }
  })
  headerRow.height = 20

  // Data rows
  const activeLines = lines.filter((l) => l.qty > 0)
  activeLines.forEach((line, idx) => {
    const row = ws.getRow(idx + 3)
    row.getCell(1).value = line.systemId
    row.getCell(2).value = line.upc
    row.getCell(3).value = line.name
    row.getCell(4).value = line.qty
    // Alternate row shading
    if (idx % 2 === 0) {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7E4' } }
      })
    }
    row.getCell(4).alignment = { horizontal: 'center' }
  })

  // Freeze panes below the two header rows
  ws.views = [{ state: 'frozen', ySplit: 2 }]

  const buf = await wb.xlsx.writeBuffer()
  downloadBlob(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `Order_${safeName(orderTitle)}.xlsx`,
  )
}
