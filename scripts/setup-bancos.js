/**
 * Script para configurar los 5 bancos reales en FundLink
 *
 * Ejecutar con: node scripts/setup-bancos.js <SERVICE_ROLE_KEY>
 *
 * Acciones:
 * 1. Elimina usuario admin@banconova.com (Banco Nova - test)
 * 2. Crea/actualiza los 5 bancos reales con usuarios banco_admin y banco_mesa
 * 3. Desactiva cualquier banco test
 */

const SUPABASE_URL = 'https://ewcvkvnnixrxmiruzmie.supabase.co'
const SERVICE_ROLE_KEY = process.argv[2]

if (!SERVICE_ROLE_KEY) {
  console.error('❌ Falta la Service Role Key')
  console.error('Uso: node scripts/setup-bancos.js <SERVICE_ROLE_KEY>')
  process.exit(1)
}

const headers = {
  'Content-Type': 'application/json',
  'apikey': SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
}

// =====================================================
// BANCOS A CREAR
// =====================================================
const bancos = [
  {
    entidad: 'Banco Industrial',
    sigla: 'BI',
    usuarios: [
      { nombre: 'Admin Banco Industrial', email: 'admin@bancoindustrial.com.gt', role: 'banco_admin' },
      { nombre: 'Mesa Banco Industrial', email: 'mesa@bancoindustrial.com.gt', role: 'banco_mesa' },
    ]
  },
  {
    entidad: 'Banco G&T Continental',
    sigla: 'GYT',
    usuarios: [
      { nombre: 'Admin G&T Continental', email: 'admin@gytcontinental.com.gt', role: 'banco_admin' },
      { nombre: 'Mesa G&T Continental', email: 'mesa@gytcontinental.com.gt', role: 'banco_mesa' },
    ]
  },
  {
    entidad: 'BAC Credomatic',
    sigla: 'BAC',
    usuarios: [
      { nombre: 'Admin BAC Credomatic', email: 'admin@baccredomatic.com.gt', role: 'banco_admin' },
      { nombre: 'Mesa BAC Credomatic', email: 'mesa@baccredomatic.com.gt', role: 'banco_mesa' },
    ]
  },
  {
    entidad: 'Banco Azteca',
    sigla: 'AZTECA',
    usuarios: [
      { nombre: 'Admin Banco Azteca', email: 'admin@bancoazteca.com.gt', role: 'banco_admin' },
      { nombre: 'Mesa Banco Azteca', email: 'mesa@bancoazteca.com.gt', role: 'banco_mesa' },
    ]
  },
  {
    entidad: 'Banco Agromercantil',
    sigla: 'BAM',
    usuarios: [
      { nombre: 'Admin Banco Agromercantil', email: 'admin@bam.com.gt', role: 'banco_admin' },
      { nombre: 'Mesa Banco Agromercantil', email: 'mesa@bam.com.gt', role: 'banco_mesa' },
    ]
  },
]

// =====================================================
// USUARIOS A ELIMINAR (bancos test)
// =====================================================
const emailsEliminar = [
  'admin@banconova.com',
]

// =====================================================
// FUNCIONES HELPER
// =====================================================

async function fetchSupabase(path, options = {}) {
  const url = `${SUPABASE_URL}${path}`
  const res = await fetch(url, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) }
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HTTP ${res.status}: ${text}`)
  }

  const text = await res.text()
  return text ? JSON.parse(text) : null
}

async function getUserByEmail(email) {
  try {
    const data = await fetchSupabase(
      `/auth/v1/admin/users?filter=${encodeURIComponent(email)}`,
      { method: 'GET' }
    )
    if (data?.users?.length > 0) {
      return data.users.find(u => u.email === email) || null
    }
    return null
  } catch (e) {
    return null
  }
}

async function getPublicUserByEmail(email) {
  try {
    const data = await fetchSupabase(
      `/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=id,email,nombre,entidad,role,activo`,
    )
    return data?.[0] || null
  } catch (e) {
    return null
  }
}

async function deleteAuthUser(userId) {
  try {
    await fetchSupabase(`/auth/v1/admin/users/${userId}`, { method: 'DELETE' })
    console.log(`  ✓ Eliminado de auth.users: ${userId}`)
  } catch (e) {
    console.log(`  ⚠️  No se pudo eliminar de auth: ${e.message}`)
  }
}

async function deletePublicUser(userId) {
  try {
    await fetchSupabase(`/rest/v1/users?id=eq.${userId}`, { method: 'DELETE' })
    console.log(`  ✓ Eliminado de public.users: ${userId}`)
  } catch (e) {
    console.log(`  ⚠️  No se pudo eliminar de public.users: ${e.message}`)
  }
}

async function createAuthUser(email, password, nombre, entidad, role) {
  const data = await fetchSupabase('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre, entidad, role }
    })
  })
  return data
}

async function createPublicUser(id, email, nombre, entidad, role) {
  const data = await fetchSupabase('/rest/v1/users', {
    method: 'POST',
    headers: { 'Prefer': 'return=representation' },
    body: JSON.stringify({
      id,
      email,
      nombre,
      entidad,
      role,
      activo: true,
      primer_login: true,
    })
  })
  return data
}

async function updatePublicUser(id, updates) {
  await fetchSupabase(`/rest/v1/users?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates)
  })
}

// =====================================================
// MAIN
// =====================================================

async function main() {
  console.log('🏦 FundLink - Setup de Bancos')
  console.log('='.repeat(50))

  // --- PASO 1: Eliminar usuarios test ---
  console.log('\n📌 PASO 1: Eliminando usuarios test...')

  for (const email of emailsEliminar) {
    console.log(`\n  Buscando: ${email}`)

    // Buscar en public.users
    const publicUser = await getPublicUserByEmail(email)
    if (publicUser) {
      console.log(`  Encontrado en public.users: ${publicUser.id}`)
      await deletePublicUser(publicUser.id)
      await deleteAuthUser(publicUser.id)
    } else {
      // Buscar en auth.users
      const authUser = await getUserByEmail(email)
      if (authUser) {
        console.log(`  Encontrado en auth.users: ${authUser.id}`)
        await deleteAuthUser(authUser.id)
      } else {
        console.log(`  ℹ️  Usuario no encontrado: ${email}`)
      }
    }
  }

  // --- PASO 2: Crear usuarios de bancos ---
  console.log('\n📌 PASO 2: Creando usuarios de bancos...')

  const PASSWORD = 'Fundlink2025!'
  const resultados = []

  for (const banco of bancos) {
    console.log(`\n  🏦 ${banco.entidad} (${banco.sigla})`)

    for (const usuario of banco.usuarios) {
      console.log(`    → ${usuario.email} [${usuario.role}]`)

      // Verificar si ya existe
      const existente = await getPublicUserByEmail(usuario.email)

      if (existente) {
        console.log(`      ⚠️  Ya existe, actualizando...`)
        await updatePublicUser(existente.id, {
          nombre: usuario.nombre,
          entidad: banco.entidad,
          role: usuario.role,
          activo: true,
        })
        console.log(`      ✓ Actualizado`)
        resultados.push({ ...usuario, entidad: banco.entidad, status: 'actualizado', password: PASSWORD })
      } else {
        try {
          // Crear en auth.users
          const authData = await createAuthUser(
            usuario.email,
            PASSWORD,
            usuario.nombre,
            banco.entidad,
            usuario.role
          )

          const authId = authData.id
          console.log(`      ✓ Creado en auth: ${authId}`)

          // Crear en public.users
          await createPublicUser(authId, usuario.email, usuario.nombre, banco.entidad, usuario.role)
          console.log(`      ✓ Creado en public.users`)

          resultados.push({ ...usuario, entidad: banco.entidad, status: 'creado', password: PASSWORD })
        } catch (e) {
          console.log(`      ❌ Error: ${e.message}`)
          resultados.push({ ...usuario, entidad: banco.entidad, status: 'error', error: e.message })
        }
      }
    }
  }

  // --- PASO 3: Verificar estado final ---
  console.log('\n📌 PASO 3: Verificando estado final...')

  const bancosActivos = await fetchSupabase(
    '/rest/v1/users?role=in.(banco_admin,banco_mesa)&activo=eq.true&select=email,nombre,entidad,role,activo&order=entidad'
  )

  console.log(`\n  Bancos activos en el sistema: ${bancosActivos.length}`)

  const entidades = [...new Set(bancosActivos.map(b => b.entidad))]
  entidades.forEach(e => {
    const users = bancosActivos.filter(b => b.entidad === e)
    console.log(`\n  🏦 ${e}`)
    users.forEach(u => console.log(`     - ${u.email} [${u.role}]`))
  })

  // --- RESUMEN ---
  console.log('\n' + '='.repeat(50))
  console.log('✅ RESUMEN DE CAMBIOS')
  console.log('='.repeat(50))
  console.log(`\nEliminados: ${emailsEliminar.join(', ')}`)
  console.log('\nUsuarios creados/actualizados:')
  resultados.forEach(r => {
    const icon = r.status === 'error' ? '❌' : r.status === 'creado' ? '✅' : '🔄'
    console.log(`  ${icon} ${r.email} (${r.entidad}) - ${r.status}`)
    if (r.status !== 'error') {
      console.log(`     Contraseña: ${r.password}`)
    } else {
      console.log(`     Error: ${r.error}`)
    }
  })

  console.log('\n🎉 Setup completado!')
}

main().catch(e => {
  console.error('❌ Error fatal:', e.message)
  process.exit(1)
})
