import QRCode from 'qrcode'
import type { Compromiso } from '@/types/database'

// ─── Tipos internos ───────────────────────────────────────────────
interface CompromisoConDetalles extends Compromiso {
  banco_nombre?: string
  banco_entidad?: string
  cliente_nombre?: string
  cliente_entidad?: string
}

interface SolicitudParaPDF {
  id: string
  op_id?: string
  cliente_nombre?: string
  cliente_entidad?: string
  moneda: string
  monto?: number | null
  plazo: number
  tasa_objetivo?: number | null
  tipo_tasa?: string | null
  fecha_cierre: string
  notas?: string | null
  created_at: string
}

interface OfertaParaPDF {
  id: string
  tasa: number
  monto: number
  notas?: string | null
  created_at: string
  banco_nombre?: string
  banco_entidad?: string
  cliente_nombre?: string
  cliente_entidad?: string
  solicitud_plazo?: number
  solicitud_moneda?: string
}

// ─── Helper: generar QR como base64 PNG ──────────────────────────
async function generarQR(url: string): Promise<string> {
  try {
    return await QRCode.toDataURL(url, {
      width: 160,
      margin: 1,
      color: { dark: '#000000', light: '#FFFFFF' }
    })
  } catch {
    return ''
  }
}

// ─── Helper: abrir HTML en nueva ventana ─────────────────────────
function abrirHTML(html: string) {
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
}

// ─── Estilos CSS compartidos ─────────────────────────────────────
const estilosBase = `
  body { font-family: Arial, Helvetica, sans-serif; margin: 40px; line-height: 1.6; color: #333; }
  .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #4A90E2; }
  .header-top { display: flex; justify-content: space-between; align-items: flex-start; }
  .header-left { flex: 1; text-align: left; }
  .qr-box { text-align: center; }
  .qr-box img { width: 120px; height: 120px; }
  .qr-box p { font-size: 9px; color: #888; margin: 2px 0 0; }
  h1 { color: #4A90E2; font-size: 22px; margin-bottom: 5px; }
  .op-id { font-size: 16px; color: #666; font-weight: bold; }
  .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
  .badge-confirmado { background: #dbeafe; color: #1d4ed8; }
  .badge-ejecutado { background: #d1fae5; color: #065f46; }
  .badge-vigente { background: #d1fae5; color: #065f46; }
  .badge-vencido { background: #fee2e2; color: #991b1b; }
  .badge-cancelado { background: #f3f4f6; color: #6b7280; }
  .info-box { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
  .info-row { display: flex; gap: 40px; flex-wrap: wrap; }
  .info-item label { font-size: 11px; color: #888; display: block; margin-bottom: 2px; }
  .info-item strong { font-size: 14px; }
  table { width: 100%; border-collapse: collapse; margin: 20px 0; }
  th, td { border: 1px solid #ddd; padding: 10px 12px; text-align: left; }
  th { background-color: #4A90E2; color: white; }
  .section { margin: 28px 0; }
  .section-title { font-size: 16px; color: #4A90E2; margin-bottom: 10px; padding-bottom: 5px; border-bottom: 2px solid #4A90E2; }
  .terms { background: #fffbf0; padding: 12px 15px; border-left: 4px solid #f59e0b; margin: 12px 0; font-size: 13px; }
  .signatures { margin-top: 60px; display: flex; justify-content: space-between; }
  .signature-box { width: 44%; text-align: center; }
  .signature-line { border-top: 2px solid #333; margin-top: 60px; padding-top: 8px; font-size: 13px; }
  .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #999; border-top: 1px solid #ddd; padding-top: 15px; }
  .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 110px; color: rgba(74, 144, 226, 0.07); z-index: -1; font-weight: bold; }
  .highlight { font-size: 20px; font-weight: bold; color: #4A90E2; }
  .highlight-green { font-size: 20px; font-weight: bold; color: #10b981; }
  .stamp-box { border: 3px double #10b981; padding: 15px 25px; text-align: center; display: inline-block; margin: 20px 0; }
  .stamp-box h2 { color: #065f46; font-size: 20px; margin: 0; }
  .stamp-box p { color: #065f46; font-size: 13px; margin: 4px 0 0; }
`

// ─────────────────────────────────────────────────────────────────
// 1. PDF CONSTANCIA DE INTENCIÓN (antes: "Contrato")
// ─────────────────────────────────────────────────────────────────
export const generarPDFContrato = async (compromiso: CompromisoConDetalles) => {
  const verifyUrl = `${window.location.origin}?verify=${compromiso.id}`
  const qrSrc = await generarQR(verifyUrl)
  const esExterno = compromiso.es_externo === true
  const bancoLabel = esExterno
    ? (compromiso.contraparte_nombre || 'Institución Externa')
    : (compromiso.banco_entidad || 'Banco')
  const bancoRep = esExterno ? '—' : (compromiso.banco_nombre || '—')
  const intereses = (compromiso.monto * compromiso.tasa / 100 * compromiso.plazo) / 360
  const fmt = (v: number) => new Intl.NumberFormat('es-GT', { style: 'currency', currency: compromiso.moneda }).format(v)
  const monedaLabel = compromiso.moneda === 'USD' ? 'Dólares Estadounidenses (USD)' : 'Quetzales Guatemaltecos (GTQ)'
  const fechaCompromiso = compromiso.fecha_confirmacion
    ? new Date(compromiso.fecha_confirmacion).toLocaleDateString('es-GT')
    : new Date(compromiso.created_at).toLocaleDateString('es-GT')
  const fechaEjecucion = (compromiso as any).fecha_ejecucion
    ? new Date((compromiso as any).fecha_ejecucion).toLocaleDateString('es-GT')
    : '—'

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Constancia ${compromiso.op_id}</title>
<style>
${estilosBase}
.amount-big { font-size:26px; font-weight:900; color:#1e3a5f; }
.amount-int { font-size:26px; font-weight:900; color:#10b981; }
.amount-total { font-size:26px; font-weight:900; color:#4A90E2; }
.nature-note { font-size:9px; color:#aaa; margin:6px 0 16px; line-height:1.5; }
.para { font-size:12.5px; line-height:1.7; color:#444; margin:10px 0; }
.disclaimer-subtle { margin-top:24px; padding:10px 14px; font-size:10px; color:#aaa; border-top:1px solid #eee; line-height:1.6; }
</style></head><body>
<div class="watermark">PRELIMINAR</div>

<div class="header">
  <div class="header-top">
    <div class="header-left">
      <p style="font-size:11px;color:#888;margin:0 0 4px">FUNDLink AI</p>
      <h1 style="font-size:18px">CONSTANCIA DE INTENCIÓN DE COLOCACIÓN</h1>
      <div class="op-id" style="margin-top:6px">Número de Operación: ${compromiso.op_id}</div>
      <div style="margin-top:8px">
        <span class="badge badge-${compromiso.estado}">${compromiso.estado.toUpperCase()}</span>
      </div>
    </div>
    ${qrSrc ? `<div class="qr-box"><img src="${qrSrc}" alt="QR"><p>Verificar en FUNDLINK</p></div>` : ''}
  </div>
</div>

<p class="nature-note">Naturaleza del documento: La presente Constancia de Intención de Colocación es un documento preliminar generado tecnológicamente que refleja una manifestación de voluntad entre las partes. No constituye un contrato financiero, título ejecutivo ni genera obligación exigible por sí misma. No implica captación de fondos ni intermediación financiera. FUNDLINK, S.A. actúa únicamente como facilitador tecnológico neutral y no es parte de la relación jurídica o financiera.</p>

<div class="section">
  <div class="section-title">PARTES INTERVINIENTES</div>
  <table>
    <tr><th>Parte</th><th>Entidad</th><th>Representante</th></tr>
    <tr><td><strong>EL BANCO</strong></td><td>${bancoLabel}</td><td>${bancoRep}</td></tr>
    <tr><td><strong>EL CLIENTE</strong></td><td>${compromiso.cliente_entidad || '—'}</td><td>${compromiso.cliente_nombre || '—'}</td></tr>
  </table>
</div>

<div class="section">
  <div class="section-title">CONDICIONES FINANCIERAS</div>
  <div class="info-box" style="margin-bottom:14px">
    <div class="info-row" style="gap:50px">
      <div class="info-item">
        <label style="font-size:11px;font-weight:600;color:#555;text-transform:uppercase;letter-spacing:.5px">Monto Principal</label>
        <div class="amount-big">${fmt(compromiso.monto)}</div>
      </div>
      <div class="info-item">
        <label style="font-size:11px;font-weight:600;color:#555;text-transform:uppercase;letter-spacing:.5px">Intereses Estimados</label>
        <div class="amount-int">${fmt(intereses)}</div>
      </div>
      <div class="info-item">
        <label style="font-size:11px;font-weight:600;color:#555;text-transform:uppercase;letter-spacing:.5px">Monto al Cierre</label>
        <div class="amount-total">${fmt(compromiso.monto + intereses)}</div>
      </div>
    </div>
  </div>
  <table>
    <tr><th>Concepto</th><th>Detalle</th></tr>
    <tr><td><strong>Moneda</strong></td><td>${monedaLabel}</td></tr>
    <tr><td><strong>Tasa de Interés Anual</strong></td><td class="highlight-green">${compromiso.tasa}%</td></tr>
    <tr><td><strong>Plazo</strong></td><td>${compromiso.plazo} días calendario</td></tr>
    <tr><td><strong>Fecha de Inicio</strong></td><td>${new Date(compromiso.fecha_inicio).toLocaleDateString('es-GT')}</td></tr>
    <tr><td><strong>Fecha de Vencimiento</strong></td><td>${new Date(compromiso.fecha_vencimiento).toLocaleDateString('es-GT')}</td></tr>
    <tr><td><strong>Fecha de Compromiso</strong></td><td>${fechaCompromiso}</td></tr>
    <tr><td><strong>Fecha de Ejecución</strong></td><td>${fechaEjecucion}</td></tr>
  </table>
  <p style="font-size:10px;color:#aaa;margin-top:6px;font-style:italic">Los intereses son estimativos (base 30/360) y podrán ajustarse en el contrato definitivo.</p>
</div>

<div class="section">
  <div class="section-title">TÉRMINOS Y CONDICIONES</div>
  <p class="para">El BANCO declara que la oferta es preliminar y sujeta a aprobación interna, encontrándose la operación sujeta a KYC/AML, análisis de riesgo y políticas internas, sin que nazca ninguna obligación hasta la firma de contratos bancarios definitivos. El CLIENTE declara que su manifestación de intención es preliminar, que cuenta con facultades suficientes para emitirla, y que la ejecución dependerá de la firma de contratos definitivos con el BANCO. Este documento resume una oferta preliminar donde el Banco propone recibir fondos del Cliente por el plazo indicado, devengando intereses a la tasa estimada, sin que constituya un contrato vinculante. Los intereses se calcularán sobre la base 30/360, pagaderos al vencimiento junto con el principal, sujeto a ajustes en el contrato final. No se permite el prepago salvo acuerdo escrito entre las partes. Esta propuesta está sujeta a las políticas KYC/AML vigentes y a la legislación guatemalteca, incluyendo la Ley contra el Lavado de Dinero (Decreto 67-2001) y regulaciones de la Superintendencia de Bancos. Cualquier controversia se someterá a los tribunales competentes de la República de Guatemala (Código Civil, Decreto-Ley 106; Ley de Bancos y Grupos Financieros, Decreto 19-2002). FUNDLINK, S.A. no recibe ni custodia fondos, no actúa como intermediario financiero, no garantiza ejecución ni tasas, y actúa únicamente como proveedor tecnológico neutral.</p>
</div>

<div class="section">
  <div class="section-title">CLÁUSULAS ADICIONALES</div>
  <p class="para">La oferta se basa en los filtros de inversión del Cliente, y el Banco confirma capacidad bajo sus políticas internas, requiriéndose negociación directa para cualquier ajuste. La operación solo podrá ejecutarse cuando se hayan cumplido los procesos internos del BANCO, se haya firmado contrato financiero definitivo entre las partes, y se haya realizado la transferencia directa fuera de la plataforma. Las comisiones y costos aplicables se rigen exclusivamente por los contratos de plataforma suscritos entre FUNDLINK y el Banco. Ambas partes se comprometen a mantener la confidencialidad de los términos, conforme a la Ley de Acceso a la Información Pública (Decreto 57-2008). Cualquier ejecución futura estará sujeta a eventos de fuerza mayor conforme al Artículo 1424 del Código Civil. Cualquier modificación a los términos requiere acuerdo escrito entre las partes.</p>
</div>

${compromiso.notas ? `<div class="section"><div class="section-title">NOTAS DE LA OPERACIÓN</div><div class="info-box"><p>${compromiso.notas}</p></div></div>` : ''}

<div class="signatures">
  <div class="signature-box">
    <div class="signature-line">
      <strong>${bancoLabel}</strong><br>
      <small>${bancoRep}</small>
    </div>
  </div>
  <div class="signature-box">
    <div class="signature-line">
      <strong>${compromiso.cliente_entidad || '—'}</strong><br>
      <small>${compromiso.cliente_nombre || '—'}</small>
    </div>
  </div>
</div>

<p class="disclaimer-subtle">Este documento ha sido generado automáticamente por FundLinkAI como facilitador tecnológico neutral. No constituye un contrato vinculante ni realiza intermediación financiera (Artículo 3, Ley de Bancos y Grupos Financieros, Decreto 19-2002). Requiere firma física de un contrato definitivo entre las partes para tener validez legal. FundLink AI no asume responsabilidad por incumplimientos o disputas derivadas de esta propuesta. — ${verifyUrl}</p>
</body></html>`

  abrirHTML(html)
}

// ─────────────────────────────────────────────────────────────────
// 2. PDF EJECUTADO (Certificado de ejecución)
// ─────────────────────────────────────────────────────────────────
export const generarPDFEjecutado = async (compromiso: CompromisoConDetalles) => {
  const verifyUrl = `${window.location.origin}?verify=${compromiso.id}`
  const qrSrc = await generarQR(verifyUrl)
  const bancoLabel = compromiso.es_externo
    ? (compromiso.contraparte_nombre || 'Institución Externa')
    : (compromiso.banco_entidad || 'Banco')
  const fmt = (v: number) => new Intl.NumberFormat('es-GT', { style: 'currency', currency: compromiso.moneda }).format(v)
  const intereses = (compromiso.monto * compromiso.tasa / 100 * compromiso.plazo) / 360

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Certificado Ejecutado ${compromiso.op_id}</title>
<style>${estilosBase}</style></head><body>
<div class="watermark">EJECUTADO</div>

<div class="header">
  <div class="header-top">
    <div class="header-left">
      <h1>CERTIFICADO DE EJECUCIÓN</h1>
      <div class="op-id">${compromiso.op_id}</div>
      <div style="margin-top:8px"><span class="badge badge-ejecutado">EJECUTADO</span></div>
    </div>
    ${qrSrc ? `<div class="qr-box"><img src="${qrSrc}" alt="QR"><p>Verificar en FUNDLINK</p></div>` : ''}
  </div>
</div>

<div style="text-align:center; margin: 20px 0;">
  <div class="stamp-box">
    <h2>✓ OPERACIÓN EJECUTADA</h2>
    <p>Desembolso confirmado por el banco</p>
  </div>
</div>

<div class="info-box">
  <div class="info-row">
    <div class="info-item"><label>Fecha de Confirmación (Contrato)</label>
      <strong>${compromiso.fecha_confirmacion ? new Date(compromiso.fecha_confirmacion).toLocaleString('es-GT') : '—'}</strong>
    </div>
    <div class="info-item"><label>Fecha de Ejecución (Desembolso)</label>
      <strong style="color:#065f46">${compromiso.fecha_ejecucion ? new Date(compromiso.fecha_ejecucion).toLocaleString('es-GT') : '—'}</strong>
    </div>
    <div class="info-item"><label>Fecha de Vencimiento</label>
      <strong>${new Date(compromiso.fecha_vencimiento).toLocaleDateString('es-GT')}</strong>
    </div>
  </div>
</div>

<div class="section">
  <div class="section-title">PARTES</div>
  <table>
    <tr><th>Parte</th><th>Entidad</th><th>Representante</th></tr>
    <tr><td><strong>EL BANCO</strong></td><td>${bancoLabel}</td><td>${compromiso.banco_nombre || '—'}</td></tr>
    <tr><td><strong>EL CLIENTE</strong></td><td>${compromiso.cliente_entidad || '—'}</td><td>${compromiso.cliente_nombre || '—'}</td></tr>
  </table>
</div>

<div class="section">
  <div class="section-title">DETALLES DE LA OPERACIÓN EJECUTADA</div>
  <table>
    <tr><th>Concepto</th><th>Detalle</th></tr>
    <tr><td><strong>Monto Ejecutado</strong></td><td class="highlight">${fmt(compromiso.monto)}</td></tr>
    <tr><td><strong>Moneda</strong></td><td>${compromiso.moneda}</td></tr>
    <tr><td><strong>Tasa Pactada</strong></td><td class="highlight-green">${compromiso.tasa}%</td></tr>
    <tr><td><strong>Plazo</strong></td><td>${compromiso.plazo} días</td></tr>
    <tr><td><strong>Inicio (Ejecución)</strong></td><td style="color:#065f46;font-weight:bold">${compromiso.fecha_ejecucion ? new Date(compromiso.fecha_ejecucion).toLocaleDateString('es-GT') : new Date(compromiso.fecha_inicio).toLocaleDateString('es-GT')}</td></tr>
    <tr><td><strong>Vencimiento</strong></td><td>${new Date(compromiso.fecha_vencimiento).toLocaleDateString('es-GT')}</td></tr>
    <tr><td><strong>Intereses al Vencimiento</strong></td><td style="color:#10b981;font-weight:bold">${fmt(intereses)}</td></tr>
    <tr><td><strong>Total al Vencimiento</strong></td><td style="font-weight:bold;font-size:16px">${fmt(compromiso.monto + intereses)}</td></tr>
  </table>
</div>

${compromiso.notas ? `<div class="section"><div class="section-title">NOTAS</div><div class="info-box"><p>${compromiso.notas}</p></div></div>` : ''}

<div class="signatures" style="margin-top:40px">
  <div class="signature-box">
    <div class="signature-line">
      <strong>${bancoLabel}</strong><br>
      <small>Ejecutado por: ${compromiso.banco_nombre || 'Banco'}</small><br>
      <small>${compromiso.fecha_ejecucion ? new Date(compromiso.fecha_ejecucion).toLocaleString('es-GT') : '—'}</small>
    </div>
  </div>
  <div class="signature-box">
    <div class="signature-line">
      <strong>${compromiso.cliente_entidad || 'EL CLIENTE'}</strong><br>
      <small>Recibido por: ${compromiso.cliente_nombre || '—'}</small>
    </div>
  </div>
</div>

<div class="footer">
  <p>Certificado generado por FUNDLinkAI — ${verifyUrl}</p>
  <p>Este certificado acredita la ejecución y desembolso de la operación ${compromiso.op_id}.</p>
</div>
</body></html>`

  abrirHTML(html)
}

// ─────────────────────────────────────────────────────────────────
// 3. PDF SOLICITUD DE COLOCACIÓN
// ─────────────────────────────────────────────────────────────────
export const generarPDFSolicitudColocacion = async (solicitud: SolicitudParaPDF) => {
  const solId = solicitud.id || '—'
  const verifyUrl = `${window.location.origin}?verify-sol=${solId}`
  const qrSrc = await generarQR(verifyUrl)
  const tipoTasaMap: Record<string, string> = {
    firme: 'Tasa en Firme / Cierre',
    cierre: 'Tasa en Firme / Cierre',
    indicativa: 'Tasa Indicativa / Objetivo'
  }

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Solicitud de Colocación</title>
<style>${estilosBase}</style></head><body>
<div class="watermark">FUNDLinkAI</div>

<div class="header">
  <div class="header-top">
    <div class="header-left">
      <h1>SOLICITUD DE COLOCACIÓN</h1>
      <div class="op-id">SOL-${solId.slice(0, 8).toUpperCase()}</div>
      <div style="margin-top:8px"><span class="badge badge-vigente">ABIERTA</span></div>
    </div>
    ${qrSrc ? `<div class="qr-box"><img src="${qrSrc}" alt="QR"><p>Verificar en FUNDLINK</p></div>` : ''}
  </div>
</div>

<div class="info-box">
  <div class="info-row">
    <div class="info-item"><label>Fecha de Solicitud</label>
      <strong>${new Date(solicitud.created_at).toLocaleString('es-GT')}</strong>
    </div>
    <div class="info-item"><label>Fecha de Cierre</label>
      <strong>${new Date(solicitud.fecha_cierre).toLocaleDateString('es-GT')}</strong>
    </div>
  </div>
</div>

<div class="section">
  <div class="section-title">SOLICITANTE</div>
  <table>
    <tr><th>Entidad</th><th>Representante</th></tr>
    <tr><td>${solicitud.cliente_entidad || '—'}</td><td>${solicitud.cliente_nombre || '—'}</td></tr>
  </table>
</div>

<div class="section">
  <div class="section-title">CONDICIONES SOLICITADAS</div>
  <table>
    <tr><th>Concepto</th><th>Detalle</th></tr>
    <tr><td><strong>Moneda</strong></td><td>${solicitud.moneda}</td></tr>
    <tr><td><strong>Monto Máximo</strong></td>
      <td class="highlight">${solicitud.monto
        ? new Intl.NumberFormat('es-GT', { style: 'currency', currency: solicitud.moneda }).format(solicitud.monto)
        : 'Sin restricción (Monto libre)'}</td></tr>
    <tr><td><strong>Plazo</strong></td><td>${solicitud.plazo} días calendario</td></tr>
    <tr><td><strong>Tasa Referencial</strong></td>
      <td>${solicitud.tasa_objetivo ? `${solicitud.tasa_objetivo}%` : '—'}
          ${solicitud.tipo_tasa ? ` — ${tipoTasaMap[solicitud.tipo_tasa] || solicitud.tipo_tasa}` : ''}</td></tr>
    <tr><td><strong>Fecha Límite de Oferta</strong></td>
      <td>${new Date(solicitud.fecha_cierre).toLocaleDateString('es-GT')}</td></tr>
  </table>
</div>

${solicitud.notas ? `<div class="section"><div class="section-title">NOTAS DEL SOLICITANTE</div><div class="info-box"><p>${solicitud.notas}</p></div></div>` : ''}

<div class="section">
  <div class="section-title">PROCESO</div>
  <div class="terms"><p>El banco receptor deberá responder con una <strong>tasa cierre</strong> y monto definitivo antes de la fecha de cierre indicada.</p></div>
  <div class="terms"><p>La aceptación de una oferta generará automáticamente un Contrato de Colocación con los datos acordados.</p></div>
</div>

<div class="footer">
  <p>Solicitud generada por FUNDLinkAI — Plataforma de Subastas Financieras</p>
  <p>Este documento es de carácter informativo. La operación se perfecciona con la firma del Contrato de Colocación.</p>
</div>
</body></html>`

  abrirHTML(html)
}

// ─────────────────────────────────────────────────────────────────
// 4. PDF OFERTA DE COLOCACIÓN
// ─────────────────────────────────────────────────────────────────
export const generarPDFOfertaColocacion = async (oferta: OfertaParaPDF) => {
  const verifyUrl = `${window.location.origin}?verify-oferta=${oferta.id}`
  const qrSrc = await generarQR(verifyUrl)
  const moneda = oferta.solicitud_moneda || 'GTQ'
  const fmt = (v: number) => new Intl.NumberFormat('es-GT', { style: 'currency', currency: moneda }).format(v)
  const plazo = oferta.solicitud_plazo || 0
  const intereses = plazo > 0 ? (oferta.monto * oferta.tasa / 100 * plazo) / 360 : null

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Oferta de Colocación</title>
<style>${estilosBase}</style></head><body>
<div class="watermark">FUNDLinkAI</div>

<div class="header">
  <div class="header-top">
    <div class="header-left">
      <h1>OFERTA DE COLOCACIÓN</h1>
      <div class="op-id">OFR-${oferta.id.slice(0, 8).toUpperCase()}</div>
      <div style="margin-top:8px"><span class="badge badge-confirmado">ENVIADA</span></div>
    </div>
    ${qrSrc ? `<div class="qr-box"><img src="${qrSrc}" alt="QR"><p>Verificar en FUNDLINK</p></div>` : ''}
  </div>
</div>

<div class="info-box">
  <div class="info-row">
    <div class="info-item"><label>Fecha de Emisión</label>
      <strong>${new Date(oferta.created_at).toLocaleString('es-GT')}</strong>
    </div>
    <div class="info-item"><label>Moneda</label><strong>${moneda}</strong></div>
  </div>
</div>

<div class="section">
  <div class="section-title">PARTES</div>
  <table>
    <tr><th>Parte</th><th>Entidad</th><th>Representante</th></tr>
    <tr><td><strong>EL BANCO (Ofertante)</strong></td><td>${oferta.banco_entidad || '—'}</td><td>${oferta.banco_nombre || '—'}</td></tr>
    <tr><td><strong>EL CLIENTE (Solicitante)</strong></td><td>${oferta.cliente_entidad || '—'}</td><td>${oferta.cliente_nombre || '—'}</td></tr>
  </table>
</div>

<div class="section">
  <div class="section-title">OFERTA DE COLOCACIÓN</div>
  <table>
    <tr><th>Concepto</th><th>Detalle</th></tr>
    <tr><td><strong>Monto Ofertado</strong></td><td class="highlight">${fmt(oferta.monto)}</td></tr>
    <tr><td><strong>Moneda</strong></td><td>${moneda}</td></tr>
    <tr><td><strong>Tasa Cierre (Anual)</strong></td><td class="highlight-green">${oferta.tasa}%</td></tr>
    ${plazo > 0 ? `<tr><td><strong>Plazo</strong></td><td>${plazo} días</td></tr>` : ''}
    ${intereses !== null ? `
    <tr><td><strong>Intereses Estimados (30/360)</strong></td><td style="color:#10b981;font-weight:bold">${fmt(intereses)}</td></tr>
    <tr><td><strong>Total Estimado al Vencimiento</strong></td><td style="font-weight:bold">${fmt(oferta.monto + intereses)}</td></tr>` : ''}
  </table>
</div>

${oferta.notas ? `<div class="section"><div class="section-title">CONDICIONES ESPECIALES</div><div class="info-box"><p>${oferta.notas}</p></div></div>` : ''}

<div class="section">
  <div class="section-title">CONDICIONES DE LA OFERTA</div>
  <div class="terms"><p>Esta oferta tiene validez hasta la fecha de cierre de la solicitud. La aceptación genera un Contrato de Colocación vinculante.</p></div>
  <div class="terms"><p>La tasa ofertada es <strong>tasa cierre</strong>. El desembolso deberá ejecutarse dentro de las 24 horas posteriores a la aceptación.</p></div>
</div>

<div class="signatures">
  <div class="signature-box">
    <div class="signature-line"><strong>${oferta.banco_entidad || 'EL BANCO'}</strong><br><small>Firma y Sello</small></div>
  </div>
  <div class="signature-box">
    <div class="signature-line"><strong>${oferta.cliente_entidad || 'EL CLIENTE'}</strong><br><small>Acepta / Rechaza</small></div>
  </div>
</div>

<div class="footer">
  <p>Oferta generada por FUNDLinkAI — Plataforma de Subastas Financieras</p>
</div>
</body></html>`

  abrirHTML(html)
}

// ─────────────────────────────────────────────────────────────────
// Alias: mantener compatibilidad con código existente
// ─────────────────────────────────────────────────────────────────
export const generarPDFCompromiso = generarPDFContrato
