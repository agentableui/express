import { AgentableClient } from '@agentableui/sdk'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const API_KEY = process.env.API_KEY || 'agui_k1_demo_user_key_123'

async function main() {
  console.log('=== AgentableUI Demo Agent ===\n')

  // ── Phase 1: Discovery + planning (no auth needed for manifest) ──
  console.log('--- Phase 1: Discovery & Planning ---\n')

  const publicClient = new AgentableClient(BASE_URL, { role: 'public' })
  const publicManifest = await publicClient.discover()
  console.log(`Discovered: ${publicManifest.name} (role: ${publicManifest.role})`)
  console.log(`States available: ${Object.keys(publicManifest.states).join(', ')}`)
  console.log(`Current state: ${publicClient.currentState!.name}\n`)

  // State graph (public view)
  const graph = publicClient.getStateGraph()
  console.log(`State graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`)
  for (const edge of graph.edges) {
    console.log(`  ${edge.from} --[${edge.action}]--> ${edge.to}`)
  }
  console.log()

  // Validate plan (structural check only — doesn't hit server)
  const plan = publicClient.validatePlan(['search', 'view-product', 'add-to-cart', 'checkout', 'submit-order'])
  console.log(`Plan valid: ${plan.valid}`)
  if (!plan.valid) {
    console.log(`  Failed at: ${plan.failedAt} — ${plan.reason}`)
  }
  console.log()

  // ── Phase 2: Authenticated browsing ──────────────────────────────
  console.log('--- Phase 2: Authenticated Browsing ---\n')

  const client = new AgentableClient(BASE_URL, { apiKey: API_KEY, role: 'user' })
  const manifest = await client.discover()
  console.log(`Authenticated as user — ${Object.keys(manifest.states).length} states available`)
  console.log(`States: ${Object.keys(manifest.states).join(', ')}`)
  console.log(`Current state: ${client.currentState!.name}\n`)

  // Search
  console.log('--- Searching for "shoes" ---')
  const searchResult = await client.execute('search', { query: 'shoes' })
  console.log(`State: ${client.currentState!.name}`)
  if (searchResult.status === 'ok') {
    const results = searchResult.data.results as Array<{ id: string; name: string; price: number }>
    console.log(`Found ${results.length} products:`)
    for (const r of results) {
      console.log(`  ${r.id}: ${r.name} ($${r.price})`)
    }
  }
  console.log()

  // View product
  const productId = 'shoe-001'
  console.log(`--- Viewing product ${productId} ---`)
  const viewResult = await client.execute('view-product', { productId })
  console.log(`State: ${client.currentState!.name}`)
  if (viewResult.status === 'ok') {
    console.log(`Product: ${viewResult.data.name} - $${viewResult.data.price} (stock: ${viewResult.data.stock})`)
  }
  console.log()

  // ── Phase 3: Purchase flow ───────────────────────────────────────
  console.log('--- Phase 3: Purchase Flow ---\n')

  // Add to cart
  console.log('--- Adding to cart ---')
  const addResult = await client.execute('add-to-cart', { productId, quantity: 2, giftWrap: true })
  console.log(`State: ${client.currentState!.name}`)
  if (addResult.status === 'ok') {
    console.log(`Added: ${addResult.data.added} x${addResult.data.quantity} (gift wrap: ${addResult.data.giftWrap})`)
  } else {
    console.log(`Unexpected: ${addResult.status}`, addResult)
  }
  console.log()

  // Check conditions before checkout
  console.log('--- Checking conditions ---')
  const conditions = await client.checkConditions()
  for (const [name, cond] of Object.entries(conditions.conditions)) {
    console.log(`  ${name}: ${cond.met ? 'MET' : 'NOT MET'} — ${cond.description}`)
  }
  console.log()

  // Checkout
  console.log('--- Proceeding to checkout ---')
  await client.execute('checkout')
  console.log(`State: ${client.currentState!.name}\n`)

  // Submit order
  console.log('--- Submitting order ---')
  const orderResult = await client.execute('submit-order', {
    shippingAddress: '123 Main Street, Springfield, IL 62701',
    paymentMethod: 'card',
  })
  console.log(`State: ${client.currentState!.name}`)
  if (orderResult.status === 'ok') {
    console.log(`Order placed! ID: ${orderResult.data.orderId}, Total: $${orderResult.data.total}`)
  } else {
    console.log(`Result: ${orderResult.status}`, orderResult)
  }
  console.log()

  console.log('=== Demo complete ===')
}

main().catch(console.error)
