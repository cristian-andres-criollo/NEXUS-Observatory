# Instrucciones Operativas de los Agentes

Este documento describe las instrucciones estándar que los agentes deben seguir para aplicar los patrones de diseño acordados.

## Patrón de Inicialización y Control de Progreso
1. **Planificación**: Antes de ejecutar cualquier tarea compleja, el agente (Planificador) debe redactar un plan de ejecución dividido en pasos discretos.
2. **Registro de Estado**: El progreso se debe rastrear marcando con una "X" (o estado análogo `[x]`) los pasos completados.
3. **Puntos de Control**: Después de cada paso crítico, se debe evaluar el resultado. Si hay error, se detiene el agente.

## Patrón de Tres Agentes
El trabajo debe dividirse en 3 roles claros:
- **Planificador**: Analiza el requerimiento del usuario y define los pasos. (Usa modelo Frontier).
- **Generador/Constructor**: Ejecuta la acción específica asignada (ej. extraer metadatos de un archivo). (Usa modelo Small/Económico).
- **Evaluador/Inspector**: Verifica el trabajo del Generador. Si no es correcto, levanta una excepción para que el arnés detenga la ejecución.
