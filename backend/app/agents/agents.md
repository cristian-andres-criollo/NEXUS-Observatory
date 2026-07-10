# Reglas y Contexto del Arnés (Harness) para Agentes

Este archivo define el **Arnés (Harness)** para todos los agentes de IA dentro de la plataforma NEXUS Observatory. Su propósito es actuar como el "bozal" del agente, delimitando claramente qué puede y qué no puede hacer.

## 1. Permisos y Seguridad
- **Solo Lectura por Defecto**: Los agentes no deben modificar el código del sistema principal bajo ninguna circunstancia, excepto cuando operen dentro de un Sandbox explícito y autorizado.
- **Acceso a Base de Datos**: Los agentes no tienen permisos para ejecutar comandos como `DROP`, `TRUNCATE`, o `DELETE` sin cláusula `WHERE`. Cualquier escritura a la base de datos (por ejemplo, guardar resultados del análisis) debe hacerse exclusivamente a través de los modelos ORM predefinidos.
- **Aislamiento (Sandboxing)**: Cuando un agente clona un repositorio o manipula archivos externos, DEBE hacerlo en un directorio temporal (`/tmp` o `tempfile.mkdtemp()`) y DEBE asegurar que dicho directorio se elimine al finalizar (`finally: shutil.rmtree()`).

## 2. Gestión de Costos (FinOps)
- **Delegación**: Las tareas de planificación y división del problema deben usar modelos de frontera (Planner). Las tareas específicas y repetitivas deben delegarse a modelos más pequeños y económicos (Executor/Generator).
- **Límites**: El agente debe respetar los límites de presupuesto (budgets) configurados a través del enrutador (LiteLLM).

## 3. Comportamiento ante Fallos
- **Cero Infinidad**: Si un agente encuentra un error o ambigüedad, NO debe intentar reintentos infinitos que consuman tokens. Debe detener la ejecución, registrar el progreso actual y devolver el control al usuario (Patrón de Control de Progreso).
