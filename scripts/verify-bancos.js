const SUPABASE_URL = 'https://ewcvkvnnixrxmiruzmie.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3Y3Zrdm5uaXhyeG1pcnV6bWllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwMTg2OTgsImV4cCI6MjA4NDU5NDY5OH0.hOvLsfFlKHMMn9faVQ6NeTbBMBjfLBjjTIudHz2ZExs';

async function main() {
  // Login como maria
  const loginRes = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'maria@test.com', password: 'Fundlink2025!' })
  });
  const auth = await loginRes.json();

  if (!auth.access_token) {
    console.log('LOGIN FAIL:', JSON.stringify(auth));
    return;
  }
  console.log('LOGIN OK como maria@test.com');

  const H = {
    'apikey': ANON_KEY,
    'Authorization': 'Bearer ' + auth.access_token,
    'Content-Type': 'application/json'
  };

  // Test 1: RPC obtener_todos_bancos (nueva)
  const r1 = await fetch(SUPABASE_URL + '/rest/v1/rpc/obtener_todos_bancos', {
    method: 'POST', headers: H, body: '{}'
  });
  const bancos = await r1.json();
  console.log('\nTEST 1 - obtener_todos_bancos (ClienteConfiguracion):');
  if (Array.isArray(bancos)) {
    console.log('Bancos encontrados:', bancos.length);
    bancos.forEach(b => console.log(' -', b.entidad));
  } else {
    console.log('ERROR:', JSON.stringify(bancos));
  }

  // Test 2: RPC obtener_bancos_disponibles (NuevaSubasta)
  const r2 = await fetch(SUPABASE_URL + '/rest/v1/rpc/obtener_bancos_disponibles', {
    method: 'POST', headers: H,
    body: JSON.stringify({ p_cliente_id: '07ce819d-8557-4877-9dd6-ecb84b4809cf', p_monto: 10000000 })
  });
  const bancosDisp = await r2.json();
  console.log('\nTEST 2 - obtener_bancos_disponibles (NuevaSubasta):');
  if (Array.isArray(bancosDisp)) {
    console.log('Bancos disponibles:', bancosDisp.length);
    bancosDisp.forEach(b => console.log(' -', b.banco_entidad, '| Limite: $' + b.limite_monto.toLocaleString(), '| Disponible: $' + b.monto_disponible.toLocaleString()));
  } else {
    console.log('ERROR:', JSON.stringify(bancosDisp));
  }

  // Test 3: Limites de maria
  const r3 = await fetch(SUPABASE_URL + '/rest/v1/cliente_banco_limites?cliente_id=eq.07ce819d-8557-4877-9dd6-ecb84b4809cf&select=*', {
    headers: H
  });
  const limites = await r3.json();
  console.log('\nTEST 3 - Limites configurados para maria:', limites.length);

  console.log('\n=== RESUMEN ===');
  const t1ok = Array.isArray(bancos) && bancos.length > 0;
  const t2ok = Array.isArray(bancosDisp) && bancosDisp.length > 0;
  const t3ok = Array.isArray(limites) && limites.length > 0;
  console.log(t1ok ? 'OK' : 'FAIL', '- ClienteConfiguracion puede ver bancos');
  console.log(t2ok ? 'OK' : 'FAIL', '- NuevaSubasta puede obtener bancos disponibles');
  console.log(t3ok ? 'OK' : 'FAIL', '- Maria tiene limites configurados');
}

main().catch(e => console.error('Error:', e.message));
