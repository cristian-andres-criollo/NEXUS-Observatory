// Configuración de formato por moneda
export const CURRENCY_FORMATS: Record<string, { locale: string, symbol: string, decimals: number }> = {
  USD: { locale: 'en-US', symbol: '$', decimals: 4 },
  COP: { locale: 'es-CO', symbol: '$', decimals: 4 },
  MXN: { locale: 'es-MX', symbol: '$', decimals: 4 },
  ARS: { locale: 'es-AR', symbol: '$', decimals: 4 },
  CLP: { locale: 'es-CL', symbol: '$', decimals: 4 },
  PEN: { locale: 'es-PE', symbol: 'S/', decimals: 4 },
};

/**
 * Convierte un valor en USD a la moneda especificada usando las tasas dinámicas del backend.
 */
export function convertUsdTo(amountUsd: number, currency: string, trmRates?: Record<string, number>): number {
  if (!amountUsd) return 0;
  const targetCurrency = currency?.toUpperCase() || 'COP';

  if (targetCurrency === 'USD') return amountUsd;

  // Si trmRates fue provisto por el backend, usamos esa tasa
  if (trmRates && trmRates[targetCurrency]) {
    return amountUsd * trmRates[targetCurrency];
  }

  // Fallback (solo en caso de que aún no cargue la DB)
  const fallbacks: Record<string, number> = { COP: 4000, MXN: 17.5, ARS: 900, CLP: 950, PEN: 3.75 };
  return amountUsd * (fallbacks[targetCurrency] || fallbacks['COP']);
}

/**
 * Formatea un número a texto monetario según la moneda.
 */
export function formatCurrency(amount: number, currency: string): string {
  const targetCurrency = currency?.toUpperCase() || 'COP';
  const config = CURRENCY_FORMATS[targetCurrency] || CURRENCY_FORMATS['COP'];

  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: targetCurrency,
    minimumFractionDigits: config.decimals,
    maximumFractionDigits: config.decimals,
  }).format(amount);
}
