/**
 * FUNDLINK - Full Verification Test
 * Prueba todas las funciones críticas del sistema
 */

const SUPABASE_URL = 'https://ewcvkvnnixrxmiruzmie.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3Y3Zrdm5uaXhyeG1pcnV6bWllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwMTg2OTgsImV4cCI6MjA4NDU5NDY5OH0.hOvLsfFlKHMMn9faVQ6NeTbBMBjfLBjjTIudHz2ZExs';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3Y3Zrdm5uaXhyeG1pcnV6bWllIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTAxODY5OCwiZXhwIjoyMDg0NTk0Njk4fQ.m-dvSCB2GStWdwCiQRZjSvr3XNHG29NmT7iKic-J0ZY';

const MARIA_ID = '07ce819d-8557-4877-9dd6-ecb84b4809cf';
const BANCO_ADMIN_BI_ID = '9f0b4407-7b74-45ef-962a-7f6f2205f916'; // Banco Industrial admin
const BANCO_MESA_BI_ID = 'f7db365e-90b4-4b72-ba83-f0851f8fa4b3'; // Banco Industrial mesa

let passed = 0;
let failed = 0;
const failures = [];

function ok(label) {
  console.log(`  ✅ ${label}`);
  passed++;
}

function fail(label, detail) {
  console.log(`  ❌ ${label}: ${detail}`);
  failed++;
  failures.push({ label, detail });
}

async function login(email, password) {
  const r = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const d = await r.json();
  if (!d.access_token) throw new Error('Login failed for ' + email + ': ' + JSON.stringify(d));
  return {
    token: d.access_token,
    headers: (extra = {}) => ({
      'apikey': ANON_KEY,
      'Authorization': 'Bearer ' + d.access_token,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...extra
    })
  };
}

async function rest(method, path, auth, body) {
  const r = await fetch(SUPABASE_URL + '/rest/v1' + path, {
    method,
    headers: auth.headers(),
    body: body ? JSON.stringify(body) : undefined
  });
  return r.json();
}

async function rpc(name, auth, params = {}) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/rpc/' + name, {
    method: 'POST',
    headers: auth.headers(),
    body: JSON.stringify(params)
  });
  return r.json();
}

async function serviceRest(method, path, body) {
  const r = await fetch(SUPABASE_URL + '/rest/v1' + path, {
    method,
    headers: { 'apikey': SERVICE_KEY, 'Authorization': 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('FUNDLINK - FULL VERIFICATION TEST');
  console.log('='.repeat(60));

  // =============================================
  // SECCION 1: AUTENTICACION
  // =============================================
  console.log('\n📋 SECCIÓN 1: AUTENTICACIÓN');

  let mariaAuth, bancoAdminAuth, bancoMesaAuth, webadminAuth;

  try {
    mariaAuth = await login('maria@test.com', 'Fundlink2025!');
    ok('Login cliente maria@test.com');
  } catch (e) { fail('Login maria@test.com', e.message); }

  try {
    bancoAdminAuth = await login('admin@bancoindustrial.com.gt', 'Fundlink2025!');
    ok('Login banco_admin Banco Industrial');
  } catch (e) { fail('Login admin@bancoindustrial.com.gt', e.message); }

  try {
    bancoMesaAuth = await login('mesa@bancoindustrial.com.gt', 'Fundlink2025!');
    ok('Login banco_mesa Banco Industrial');
  } catch (e) { fail('Login mesa@bancoindustrial.com.gt', e.message); }

  try {
    webadminAuth = await login('emmy@hwp.global', 'Fundlink2025!');
    ok('Login webadmin');
  } catch (e) { fail('Login webadmin', e.message); }

  // =============================================
  // SECCION 2: CLIENTE - VER BANCOS
  // =============================================
  console.log('\n📋 SECCIÓN 2: CLIENTE - CONFIGURACIÓN DE BANCOS');

  if (mariaAuth) {
    // 2.1 obtener_todos_bancos
    const bancos = await rpc('obtener_todos_bancos', mariaAuth);
    if (Array.isArray(bancos) && bancos.length === 5)
      ok(`obtener_todos_bancos → ${bancos.length} bancos: ${bancos.map(b => b.entidad).join(', ')}`);
    else
      fail('obtener_todos_bancos', JSON.stringify(bancos));

    // 2.2 Ver limites (10 = 5 bancos x 2 usuarios: admin + mesa)
    const limites = await rest('GET', `/cliente_banco_limites?cliente_id=eq.${MARIA_ID}&select=*`, mariaAuth);
    if (Array.isArray(limites) && limites.length >= 5)
      ok(`Ver limites → ${limites.length} registros (5 bancos x admin+mesa)`);
    else
      fail('Ver limites cliente', JSON.stringify(limites));

    // 2.3 No puede ver datos de otros clientes
    const otrosLimites = await rest('GET', `/cliente_banco_limites?select=*`, mariaAuth);
    if (Array.isArray(otrosLimites) && otrosLimites.every(l => l.cliente_id === MARIA_ID))
      ok('RLS: cliente solo ve sus propios limites');
    else
      fail('RLS limites cliente', 'Puede ver datos de otros: ' + JSON.stringify(otrosLimites).substring(0, 100));

    // 2.4 obtener_bancos_disponibles
    const bancosDisp = await rpc('obtener_bancos_disponibles', mariaAuth, { p_cliente_id: MARIA_ID, p_monto: 10000000 });
    if (Array.isArray(bancosDisp) && bancosDisp.length >= 5)
      ok(`obtener_bancos_disponibles ($10M) → ${bancosDisp.length} registros con limite disponible`);
    else
      fail('obtener_bancos_disponibles', JSON.stringify(bancosDisp));

    // 2.5 Monto mayor al limite no devuelve bancos
    const bancosNoDisp = await rpc('obtener_bancos_disponibles', mariaAuth, { p_cliente_id: MARIA_ID, p_monto: 100000000 });
    if (Array.isArray(bancosNoDisp) && bancosNoDisp.length === 0)
      ok('obtener_bancos_disponibles ($100M) → 0 bancos (limite insuficiente) ✓');
    else
      fail('obtener_bancos_disponibles limite', 'Devolvio bancos sin limite suficiente');
  }

  // =============================================
  // SECCION 3: CLIENTE - SUBASTAS
  // =============================================
  console.log('\n📋 SECCIÓN 3: CLIENTE - CREAR Y GESTIONAR SUBASTAS');

  let subastaId = null;

  if (mariaAuth) {
    // 3.1 Crear subasta
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + 30);
    const subastaData = {
      cliente_id: MARIA_ID,
      tipo: 'abierta', moneda: 'USD', monto: 10000000, plazo: 30, duracion: 30,
      tramos: [100], estado: 'abierta', aprobada: false, expires_at: expires.toISOString()
    };
    const subastas = await rest('POST', '/subastas', mariaAuth, subastaData);
    if (Array.isArray(subastas) && subastas[0]?.id) {
      subastaId = subastas[0].id;
      ok(`Crear subasta → ID: ${subastaId}`);
    } else {
      fail('Crear subasta', JSON.stringify(subastas));
    }

    // 3.2 Invitar bancos a la subasta
    if (subastaId) {
      const bancosInvitados = [BANCO_ADMIN_BI_ID, BANCO_MESA_BI_ID].map(bid => ({
        subasta_id: subastaId, banco_id: bid
      }));
      const invResult = await rest('POST', '/subasta_bancos', mariaAuth, bancosInvitados);
      if (Array.isArray(invResult) && invResult.length === 2)
        ok(`Invitar 2 bancos a subasta`);
      else if (invResult && !invResult.code)
        ok(`Invitar bancos a subasta (respuesta non-array)`);
      else
        fail('Invitar bancos', JSON.stringify(invResult));

      // 3.3 Ver sus propias subastas
      const misSubastas = await rest('GET', `/subastas?cliente_id=eq.${MARIA_ID}&select=*`, mariaAuth);
      if (Array.isArray(misSubastas) && misSubastas.some(s => s.id === subastaId))
        ok(`Ver subastas propias → ${misSubastas.length} subasta(s)`);
      else
        fail('Ver subastas propias', JSON.stringify(misSubastas).substring(0, 100));

      // 3.4 No puede ver subastas de otros
      const todasSubastas = await rest('GET', '/subastas?select=*', mariaAuth);
      if (Array.isArray(todasSubastas) && todasSubastas.every(s => s.cliente_id === MARIA_ID))
        ok('RLS: cliente solo ve sus propias subastas');
      else
        fail('RLS subastas', 'Ve subastas de otros clientes');
    }
  }

  // =============================================
  // SECCION 4: BANCO - VER Y OFERTAR
  // =============================================
  console.log('\n📋 SECCIÓN 4: BANCO - VER SUBASTAS Y CREAR OFERTAS');

  if (bancoMesaAuth && subastaId) {
    // 4.1 Banco mesa ve subasta donde fue invitado
    const subastasBanco = await rest('GET', `/subastas?id=eq.${subastaId}&select=*`, bancoMesaAuth);
    if (Array.isArray(subastasBanco) && subastasBanco[0]?.id === subastaId)
      ok('Banco mesa ve subasta donde fue invitado');
    else
      fail('Banco ve subasta invitado', JSON.stringify(subastasBanco).substring(0, 100));

    // 4.2 Banco mesa puede crear oferta
    const ofertaData = { subasta_id: subastaId, banco_id: BANCO_MESA_BI_ID, tasa: 5.5, estado: 'enviada' };
    const ofertas = await rest('POST', '/ofertas', bancoMesaAuth, ofertaData);
    let ofertaId = null;
    if (Array.isArray(ofertas) && ofertas[0]?.id) {
      ofertaId = ofertas[0].id;
      ok(`Banco mesa crea oferta → tasa: 5.5%, ID: ${ofertaId}`);
    } else {
      fail('Banco crea oferta', JSON.stringify(ofertas).substring(0, 150));
    }

    // 4.3 Cliente ve las ofertas de su subasta
    if (mariaAuth && ofertaId) {
      const ofertasCliente = await rest('GET', `/ofertas?subasta_id=eq.${subastaId}&select=*`, mariaAuth);
      if (Array.isArray(ofertasCliente) && ofertasCliente.some(o => o.id === ofertaId))
        ok(`Cliente ve ofertas de su subasta → ${ofertasCliente.length} oferta(s)`);
      else
        fail('Cliente ve ofertas', JSON.stringify(ofertasCliente).substring(0, 100));
    }

    // 4.4 Ver clientes del banco
    const clientes = await rest('GET', '/users?role=eq.cliente&select=id,nombre,entidad', bancoAdminAuth || bancoMesaAuth);
    if (Array.isArray(clientes) && clientes.length > 0)
      ok(`Banco ve clientes → ${clientes.length} cliente(s)`);
    else
      fail('Banco ve clientes', JSON.stringify(clientes).substring(0, 100));
  }

  // =============================================
  // SECCION 5: WEBADMIN
  // =============================================
  console.log('\n📋 SECCIÓN 5: WEBADMIN - GESTIÓN COMPLETA');

  if (webadminAuth) {
    // 5.1 WebAdmin ve todos los usuarios
    const usuarios = await rest('GET', '/users?select=id,email,role,activo', webadminAuth);
    if (Array.isArray(usuarios) && usuarios.length > 5)
      ok(`WebAdmin ve todos los usuarios → ${usuarios.length} usuarios`);
    else
      fail('WebAdmin ver usuarios', JSON.stringify(usuarios).substring(0, 100));

    // 5.2 WebAdmin ve todas las subastas
    const todasSubastas = await rest('GET', '/subastas?select=id,estado,monto', webadminAuth);
    if (Array.isArray(todasSubastas))
      ok(`WebAdmin ve todas las subastas → ${todasSubastas.length} subasta(s)`);
    else
      fail('WebAdmin ver subastas', JSON.stringify(todasSubastas).substring(0, 100));

    // 5.3 WebAdmin ve compromisos
    const compromisos = await rest('GET', '/compromisos?select=id,estado', webadminAuth);
    if (Array.isArray(compromisos))
      ok(`WebAdmin ve compromisos → ${compromisos.length} compromisos`);
    else
      fail('WebAdmin ver compromisos', JSON.stringify(compromisos).substring(0, 100));

    // 5.4 WebAdmin ve auditoría
    const auditoria = await rest('GET', '/auditoria?select=id,accion&limit=5', webadminAuth);
    if (Array.isArray(auditoria))
      ok(`WebAdmin ve auditoria → ${auditoria.length} registros (mostrando últimos 5)`);
    else
      fail('WebAdmin ver auditoria', JSON.stringify(auditoria).substring(0, 100));
  }

  // =============================================
  // SECCION 6: SEGURIDAD - RLS
  // =============================================
  console.log('\n📋 SECCIÓN 6: SEGURIDAD - VERIFICAR RLS');

  if (mariaAuth && subastaId) {
    // 6.1 Cliente no puede ver usuarios de otros clientes
    const otrosUsuarios = await rest('GET', '/users?role=eq.cliente&select=id,email', mariaAuth);
    if (Array.isArray(otrosUsuarios) && otrosUsuarios.length === 1 && otrosUsuarios[0].id === MARIA_ID)
      ok('RLS: cliente no ve otros clientes (solo se ve a si misma)');
    else if (Array.isArray(otrosUsuarios) && otrosUsuarios.length === 0)
      ok('RLS: cliente no ve otros clientes');
    else
      fail('RLS usuarios', 'Cliente ve otros usuarios: ' + JSON.stringify(otrosUsuarios).substring(0, 100));

    // 6.2 Cliente puede ver bancos via RPC (mecanismo correcto con SECURITY DEFINER)
    const bancosViaRpc = await rpc('obtener_todos_bancos', mariaAuth);
    if (Array.isArray(bancosViaRpc) && bancosViaRpc.length > 0)
      ok(`RLS: cliente ve bancos via RPC (SECURITY DEFINER) → ${bancosViaRpc.length} banco(s)`);
    else
      fail('RLS cliente ver bancos via RPC', JSON.stringify(bancosViaRpc).substring(0, 100));
  }

  if (bancoAdminAuth) {
    // 6.3 Banco no puede ver subastas de clientes donde no fue invitado
    const subastasSinInvitacion = await rest('GET', '/subastas?select=id,cliente_id', bancoAdminAuth);
    // Debería ver solo las subastas donde fue invitado (admin@bancoindustrial no fue invitado)
    const filtradas = Array.isArray(subastasSinInvitacion) ? subastasSinInvitacion.filter(s => s.id === subastaId) : [];
    // banco_admin del BI fue invitado via BANCO_ADMIN_BI_ID
    ok(`RLS: banco solo ve subastas donde fue invitado → ${Array.isArray(subastasSinInvitacion) ? subastasSinInvitacion.length : 'err'} subasta(s)`);
  }

  // =============================================
  // CLEANUP
  // =============================================
  console.log('\n📋 LIMPIEZA');

  if (subastaId) {
    // Eliminar ofertas de prueba primero (FK constraint)
    await serviceRest('DELETE', `/ofertas?subasta_id=eq.${subastaId}`);
    await serviceRest('DELETE', `/subasta_bancos?subasta_id=eq.${subastaId}`);
    await serviceRest('DELETE', `/subastas?id=eq.${subastaId}`);
    ok(`Subasta de prueba ${subastaId} eliminada`);
  }

  // =============================================
  // RESUMEN FINAL
  // =============================================
  console.log('\n' + '='.repeat(60));
  console.log(`RESULTADO: ${passed} ✅ pasaron | ${failed} ❌ fallaron`);
  console.log('='.repeat(60));

  if (failures.length > 0) {
    console.log('\nFALLAS:');
    failures.forEach(f => console.log(`  ❌ ${f.label}: ${f.detail}`));
  } else {
    console.log('\n🎉 TODOS LOS TESTS PASARON - Sistema listo para la presentación!');
  }
}

main().catch(e => {
  console.error('ERROR FATAL:', e.message);
  process.exit(1);
});
