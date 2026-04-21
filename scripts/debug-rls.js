const PAT = 'sbp_da5aa4edb8c1134b8b3cd6fd4a78c19bb0663336';
const PROJECT_REF = 'ewcvkvnnixrxmiruzmie';
const SUPABASE_URL = 'https://ewcvkvnnixrxmiruzmie.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3Y3Zrdm5uaXhyeG1pcnV6bWllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwMTg2OTgsImV4cCI6MjA4NDU5NDY5OH0.hOvLsfFlKHMMn9faVQ6NeTbBMBjfLBjjTIudHz2ZExs';

async function query(sql) {
  const r = await fetch('https://api.supabase.com/v1/projects/' + PROJECT_REF + '/database/query', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + PAT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql })
  });
  return r.json();
}

async function main() {
  // 1. Ver TODOS los triggers
  const triggers = await query(`
    SELECT DISTINCT event_object_table, trigger_name, event_manipulation, action_statement
    FROM information_schema.triggers
    WHERE trigger_schema = 'public'
    ORDER BY event_object_table, trigger_name, event_manipulation
  `);

  console.log('\n=== TODOS LOS TRIGGERS ===');
  triggers.forEach(t => console.log(t.event_object_table, '->', t.trigger_name, '(', t.event_manipulation, '):', t.action_statement));

  // 2. Ver qué hay en validate_subasta (función trigger para INSERT)
  const validateFn = await query(`SELECT prosrc, prosecdef, proconfig FROM pg_proc WHERE proname = 'validate_subasta'`);
  console.log('\n=== validate_subasta ===');
  console.log('SECDEF:', validateFn[0]?.prosecdef, '| CONFIG:', JSON.stringify(validateFn[0]?.proconfig));
  console.log(validateFn[0]?.prosrc);

  // 3. Probar: simplificar la policy subastas_cliente_insert a solo auth.uid()
  // (sin get_user_role) para ver si ESO causa la recursion
  console.log('\n=== TEST: Simplificar policy ===');
  await query(`
    DROP POLICY IF EXISTS "subastas_cliente_insert_test" ON subastas;
    DROP POLICY IF EXISTS "subastas_cliente_insert" ON subastas;
    CREATE POLICY "subastas_cliente_insert" ON subastas
      FOR INSERT WITH CHECK (cliente_id = auth.uid());
  `);
  console.log('Policy simplificada (sin get_user_role)');

  // Test inserción
  const auth = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'maria@test.com', password: 'Fundlink2025!' })
  }).then(r => r.json());

  const H = { 'apikey': ANON_KEY, 'Authorization': 'Bearer ' + auth.access_token, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };
  const expires = new Date();
  expires.setMinutes(expires.getMinutes() + 30);

  const r = await fetch(SUPABASE_URL + '/rest/v1/subastas', {
    method: 'POST', headers: H,
    body: JSON.stringify({
      cliente_id: '07ce819d-8557-4877-9dd6-ecb84b4809cf',
      tipo: 'abierta', moneda: 'USD', monto: 10000000, plazo: 30, duracion: 30,
      tramos: [100], estado: 'abierta', aprobada: false, expires_at: expires.toISOString()
    })
  });
  const subasta = await r.json();

  if (Array.isArray(subasta) && subasta[0]?.id) {
    console.log('CREATE SUBASTA: OK con policy simplificada! ID:', subasta[0].id);
    // Cleanup
    await fetch(SUPABASE_URL + '/rest/v1/subastas?id=eq.' + subasta[0].id, { method: 'DELETE', headers: H });

    // Restaurar policy correcta
    await query(`
      DROP POLICY IF EXISTS "subastas_cliente_insert" ON subastas;
      CREATE POLICY "subastas_cliente_insert" ON subastas
        FOR INSERT WITH CHECK (cliente_id = auth.uid() AND get_user_role() = 'cliente');
    `);
    console.log('Policy restaurada correctamente.');
  } else {
    console.log('CREATE SUBASTA: AUN FALLA con policy simplificada:', JSON.stringify(subasta));
    console.log('=> La recursion NO es en la policy, es en un TRIGGER');

    // Restaurar policy
    await query(`
      DROP POLICY IF EXISTS "subastas_cliente_insert" ON subastas;
      CREATE POLICY "subastas_cliente_insert" ON subastas
        FOR INSERT WITH CHECK (cliente_id = auth.uid() AND get_user_role() = 'cliente');
    `);
  }
}

main().catch(e => console.log('Error:', e.message));
