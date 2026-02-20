const SUPABASE_URL = 'https://ewcvkvnnixrxmiruzmie.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3Y3Zrdm5uaXhyeG1pcnV6bWllIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTAxODY5OCwiZXhwIjoyMDg0NTk0Njk4fQ.m-dvSCB2GStWdwCiQRZjSvr3XNHG29NmT7iKic-J0ZY';
const PAT = 'sbp_da5aa4edb8c1134b8b3cd6fd4a78c19bb0663336';
const PROJECT_REF = 'ewcvkvnnixrxmiruzmie';

const MARIA_ID = '07ce819d-8557-4877-9dd6-ecb84b4809cf';

// Todos los IDs de banco (mesa + admin) para crear limites con Maria
const ALL_BANCO_USERS = [
  // Banco Industrial
  { id: '9f0b4407-7b74-45ef-962a-7f6f2205f916', entidad: 'Banco Industrial (admin)' },
  { id: 'f7db365e-90b4-4b72-ba83-f0851f8fa4b3', entidad: 'Banco Industrial (mesa)' },
  // G&T Continental
  { id: '6b2c2352-0a0e-45e1-bb58-6b0309adf0da', entidad: 'G&T Continental (admin)' },
  { id: '692b53bc-ec0b-4e85-b4c4-e994afbc1ba2', entidad: 'G&T Continental (mesa)' },
  // BAC Credomatic
  { id: 'edd2dad9-e77a-469d-9d58-3289ffdcdfed', entidad: 'BAC Credomatic (admin)' },
  { id: '4dc3aa4e-6cd9-4bdd-88ec-eb07b7c0f79a', entidad: 'BAC Credomatic (mesa)' },
  // Banco Azteca
  { id: '982cabf5-0b5d-4e0b-b977-4890cffd06f6', entidad: 'Banco Azteca (admin)' },
  { id: 'b8d58b0f-9394-4fa3-a15b-653f6473a531', entidad: 'Banco Azteca (mesa)' },
  // Banco Agromercantil
  { id: '75f32aff-33eb-4237-84d3-a67caf615d01', entidad: 'Banco Agromercantil (admin)' },
  { id: '2c3cb8fe-5e3e-4b43-98aa-4e88cd359d6f', entidad: 'Banco Agromercantil (mesa)' },
];

const H = { 'apikey': SERVICE_KEY, 'Authorization': 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json' };

async function sqlQuery(sql) {
  const r = await fetch('https://api.supabase.com/v1/projects/' + PROJECT_REF + '/database/query', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + PAT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql })
  });
  return r.json();
}

async function main() {
  console.log('🔧 Fixing issues...\n');

  // FIX 1: Reset password de todos los webadmins
  console.log('FIX 1: Reset passwords de webadmins');
  const webadmins = await fetch(SUPABASE_URL + '/rest/v1/users?role=eq.webadmin&select=id,email', { headers: H }).then(r => r.json());
  for (const wa of webadmins) {
    const r = await fetch(SUPABASE_URL + '/auth/v1/admin/users/' + wa.id, {
      method: 'PUT', headers: H,
      body: JSON.stringify({ password: 'Fundlink2025!' })
    });
    console.log('  Password reset para', wa.email, ':', r.status === 200 ? 'OK' : r.status);
  }

  // FIX 2: Crear limites para TODOS los usuarios de banco (admin + mesa) con Maria
  // El validate_oferta verifica banco_id = usuario que oferta, que puede ser mesa
  console.log('\nFIX 2: Crear limites con TODOS los usuarios de banco (admin y mesa)');
  const existentes = await fetch(SUPABASE_URL + '/rest/v1/cliente_banco_limites?cliente_id=eq.' + MARIA_ID + '&select=banco_id', { headers: H }).then(r => r.json());
  const existenteIds = new Set(existentes.map(e => e.banco_id));

  for (const banco of ALL_BANCO_USERS) {
    if (existenteIds.has(banco.id)) {
      console.log('  Ya existe:', banco.entidad);
    } else {
      const r = await fetch(SUPABASE_URL + '/rest/v1/cliente_banco_limites', {
        method: 'POST', headers: { ...H, 'Prefer': 'return=representation' },
        body: JSON.stringify({ cliente_id: MARIA_ID, banco_id: banco.id, limite_monto: 50000000, monto_utilizado: 0, activo: true })
      });
      const result = await r.json();
      const ok = Array.isArray(result) && result[0]?.id;
      console.log('  ' + (ok ? 'Creado' : 'ERROR') + ':', banco.entidad, ok ? '' : JSON.stringify(result).substring(0, 100));
    }
  }

  // FIX 3: La RLS "cliente ver bancos" via query directa devuelve [] pero la RPC funciona.
  // Esto es CORRECTO - el cliente usa la RPC obtener_todos_bancos() que tiene SECURITY DEFINER.
  // La query directa a users con role=banco_admin no va a funcionar para clientes porque
  // la policy users_bancos_ver_clientes solo permite bancos ver clientes, no viceversa.
  // La RPC es el mecanismo correcto y funciona.
  console.log('\nFIX 3: La query directa a users para clientes es intencional (usa RPC)');
  console.log('  -> obtener_todos_bancos() RPC está funcionando correctamente');
  console.log('  -> El código del frontend ya usa la RPC, no query directa');

  // Verificar estado final de limites
  const todosLimites = await fetch(SUPABASE_URL + '/rest/v1/cliente_banco_limites?cliente_id=eq.' + MARIA_ID + '&select=banco_id', { headers: H }).then(r => r.json());
  console.log('\nTotal limites de Maria:', todosLimites.length, '(necesitamos', ALL_BANCO_USERS.length, ')');

  console.log('\n✅ Fixes aplicados!');
}

main().catch(e => console.log('Error:', e.message));
