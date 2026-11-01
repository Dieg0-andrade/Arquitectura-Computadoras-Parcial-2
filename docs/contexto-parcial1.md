# Contexto del Parcial 1 (base importada, tag `v0-base-parcial1`)

Este documento resume cómo quedó el simulador al terminar el Parcial 1. Es la base sobre la que se construye el Parcial 2. Úsalo junto con `GUIA_CONTEXTO_IAS.md`.

## Datos generales
- **Materia:** Arquitectura de Computadoras (SIS-131) · UCB Santa Cruz · Docente: Ing. Paulo César Loayza Carrasco
- **Plataforma:** Google Sheets + Google Apps Script.

## Convenciones (siguen vigentes)
- **Idioma:** tareas del backlog y títulos de PR en **inglés**; todo lo demás en **español** (código, nombres, comentarios, commits, docs).
- En inglés quedan solo los nombres técnicos: PC, IR, MAR, MDR, AX, BX, CX, DX, ZF, CF, SF, mnemónicos y la API de Apps Script.
- **Formato de tareas:** título en infinitivo · By · For · Reason · Details · Acceptance criteria.
- **Git:** una rama por tarea → commits convencionales en español (`feat:`, `test:`, `docs:`, `refactor:`, `perf:`, `chore:`) → PR con `Closes #N` → merge → volver a `main` y hacer Pull antes de crear la siguiente rama.

## Arquitectura implementada
- **Von Neumann:** programa almacenado, una sola RAM de 256 bytes para código (00h–7Fh) y datos (80h–FFh), un solo camino MAR/MDR y un bus (cuello de botella). El bus multiplexado y la E/S quedaron para el Parcial 2.
- **Registros:** PC, IR, MAR, MDR, AX, BX, REN1, REN2, RESULTADO_ALU y las banderas ZF, CF y SF. Los nombres de clase también aparecen en la hoja: C.P., R.I., RDM, RIM, R. Estado y C.OP.
- **ISA:** 35 instrucciones de 1 o 2 bytes, agrupadas por nibble alto (0x control, 1x transferencia, 2x aritmética, 3x lógica, 4x saltos). Operandos: `inm`, `[dir]` y `dir`. No hay `ADD` con operando en memoria.
- **Banderas:** toda operación de la ALU recalcula ZF, CF y SF. INC, DEC y NOT también actualizan CF (a diferencia de x86). Las operaciones lógicas dejan CF = 0. En la resta, CF indica préstamo (a < b).
- **Ciclo:** búsqueda (MAR←PC, MDR←RAM[MAR], IR←MDR, PC←PC+1; el PC se incrementa antes de decodificar, como dice el enunciado) → decodificación (busca el operando por MAR/MDR) → ejecución → almacenamiento.
  - Se ejecuta una micro-operación por paso.
  - La cola de micro-operaciones pendientes se guarda en DocumentProperties (`UC_ESTADO`).
- **Ensamblador de dos pasadas:** directivas `.data`/`.code`, `DB`, etiquetas, comentarios con `;` y números `15` / `0x0F` / `0Fh`. Los errores indican el número de línea.
- **Compilador de alto nivel (nivel 2):** `var`, asignación con `+`/`-`, `mientras` y `si` con `==`/`!=`, comentarios `//`. Léxico → parser de descenso recursivo (AST) → ensamblador comentado con `; Ln:`, que se escribe en la hoja Código (columna E) y pasa por el ensamblador. La hoja Compilador muestra todas las etapas. **En el Parcial 2 no se extiende.**
- **Traza:** mapas dirección → línea de ensamblador → línea de alto nivel (DocumentProperties `MAPA_FUENTE` y `MAPA_ALTO`). Se resalta la línea en ejecución en las columnas B y E de la hoja Código.
- **Interfaz:**
  - Hoja CPU titulada "Arquitectura von Neumann", con un panel de las últimas 10 micro-operaciones.
  - Hoja Log con una fila por micro-operación.
  - Resaltado: ámbar = destino, celeste = origen.
  - Controles dentro de la hoja CPU (columna P, casillas que actúan como botones): CARGAR DEMO, COMPILAR, ENSAMBLAR, PASO, INSTRUCCIÓN, EJECUTAR (retardo ajustable), PAUSA, REINICIAR. Los atiende un activador instalable onEdit (`alEditarControles`) creado por `prepararLibro`.
  - Panel lateral opcional `Panel.html`.
- **Demo:** multiplicación por sumas sucesivas, 5 × 3 = 15 en RAM[82h], en ensamblador y en alto nivel.
- **Error conocido de la hoja:** la regla de validación REGEXMATCH fallaba con configuración regional en español. Usar región **Estados Unidos**; además el código valida la entrada del inspector en `onEdit`.

## Archivos (`src/`)
Configuracion, Memoria, VistaRam, Libro, Principal, Registros, ALU, ISA, Bus, EnsambladorLexico, Ensamblador, Compilador, VistaCompilador, MicroOperaciones, UnidadControl, LogMicroops, Resaltado, Traza, Simulacion, ProgramasDemo, Controles, `Panel.html`, `pruebas/` (EjecutorPruebas + 10 suites).

## Pruebas
**102 en total:** Memoria 10, Registros 5, ALU 18, ISA 7, Bus 6, Ensamblador 12, Unidad de control 11, Simulación 12 (incluye los controles de la hoja), Casos borde 11, Compilador y traza 10.
Verificadas con una hoja simulada en Node (`node herramientas/probar-local.js`). **Siempre confirmar también en Google Sheets real.**
