// Estrategia: probar desactivando el trigger audit_subastas temporalmente
const PAT = 'sbp_da5aa4edb8c1134b8b3cd6fd4a78c19bb0663336';
const PROJECT_REF = 'ewcvkvnnixrxmiruzmie';
const SUPABASE_URL = 'https://ewcvkvnnixrxmiruzmie.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3Y3Zrdm5uaXhyeG1pcnV6bWllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwMTg2OTgsImV4cCI6MjA4NDU5NDY5OH0.hOvLsfFlKHMMn9faVQ6NeTbBMBjfLBjjTIudHz2ZExs';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3Y3Zrdm5uaXhyeG1pcnV6bWllIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTAxODY5OCwiZXhwIjoyMDg0NTk0Njk4fQ.m-dvSCB2GStWdwCiQRZjSvr3XNHG29NmT7iKic-J0ZY';

async function sqlQuery(sql) {
  const r = await fetch('https://api.supabase.com/v1/projects/' + PROJECT_REF + '/database/query', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + PAT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql })
  });
  return r.json();
}

async function testInsertSubasta(label) {
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
    // Cleanup con service key
    await fetch(SUPABASE_URL + '/rest/v1/subastas?id=eq.' + subasta[0].id, {
      method: 'DELETE',
      headers: { 'apikey': SERVICE_KEY, 'Authorization': 'Bearer ' + SERVICE_KEY }
    });
    console.log(label + ': OK');
    return true;
  } else {
    console.log(label + ': FAIL -', subasta.message || JSON.stringify(subasta));
    return false;
  }
}

async function main() {
  // Estrategia: probar reemplazando audit_changes para que NO haga SELECT a users
  console.log('\n=== TEST 1: Simplificar audit_changes (sin SELECT a users) ===');
  await sqlQuery(`
    CREATE OR REPLACE FUNCTION audit_changes()
    RETURNS TRIGGER AS $func$
    BEGIN
      INSERT INTO auditoria (user_id, accion, detalle, metadata)
      VALUES (
        auth.uid(),
        TG_OP || '_' || TG_TABLE_NAME,
        CASE WHEN TG_OP = 'INSERT' THEN 'Creado' WHEN TG_OP = 'DELETE' THEN 'Eliminado' ELSE 'Actualizado' END,
        jsonb_build_object('table', TG_TABLE_NAME, 'operation', TG_OP, 'record_id', COALESCE(NEW.id, OLD.id))
      );
      RETURN COALESCE(NEW, OLD);
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER SET row_security = off;
  `);
  const ok1 = await testInsertSubasta('Con audit_changes simplificado');

  if (!ok1) {
    // Si sigue fallando, el trigger audit no es el problema
    // Probar dropear el trigger completamente
    console.log('\n=== TEST 2: Drop trigger audit_subastas temporalmente ===');
    await sqlQuery('DROP TRIGGER IF EXISTS audit_subastas ON subastas;');
    const ok2 = await testInsertSubasta('Sin trigger audit_subastas');

    if (!ok2) {
      // El problema es validate_subasta o algo más profundo
      console.log('\n=== TEST 3: Drop validate_subasta_trigger ===');
      await sqlQuery('DROP TRIGGER IF EXISTS validate_subasta_trigger ON subastas;');
      const ok3 = await testInsertSubasta('Sin ningún trigger en subastas');

      if (ok3) {
        console.log('=> validate_subasta_trigger es el problema');
        // Restaurar validate_subasta con SECURITY DEFINER
        await sqlQuery(`
          CREATE TRIGGER validate_subasta_trigger
            BEFORE INSERT OR UPDATE ON subastas
            FOR EACH ROW EXECUTE FUNCTION validate_subasta();
        `);
      } else {
        console.log('=> El problema está en las POLICIES mismas, no en triggers');
      }
    } else {
      console.log('=> audit_subastas trigger era el problema');
    }

    // Restaurar audit trigger
    await sqlQuery(`
      CREATE TRIGGER audit_subastas
        AFTER INSERT OR UPDATE OR DELETE ON subastas
        FOR EACH ROW EXECUTE FUNCTION audit_changes();
    `);
    console.log('Trigger audit_subastas restaurado.');
  }
}

main().catch(e => console.log('Error:', e.message));
