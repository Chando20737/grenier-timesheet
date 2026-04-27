import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function suggestTaskFromEmail(from: string, subject: string, snippet: string, categories: string[]) {
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    system: `Tu analyses un courriel et génères une entrée de feuille de temps.
Réponds UNIQUEMENT en JSON valide sans markdown:
{ "task": "description courte max 60 chars", "category": "la catégorie la plus pertinente parmi: ${categories.join(', ')}", "duration": "durée estimée ex: 1h 30" }`,
    messages: [{ role: 'user', content: `De: ${from}\nSujet: ${subject}\nContenu: ${snippet}` }]
  })
  const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
  return JSON.parse(text.replace(/```json|```/g, '').trim())
}
