export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
export function formatCost(cost: number): string {
  if (cost === 0) return '$0.000000'
  return `$${cost.toFixed(6)}`
}
export function formatTokens(tokens: number): string {
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`
  return tokens.toString()
}
export function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`
  return `${ms}ms`
}
export function scoreColor(score: number, inverse: boolean = false): string {
  // value va de 0 (Malo) a 1 (Bueno)
  const value = inverse ? 1.0 - score : score
  // 0 Hue = Rojo, 120 Hue = Verde
  const hue = value * 120
  return `hsl(${hue}, 100%, 50%)`
}
export function scoreLabel(score: number): string {
  if (score >= 0.8) return 'ALTO'
  if (score >= 0.5) return 'MEDIO'
  return 'BAJO'
}
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}
