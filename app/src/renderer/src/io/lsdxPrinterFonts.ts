/**
 * 原版 LabelShop 的打印机内建字库名单（从 LabelShop.exe 的 UTF-16 字符串表提取）。
 *
 * 原版把驱动/机型的内建字库按显示名保存（`GP Font 3`、`Zebra Font A`），字形在打印机 ROM，
 * PC 端没有字体文件。本程序支持 TSPL / ZPL / CPCL / ESC-POS / EPL / TPCL / SATO，因此这里分四类：
 *  - verified：已用真机/现场模板确认的映射（GP、Tsc、Zebra）；
 *  - tspl-family / zpl-family / tpcl-family / sato-family：同族机型（ZJ/XP/BY/RTA/JQTEK/Argox/Postek、
 *    EZ、TEC、SATO）按目标字库编号推断，导入时给出提示，请确认目标打印机指令族；
 *  - unsupported：SATO/Datamax/Intermec/Printronix 等私有指令集，或没有协议编号的
 *    CJK/OCR/软字体（HPRT Font16、TSS24.BF2…）。只能识别并告警，不能假装支持。
 */
export type LsdxPrinterFontMatch =
  | { kind: 'mapped'; font: string; family: 'verified' | 'tspl-family' | 'zpl-family' | 'tpcl-family' | 'sato-family' | 'pgl-family' }
  | { kind: 'unsupported'; brand: string; reason: string }

/** TSPL/PPLA 同族、字库编号直接对应 Font0–8 的机型前缀（含现场模板里的 Gprinter/XPrinter 写法）。 */
const TSPL_FAMILIES = ['Gprinter', 'GP', 'Tsc', 'XPrinter', 'XP', 'ZJ', 'BY', 'RTA', 'JQTEK', 'Argox', 'Postek']

/** 私有指令集/无法对应标准字库的厂商前缀。 */
const UNSUPPORTED_BRANDS = ['Datamax', 'Intermec', 'HPRT', 'EPOS', 'ZICOX', 'AIYIN', 'iZM', 'REGO', 'Weiting', 'LEDEN', 'QR']

/** 打印机可下载软字体 / TrueType 文件名：不是 ROM 字库，按普通字体处理。 */
const SOFT_FONT = /^(ROMAN\.TTF|TSS\d+\.BF2|\\?OCR-[AB]\.TTF|OCR-[AB](\s+\d+\s+Pitch)?\s+BT|LEDEN OCR-B)$/i

export function matchLsdxPrinterFont(face: string | null | undefined): LsdxPrinterFontMatch | undefined {
  const name = (face ?? '').trim()
  if (!name) return undefined
  if (SOFT_FONT.test(name)) return undefined

  // Zebra：ZPL 内建字库 A–Z / 0–9；Scalable 就是 ZPL 的可缩放字库 0。
  const zebra = /^Zebra\s*(?:Font\s*([A-Z0-9])|Scalable)$/i.exec(name)
  if (zebra) return { kind: 'mapped', font: zebra[1] ? zebra[1].toUpperCase() : '0', family: 'verified' }
  if (/^Zebra\s+OCR\s+[AB]$/i.test(name)) {
    return { kind: 'unsupported', brand: 'Zebra', reason: 'ZPL 的 OCR 字库没有对应的标准字库编号' }
  }

  // EZPL（GoDEX）是 ZPL 同族：EZ Font A–I → ZPL A–I，导入时提示确认指令族。
  const ez = /^EZ\s*Font\s*([A-I])$/i.exec(name)
  if (ez) return { kind: 'mapped', font: ez[1].toUpperCase(), family: 'zpl-family' }
  if (/^EZ\b/i.test(name)) return { kind: 'unsupported', brand: 'EZ', reason: '该字库没有可对应的 ZPL 字库编号' }

  // TEC 即 TPCL 厂商：TEC Font A–F/K 与 TPCL 内建字库编号一致，可直接映射。
  const tec = /^TEC\s*Font\s*([A-FK])$/i.exec(name)
  if (tec) return { kind: 'mapped', font: tec[1].toUpperCase(), family: 'tpcl-family' }
  if (/^TEC\s*Font\s*[G-JL-R]$/i.test(name)) {
    return { kind: 'unsupported', brand: 'TEC', reason: '该 TEC 字库尚未校准，暂按普通字体导入' }
  }
  if (/^TEC\b/i.test(name)) return { kind: 'unsupported', brand: 'TEC', reason: 'OCR 字库没有对应的 TPCL 字库编号' }

  // PGL 只提供 OCR-A/OCR-B，LabelShop 输出 ALPHA C10A/C10B。
  const pgl = /^Printronix\s*OCR[- ]?([AB])$/i.exec(name)
  if (pgl) return { kind: 'mapped', font: 'O' + pgl[1].toUpperCase(), family: 'pgl-family' }
  if (/^Printronix\b/i.test(name)) {
    return { kind: 'unsupported', brand: 'Printronix', reason: '该字库没有可对应的 PGL OCR 字库编号' }
  }

  // SATO SBPL 的字库命令字母与 LabelShop 显示名一致：SATO Font U → ESC U。
  const sato = /^SATO\s*Font\s*(M|S|U|WB|WL|XB|XL|XM|XS|XU|OA|OB)$/i.exec(name)
  if (sato) return { kind: 'mapped', font: sato[1].toUpperCase(), family: 'sato-family' }
  if (/^SATO\s*OCR\s*[AB]$/i.test(name)) {
    return { kind: 'mapped', font: /OCR\s*B$/i.test(name) ? 'OB' : 'OA', family: 'sato-family' }
  }
  if (/^SATO\b/i.test(name)) return { kind: 'unsupported', brand: 'SATO', reason: '该字库没有可对应的 SATO 字库编号' }

  // 同族机型的 FontN → TSPL FontN；GP/Tsc 已确认，其余为同族推断。
  const familyMatch = /^(Gprinter|GP|Tsc|XPrinter|XP|ZJ|BY|RTA|JQTEK|Argox|Postek)\s*Font\s*([0-8])$/i.exec(name)
  if (familyMatch) {
    const brand = familyMatch[1]
    const verified = /^(GP|Tsc)$/i.test(brand)
    return { kind: 'mapped', font: 'Font' + familyMatch[2], family: verified ? 'verified' : 'tspl-family' }
  }
  const familyPrefix = new RegExp('^(' + TSPL_FAMILIES.join('|') + ')\\b', 'i').exec(name)
  if (familyPrefix) {
    return { kind: 'unsupported', brand: familyPrefix[1], reason: '该机型字库没有可对应的 TSPL 字库编号' }
  }

  const brand = new RegExp('^(' + UNSUPPORTED_BRANDS.join('|') + ')\\b', 'i').exec(name)
  if (brand) {
    return { kind: 'unsupported', brand: brand[1], reason: '该厂商使用私有打印指令集，当前程序不支持' }
  }
  return undefined
}
