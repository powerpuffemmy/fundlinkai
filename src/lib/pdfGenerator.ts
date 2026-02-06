import type { Compromiso } from '@/types/database'

interface CompromisoConDetalles extends Compromiso {
  banco_nombre?: string
  banco_entidad?: string
  cliente_nombre?: string
  cliente_entidad?: string
}

export const generarPDFCompromiso = (compromiso: CompromisoConDetalles) => {
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
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 3px solid #4A90E2;
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
    <h1>CONTRATO DE COLOCACIÓN</h1>
    <div class="op-id">${compromiso.op_id}</div>
  </div>

  <div class="info-box">
    <p><strong>Fecha de emisión:</strong> ${new Date(compromiso.created_at).toLocaleDateString('es-ES', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}</p>
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
    <table>
      <tr>
        <th>Concepto</th>
        <th>Detalle</th>
      </tr>
      <tr>
        <td><strong>Monto Principal</strong></td>
        <td style="font-size: 18px; font-weight: bold; color: #4A90E2;">
          ${new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: compromiso.moneda
          }).format(compromiso.monto)}
        </td>
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
      <tr>
        <td><strong>Intereses Estimados</strong></td>
        <td>${new Intl.NumberFormat('es-ES', {
          style: 'currency',
          currency: compromiso.moneda
        }).format((compromiso.monto * compromiso.tasa / 100 * compromiso.plazo) / 360)}</td>
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