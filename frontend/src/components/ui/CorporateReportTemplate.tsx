import React from 'react'

interface CorporateReportTemplateProps {
  metrics: any
  period: string
}

export function CorporateReportTemplate({ metrics, period }: CorporateReportTemplateProps) {
  if (!metrics) return null

  // Helper para moneda
  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 6 }).format(val)

  return (
    // Escondido visualmente del usuario, pero disponible en el DOM para html2canvas
    <div className="fixed top-[-9999px] left-[-9999px]">
      <div 
        id="corporate-pdf-template" 
        className="bg-white text-gray-900 font-sans p-12"
        // Proporción A4 a 96 DPI: 794x1123 px
        style={{ width: '794px', minHeight: '1123px' }}
      >
        {/* ENCABEZADO */}
        <div className="border-b-2 border-blue-800 pb-6 mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black text-blue-900 tracking-tight uppercase">
              NEXUS OBSERVATORY
            </h1>
            <p className="text-sm text-gray-500 mt-1 font-medium tracking-widest uppercase">
              Centro de Telemetría e Inteligencia Artificial
            </p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold text-gray-800 uppercase">
              Reporte {period}
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Generado: {new Date().toLocaleString()}
            </p>
          </div>
        </div>

        {/* RESUMEN EJECUTIVO */}
        <div className="mb-10">
          <h3 className="text-lg font-bold text-gray-800 border-b border-gray-300 pb-2 mb-4 uppercase tracking-wider">
            Resumen Ejecutivo FinOps
          </h3>
          <div className="grid grid-cols-3 gap-6">
            <div className="bg-gray-50 p-4 border border-gray-200 rounded-lg">
              <p className="text-xs text-gray-500 font-bold uppercase mb-1">Conversaciones Totales</p>
              <p className="text-2xl font-black text-blue-900">{metrics.total_conversations.toLocaleString()}</p>
            </div>
            <div className="bg-gray-50 p-4 border border-gray-200 rounded-lg">
              <p className="text-xs text-gray-500 font-bold uppercase mb-1">Tokens Consumidos</p>
              <p className="text-2xl font-black text-blue-900">{metrics.total_tokens.toLocaleString()}</p>
            </div>
            <div className="bg-gray-50 p-4 border border-gray-200 rounded-lg">
              <p className="text-xs text-gray-500 font-bold uppercase mb-1">Costo Total (USD)</p>
              <p className="text-2xl font-black text-green-700">{formatCurrency(metrics.total_cost_usd)}</p>
            </div>
          </div>
        </div>

        {/* DESGLOSE POR MÓDULOS */}
        <div className="mb-10">
          <h3 className="text-lg font-bold text-gray-800 border-b border-gray-300 pb-2 mb-4 uppercase tracking-wider">
            Distribución por Módulos Operativos
          </h3>
          <table className="w-full text-sm text-left text-gray-600 border-collapse">
            <thead className="text-xs text-gray-700 uppercase bg-gray-100 border-y border-gray-300">
              <tr>
                <th className="px-4 py-3">Módulo de IA</th>
                <th className="px-4 py-3 text-right">Peticiones</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(metrics.conversations_by_module).length > 0 ? (
                Object.entries(metrics.conversations_by_module).map(([module, count]: any, idx) => (
                  <tr key={module} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900 uppercase">
                      {module.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-blue-800">
                      {count.toLocaleString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={2} className="px-4 py-6 text-center text-gray-400 italic">
                    Sin datos recolectados en este periodo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* LOG DE TRANSACCIONES RECIENTES */}
        <div className="mb-10">
          <h3 className="text-lg font-bold text-gray-800 border-b border-gray-300 pb-2 mb-4 uppercase tracking-wider">
            Registro de Auditoría (Últimas Peticiones)
          </h3>
          <table className="w-full text-xs text-left text-gray-600 border-collapse">
            <thead className="text-[10px] text-gray-500 uppercase bg-gray-50 border-y border-gray-200">
              <tr>
                <th className="px-3 py-2">Fecha/Hora</th>
                <th className="px-3 py-2">Módulo</th>
                <th className="px-3 py-2 text-right">Tokens</th>
                <th className="px-3 py-2 text-right">Costo (USD)</th>
              </tr>
            </thead>
            <tbody>
              {metrics.recent_conversations?.length > 0 ? (
                metrics.recent_conversations.slice(0, 15).map((conv: any) => (
                  <tr key={conv.id} className="border-b border-gray-100">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {new Date(conv.created_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 uppercase text-[10px] font-bold text-blue-900">
                      {conv.module.replace(/_/g, ' ')}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {conv.tokens_used.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-green-700">
                      ${conv.cost_usd.toFixed(6)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-gray-400 italic">
                    No hay transacciones recientes registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* FOOTER */}
        <div className="absolute bottom-12 left-12 right-12 pt-4 border-t border-gray-300 flex justify-between items-center text-xs text-gray-400 uppercase tracking-widest font-bold">
          <span>Confidencial - Propiedad de Nexus Observatory</span>
          <span>Página 1 de 1</span>
        </div>
      </div>
    </div>
  )
}
