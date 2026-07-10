import React, { useState } from 'react'
import { FileText, Download, ChevronDown } from 'lucide-react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import toast from 'react-hot-toast'

interface PDFReportGeneratorProps {
  targetElementId: string
  fileNamePrefix?: string
}

export function PDFReportGenerator({ targetElementId, fileNamePrefix = 'Nexus_Report' }: PDFReportGeneratorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  const periods = [
    { id: 'mes', label: 'Reporte Mensual' },
    { id: 'trimestre', label: 'Reporte Trimestral' },
    { id: 'semestre', label: 'Reporte Semestral' },
    { id: 'anual', label: 'Reporte Anual' },
  ]

  const generatePDF = async (period: string) => {
    setIsOpen(false)
    const element = document.getElementById(targetElementId)
    if (!element) {
      toast.error('No se encontró el contenido para exportar')
      return
    }

    setIsGenerating(true)
    const loadingToast = toast.loading(`Generando reporte ${period}...`)

    try {
      // Temporarily hide elements that shouldn't be in the PDF
      const hideElements = document.querySelectorAll('.no-print')
      hideElements.forEach(el => (el as HTMLElement).style.display = 'none')

      const canvas = await html2canvas(element, {
        scale: 2, // High resolution
        useCORS: true,
        backgroundColor: '#ffffff', // Fondo blanco para el reporte corporativo
        logging: false,
      })

      hideElements.forEach(el => (el as HTMLElement).style.display = '')

      const imgData = canvas.toDataURL('image/jpeg', 0.95)
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      })

      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      const imgProps = pdf.getImageProperties(imgData)
      
      const margin = 0
      const contentWidth = pdfWidth - (margin * 2)
      const contentHeight = (imgProps.height * contentWidth) / imgProps.width
      
      // Ya no dibujamos header azul sobre el PDF porque la plantilla HTML ya lo incluye.
      // Solo pegamos la imagen que capturó html2canvas.
      if (contentHeight <= pdfHeight) {
        pdf.addImage(imgData, 'JPEG', margin, 0, contentWidth, contentHeight)
      } else {
        const scaledWidth = (imgProps.width * pdfHeight) / imgProps.height
        pdf.addImage(imgData, 'JPEG', (pdfWidth - scaledWidth) / 2, 0, scaledWidth, pdfHeight)
      }

      pdf.save(`${fileNamePrefix}_${period}_${new Date().toISOString().split('T')[0]}.pdf`)
      toast.success('Reporte generado exitosamente', { id: loadingToast })
    } catch (error) {
      console.error(error)
      toast.error('Error al generar el PDF', { id: loadingToast })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isGenerating}
        className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-nexus-blue/40 bg-nexus-blue/10 text-nexus-blue hover:bg-nexus-blue/25 transition-all duration-300 font-mono text-[10px] tracking-wider uppercase font-bold shadow-[0_0_15px_rgba(14,74,255,0.15)] no-print"
      >
        {isGenerating ? (
          <div className="w-3.5 h-3.5 border-2 border-nexus-blue border-t-transparent rounded-full animate-spin" />
        ) : (
          <FileText size={14} />
        )}
        <span>{isGenerating ? 'Generando...' : 'Reportes'}</span>
        <ChevronDown size={14} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-48 rounded-xl bg-nexus-darker border border-white/10 shadow-xl z-50 overflow-hidden animate-fade-in-up-delay-1 no-print">
            {periods.map((p) => (
              <button
                key={p.id}
                onClick={() => generatePDF(p.id)}
                className="w-full text-left px-4 py-3 text-xs text-nexus-dim hover:text-white hover:bg-white/5 transition-colors flex items-center justify-between group font-body"
              >
                {p.label}
                <Download size={12} className="opacity-0 group-hover:opacity-100 text-nexus-cyan transition-opacity" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
