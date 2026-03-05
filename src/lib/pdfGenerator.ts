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
//    Texto revisado por abogado — documento preliminar, NO vinculante
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
  const fechaEmision = compromiso.fecha_confirmacion
    ? new Date(compromiso.fecha_confirmacion).toLocaleString('es-GT')
    : new Date(compromiso.created_at).toLocaleString('es-GT')

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Constancia ${compromiso.op_id}</title>
<style>
${estilosBase}
.nature-box { background:#fff8f0; border:2px solid #f59e0b; border-radius:6px; padding:14px 18px; margin:18px 0; }
.nature-box p { margin:4px 0; font-size:13px; }
.nature-title { font-size:14px; font-weight:bold; color:#b45309; margin-bottom:8px; }
.clause { margin:10px 0; padding:10px 14px; background:#f9fafb; border-left:3px solid #6b7280; font-size:12.5px; }
.clause strong { color:#1e3a5f; }
.disclaimer { background:#fef3c7; border:1px solid #f59e0b; border-radius:4px; padding:12px 16px; font-size:11px; color:#78350f; margin-top:20px; line-height:1.6; }
.estado-banner { text-align:center; border:2px dashed #9ca3af; border-radius:6px; padding:8px; margin:12px 0; color:#6b7280; font-size:13px; font-style:italic; }
</style></head><body>
<div class="watermark">PRELIMINAR</div>

<div class="header">
  <div class="header-top">
    <div class="header-left">
      <p style="font-size:11px;color:#888;margin:0 0 4px">FUNDLink AI</p>
      <h1 style="font-size:18px">CONSTANCIA DE INTENCIÓN DE COLOCACIÓN</h1>
      <p style="font-size:11px;color:#b45309;margin:2px 0">(DOCUMENTO PRELIMINAR – NO VINCULANTE – NO CONTRACTUAL)</p>
      <div class="op-id" style="margin-top:6px">Número de Operación: ${compromiso.op_id}</div>
      <div style="margin-top:4px;font-size:12px;color:#666">Fecha de Emisión: ${fechaEmision}</div>
      <div style="margin-top:8px">
        <span class="badge badge-${compromiso.estado}">${compromiso.estado.toUpperCase()} — PRELIMINAR · NO EJECUTADO</span>
      </div>
    </div>
    ${qrSrc ? `<div class="qr-box"><img src="${qrSrc}" alt="QR"><p>Verificar en FUNDLINK</p></div>` : ''}
  </div>
</div>

<div class="section">
  <div class="section-title">PARTES INTERVINIENTES</div>
  <table>
    <tr><th>Parte</th><th>Entidad</th><th>Representante</th></tr>
    <tr><td><strong>EL BANCO</strong></td><td>${bancoLabel}</td><td>${bancoRep}</td></tr>
    <tr><td><strong>EL CLIENTE</strong></td><td>${compromiso.cliente_entidad || '—'}</td><td>${compromiso.cliente_nombre || '—'}</td></tr>
  </table>
</div>

<div class="nature-box">
  <div class="nature-title">NATURALEZA DEL DOCUMENTO (DECLARACIÓN EXPRESA)</div>
  <p>La presente Constancia de Intención de Colocación:</p>
  <p>a) <strong>NO</strong> constituye un contrato financiero;</p>
  <p>b) <strong>NO</strong> es un título ejecutivo;</p>
  <p>c) <strong>NO</strong> genera obligación exigible;</p>
  <p>d) <strong>NO</strong> implica captación de fondos;</p>
  <p>e) <strong>NO</strong> implica intermediación financiera;</p>
  <p>f) <strong>NO</strong> obliga ni compromete a FUNDLINK, S.A.</p>
  <p style="margin-top:8px;font-style:italic">Este documento es generado únicamente como constancia tecnológica, reflejando una manifestación preliminar de voluntad entre el BANCO y el CLIENTE, sujeta a validaciones posteriores.</p>
</div>

<div class="section">
  <div class="section-title">CONDICIONES FINANCIERAS PRELIMINARES <small style="font-weight:normal;color:#888">(Referenciales – no vinculantes)</small></div>
  <div class="info-box" style="margin-bottom:10px">
    <div class="info-row">
      <div class="info-item"><label>Monto Principal</label><strong class="highlight">${fmt(compromiso.monto)}</strong></div>
      <div class="info-item"><label>Intereses Estimados</label><strong style="color:#10b981">${fmt(intereses)}</strong></div>
      <div class="info-item"><label>Monto al Cierre Estimado</label><strong>${fmt(compromiso.monto + intereses)}</strong></div>
    </div>
  </div>
  <table>
    <tr><th>Concepto</th><th>Detalle</th></tr>
    <tr><td><strong>Moneda</strong></td><td>${monedaLabel}</td></tr>
    <tr><td><strong>Tasa de Interés Anual</strong></td><td class="highlight-green">${compromiso.tasa}%</td></tr>
    <tr><td><strong>Plazo</strong></td><td>${compromiso.plazo} días calendario</td></tr>
    <tr><td><strong>Fecha de Inicio</strong></td><td>${new Date(compromiso.fecha_inicio).toLocaleDateString('es-GT')}</td></tr>
    <tr><td><strong>Fecha de Vencimiento</strong></td><td>${new Date(compromiso.fecha_vencimiento).toLocaleDateString('es-GT')}</td></tr>
  </table>
  <p style="font-size:11px;color:#888;margin-top:6px;font-style:italic">Los valores anteriores son estimativos y podrán variar al momento de la formalización definitiva.</p>
</div>

<div class="section">
  <div class="section-title">TÉRMINOS Y CONDICIONES PRELIMINARES <small style="font-weight:normal;color:#888">(NO VINCULANTES)</small></div>

  <div class="clause"><strong>DECLARACIONES DEL BANCO:</strong> El BANCO declara que: a) La oferta reflejada es preliminar y sujeta a aprobación interna; b) La operación está sujeta a KYC/AML, análisis de riesgo y políticas internas; c) Ninguna obligación nace hasta la firma de contratos bancarios definitivos.</div>

  <div class="clause"><strong>DECLARACIONES DEL CLIENTE:</strong> El CLIENTE declara que: a) Su manifestación de intención es preliminar y no vinculante; b) Cuenta con facultades suficientes para emitirla; c) La ejecución dependerá de la firma de contratos definitivos con el BANCO.</div>

  <div class="clause"><strong>OBJETO DEL COMPROMISO:</strong> Este documento resume una oferta preliminar donde el Banco propone recibir fondos del Cliente por el plazo indicado, devengando intereses a la tasa estimada. No constituye un contrato vinculante y requiere ejecución independiente por las partes.</div>

  <div class="clause"><strong>OBLIGACIONES PRELIMINARES DEL CLIENTE:</strong> El Cliente propone ejecutar la transferencia de fondos dentro de las 24 horas siguientes a la aceptación de la oferta, pero esta obligación es condicional a la firma de un contrato físico entre las partes.</div>

  <div class="clause"><strong>CÁLCULO DE INTERESES:</strong> Los intereses se calcularán estimativamente sobre la base 30/360, pagaderos al vencimiento junto con el principal, sujeto a ajustes en el contrato final.</div>

  <div class="clause"><strong>PREPAGO:</strong> No se permite el prepago de la operación salvo acuerdo previo por escrito entre las partes en el contrato definitivo.</div>

  <div class="clause"><strong>CUMPLIMIENTO NORMATIVO:</strong> Esta propuesta preliminar está sujeta a las políticas KYC/AML vigentes de ambas partes, así como a la legislación guatemalteca, incluyendo la Ley contra el Lavado de Dinero u Otros Activos (Decreto 67-2001) y regulaciones de la Superintendencia de Bancos (SIB).</div>

  <div class="clause"><strong>JURISDICCIÓN:</strong> Cualquier controversia derivada de la ejecución futura de esta propuesta se someterá a los tribunales competentes de la República de Guatemala, según la legislación aplicable (Código Civil, Decreto-Ley 106; Ley de Bancos y Grupos Financieros, Decreto 19-2002).</div>

  <div class="clause"><strong>ROL Y LIMITACIÓN DE RESPONSABILIDAD DE FUNDLINK:</strong> FUNDLINK, S.A.: a) No recibe, custodia, administra ni transfiere fondos; b) No actúa como intermediario financiero, agente, corredor o mandatario; c) No garantiza ejecución, tasas ni cumplimiento; d) No es parte de la relación jurídica o financiera; e) Actúa únicamente como proveedor tecnológico neutral, de buena fe.</div>
</div>

<div class="section">
  <div class="section-title">CLÁUSULAS ADICIONALES <small style="font-weight:normal;color:#888">(Preliminares y No Vinculantes)</small></div>

  <div class="clause"><strong>CONDICIONES DE RIESGO Y FILTROS:</strong> La oferta se basa en los filtros de inversión especificados por el Cliente, y el Banco confirma su capacidad para cumplir con estos bajo sus políticas internas. Cualquier ajuste requiere negociación directa entre las partes.</div>

  <div class="clause"><strong>CONDICIÓN DE EJECUCIÓN:</strong> Cualquier operación solo podrá ejecutarse cuando: a) Se hayan cumplido los procesos internos del BANCO; b) Se haya firmado un contrato financiero definitivo entre BANCO y CLIENTE; c) Se haya realizado la transferencia directa entre las partes, fuera de la plataforma.</div>

  <div class="clause"><strong>COMISIONES Y COSTOS:</strong> No se incluyen comisiones adicionales en esta propuesta preliminar, salvo las pactadas directamente entre el Banco y el Cliente en el contrato final. FundLink AI cobra una comisión al Banco por la facilitación tecnológica, pero no afecta al Cliente.</div>

  <div class="clause"><strong>CONDICIONES DE CANCELACIÓN:</strong> Cualquiera de las partes podrá retirar su intención antes de la ejecución definitiva, sin penalizaciones, notificando a través de la Plataforma.</div>

  <div class="clause"><strong>CONFIDENCIALIDAD:</strong> Ambas partes se comprometen preliminarmente a mantener la confidencialidad de los términos aquí resumidos, conforme a la Ley de Acceso a la Información Pública (Decreto 57-2008) y regulaciones de datos personales.</div>

  <div class="clause"><strong>FUERZA MAYOR:</strong> Cualquier ejecución futura estará sujeta a eventos de fuerza mayor (desastres naturales, cambios regulatorios), conforme al Artículo 1424 del Código Civil.</div>

  <div class="clause"><strong>MODIFICACIONES:</strong> Cualquier modificación a los términos resumidos requiere acuerdo escrito entre las partes y no puede realizarse a través de la Plataforma.</div>
</div>

${compromiso.notas ? `<div class="section"><div class="section-title">NOTAS DE LA OPERACIÓN</div><div class="info-box"><p>${compromiso.notas}</p></div></div>` : ''}

<div class="signatures">
  <div class="signature-box">
    <div class="signature-line">
      <strong>Banco ${bancoLabel}</strong><br>
      <small>Firma Preliminar de ${bancoRep}</small>
    </div>
  </div>
  <div class="signature-box">
    <div class="signature-line">
      <strong>Cliente ${compromiso.cliente_entidad || '—'}</strong><br>
      <small>Firma Preliminar de ${compromiso.cliente_nombre || '—'}</small>
    </div>
  </div>
</div>

<div class="disclaimer">
  <strong>Declaración Importante (Descargo de Responsabilidad):</strong> Este documento preliminar ha sido generado automáticamente por FundLinkAI de buena fe, como facilitador tecnológico neutral. <strong>No constituye un contrato vinculante, no capta fondos ni realiza intermediación financiera</strong> (conforme al Artículo 3, Ley de Bancos y Grupos Financieros, Decreto 19-2002). La ejecución, validez y cumplimiento dependen exclusivamente del Banco y el Cliente, sin responsabilidad alguna para FUNDLINK, que actúa como facilitador tecnológico neutral. Autorizado preliminarmente por ${bancoRep} y ${compromiso.cliente_nombre || '—'} bajo las condiciones descritas, sin responsabilidad para FundLink AI o la Plataforma, que actúa de buena fe. <strong>Requiere firma física de un contrato definitivo entre las partes para tener validez legal.</strong> FundLink AI no asume responsabilidad por incumplimientos, fraudes o disputas derivadas de esta propuesta.
</div>

<div class="footer">
  <p>Generado por FUNDLink AI — Sistema de Subastas Financieras</p>
  <p>${verifyUrl}</p>
</div>
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
    <tr><td><strong>Inicio</strong></td><td>${new Date(compromiso.fecha_inicio).toLocaleDateString('es-GT')}</td></tr>
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
    firme: 'Tasa Fija en Firme',
    cierre: 'Tasa al Cierre',
    indicativa: 'Tasa Indicativa'
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
  <div class="terms"><p>El banco receptor deberá responder con una <strong>tasa en firme</strong> y monto definitivo antes de la fecha de cierre indicada.</p></div>
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
  <div class="section-title">OFERTA EN FIRME</div>
  <table>
    <tr><th>Concepto</th><th>Detalle</th></tr>
    <tr><td><strong>Monto Ofertado</strong></td><td class="highlight">${fmt(oferta.monto)}</td></tr>
    <tr><td><strong>Moneda</strong></td><td>${moneda}</td></tr>
    <tr><td><strong>Tasa en Firme (Anual)</strong></td><td class="highlight-green">${oferta.tasa}%</td></tr>
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
  <div class="terms"><p>La tasa ofertada es <strong>en firme</strong>. El desembolso deberá ejecutarse dentro de las 24 horas posteriores a la aceptación.</p></div>
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
