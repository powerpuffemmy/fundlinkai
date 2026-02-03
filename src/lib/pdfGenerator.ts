import type { Compromiso } from '@/types/database'

interface CompromisoConDetalles extends Compromiso {
  banco_nombre?: string
  banco_entidad?: string
  banco_logo_url?: string  // ⭐ NUEVO: Logo del banco
  cliente_nombre?: string
  cliente_entidad?: string
}

export const generarPDFCompromiso = (compromiso: CompromisoConDetalles) => {
  // Calcular intereses y monto al cierre
  const intereses = (compromiso.monto * compromiso.tasa / 100 * compromiso.plazo) / 360
  const montoAlCierre = compromiso.monto + intereses

  // Fecha y hora de emisión
  const ahora = new Date()
  const fechaEmision = ahora.toLocaleDateString('es-ES', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
  const horaEmision = ahora.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contrato ${compromiso.op_id}</title>
  <style>
    body {
      font-family: Arial, Helvetica, sans-serif;
      margin: 40px;
      line-height: 1.6;
      color: #333;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 3px solid #4A90E2;
    }
    .header-left {
      flex: 1;
    }
    .header-right {
      flex: 0 0 auto;
      text-align: right;
    }
    .banco-logo {
      max-width: 150px;
      max-height: 80px;
      object-fit: contain;
    }
    .logo-placeholder {
      width: 150px;
      height: 80px;
      border: 2px dashed #ccc;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #999;
      font-size: 12px;
      text-align: center;
      padding: 10px;
    }
    h1 {
      color: #4A90E2;
      font-size: 24px;
      margin-bottom: 5px;
    }
    .op-id {
      font-size: 18px;
      color: #666;
      font-weight: bold;
    }
    .fecha-emision {
      font-size: 14px;
      color: #666;
      margin-top: 10px;
    }
    .info-box {
      background: #f5f5f5;
      padding: 15px;
      border-radius: 5px;
      margin: 20px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 12px;
      text-align: left;
    }
    th {
      background-color: #4A90E2;
      color: white;
    }
    .section {
      margin: 30px 0;
    }
    .section-title {
      font-size: 18px;
      color: #4A90E2;
      margin-bottom: 10px;
      padding-bottom: 5px;
      border-bottom: 2px solid #4A90E2;
    }
    .highlight-amount {
      background: #e3f2fd;
      padding: 15px;
      border-radius: 5px;
      margin: 10px 0;
      border-left: 4px solid #4A90E2;
    }
    .terms {
      background: #fffbf0;
      padding: 15px;
      border-left: 4px solid #f59e0b;
      margin: 20px 0;
    }
    .signatures {
      margin-top: 60px;
      display: flex;
      justify-content: space-between;
    }
    .signature-box {
      width: 45%;
      text-align: center;
    }
    .signature-line {
      border-top: 2px solid #333;
      margin-top: 60px;
      padding-top: 10px;
    }
    .footer {
      margin-top: 40px;
      text-align: center;
      font-size: 12px;
      color: #999;
      border-top: 1px solid #ddd;
      padding-top: 20px;
    }
    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-45deg);
      font-size: 120px;
      color: rgba(74, 144, 226, 0.1);
      z-index: -1;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="watermark">FUNDLinkAI</div>

  <div class="header">
    <div class="header-left">
      <h1>CONTRATO DE COLOCACIÓN</h1>
      <div class="op-id">${compromiso.op_id}</div>
      <div class="fecha-emision">
        <strong>Fecha de emisión:</strong> ${fechaEmision} - ${horaEmision} hrs
      </div>
    </div>
    <div class="header-right">
      ${compromiso.banco_logo_url ? 
        `<img src="${compromiso.banco_logo_url}" alt="Logo ${compromiso.banco_entidad}" class="banco-logo">` :
        `<div class="logo-placeholder">Logo del<br>Banco</div>`
      }
    </div>
  </div>

  <div class="info-box">
    <p><strong>Estado:</strong> ${compromiso.estado.toUpperCase()}</p>
  </div>

  <div class="section">
    <div class="section-title">PARTES CONTRATANTES</div>
    <table>
      <tr>
        <th>Parte</th>
        <th>Entidad</th>
        <th>Representante</th>
      </tr>
      <tr>
        <td><strong>EL BANCO</strong></td>
        <td>${compromiso.banco_entidad || 'Banco'}</td>
        <td>${compromiso.banco_nombre || '—'}</td>
      </tr>
      <tr>
        <td><strong>EL CLIENTE</strong></td>
        <td>${compromiso.cliente_entidad || 'Cliente'}</td>
        <td>${compromiso.cliente_nombre || '—'}</td>
      </tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">CONDICIONES FINANCIERAS</div>
    
    <div class="highlight-amount">
      <table style="border: none; margin: 0;">
        <tr>
          <td style="border: none; font-weight: bold; width: 50%;">Monto Principal:</td>
          <td style="border: none; font-size: 20px; font-weight: bold; color: #4A90E2; text-align: right;">
            ${new Intl.NumberFormat('es-ES', {
              style: 'currency',
              currency: compromiso.moneda
            }).format(compromiso.monto)}
          </td>
        </tr>
        <tr>
          <td style="border: none; font-weight: bold;">Intereses Estimados:</td>
          <td style="border: none; font-size: 16px; color: #10b981; text-align: right;">
            ${new Intl.NumberFormat('es-ES', {
              style: 'currency',
              currency: compromiso.moneda
            }).format(intereses)}
          </td>
        </tr>
        <tr>
          <td style="border: none; padding-top: 10px; border-top: 2px solid #4A90E2; font-weight: bold; font-size: 18px;">
            Monto al Cierre:
          </td>
          <td style="border: none; padding-top: 10px; border-top: 2px solid #4A90E2; font-size: 22px; font-weight: bold; color: #059669; text-align: right;">
            ${new Intl.NumberFormat('es-ES', {
              style: 'currency',
              currency: compromiso.moneda
            }).format(montoAlCierre)}
          </td>
        </tr>
      </table>
    </div>

    <table>
      <tr>
        <th>Concepto</th>
        <th>Detalle</th>
      </tr>
      <tr>
        <td><strong>Moneda</strong></td>
        <td>${compromiso.moneda === 'USD' ? 'Dólares Estadounidenses (USD)' : 'Quetzales Guatemaltecos (GTQ)'}</td>
      </tr>
      <tr>
        <td><strong>Tasa de Interés Anual</strong></td>
        <td style="font-size: 18px; font-weight: bold; color: #10b981;">${compromiso.tasa}%</td>
      </tr>
      <tr>
        <td><strong>Plazo</strong></td>
        <td>${compromiso.plazo} días calendario</td>
      </tr>
      <tr>
        <td><strong>Fecha de Inicio</strong></td>
        <td>${new Date(compromiso.fecha_inicio).toLocaleDateString('es-ES')}</td>
      </tr>
      <tr>
        <td><strong>Fecha de Vencimiento</strong></td>
        <td>${new Date(compromiso.fecha_vencimiento).toLocaleDateString('es-ES')}</td>
      </tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">TÉRMINOS Y CONDICIONES</div>
    
    <div class="terms">
      <p><strong>1. OBJETO DEL CONTRATO:</strong> El Banco se compromete a recibir los fondos del Cliente por el plazo indicado, devengando los intereses a la tasa convenida.</p>
    </div>

    <div class="terms">
      <p><strong>2. OBLIGACIONES DEL CLIENTE:</strong> El Cliente se compromete a ejecutar la transferencia de los fondos dentro de las <strong>24 horas siguientes</strong> a la firma de este compromiso.</p>
    </div>

    <div class="terms">
      <p><strong>3. CÁLCULO DE INTERESES:</strong> Los intereses se calcularán sobre la base 30/360, pagaderos al vencimiento junto con el principal.</p>
    </div>

    <div class="terms">
      <p><strong>4. PREPAGO:</strong> No se permite el prepago de la operación salvo acuerdo previo por escrito entre las partes.</p>
    </div>

    <div class="terms">
      <p><strong>5. CUMPLIMIENTO NORMATIVO:</strong> Esta operación está sujeta a las políticas KYC/AML vigentes de ambas partes.</p>
    </div>

    <div class="terms">
      <p><strong>6. JURISDICCIÓN:</strong> Cualquier controversia derivada de este contrato se someterá a los tribunales competentes según la legislación aplicable.</p>
    </div>
  </div>

  ${compromiso.notas ? `
  <div class="section">
    <div class="section-title">NOTAS ADICIONALES</div>
    <div class="info-box">
      <p>${compromiso.notas}</p>
    </div>
  </div>
  ` : ''}

  <div class="signatures">
    <div class="signature-box">
      <div class="signature-line">
        <strong>${compromiso.banco_entidad || 'EL BANCO'}</strong><br>
        <small>Firma y Sello</small>
      </div>
    </div>
    <div class="signature-box">
      <div class="signature-line">
        <strong>${compromiso.cliente_entidad || 'EL CLIENTE'}</strong><br>
        <small>Firma y Sello</small>
      </div>
    </div>
  </div>

  <div class="footer">
    <p>Documento generado por FUNDLinkAI - Sistema de Subastas Financieras</p>
    <p>Este es un documento preliminar. La ejecución de la operación está sujeta a la firma física del contrato.</p>
  </div>
</body>
</html>
  `

  // Crear blob y abrir en nueva ventana
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
}
