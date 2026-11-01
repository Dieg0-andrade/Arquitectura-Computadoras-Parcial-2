# Guía de contexto para el equipo y sus IAs — Parcial 2

> **Cómo usar este archivo:** al iniciar cualquier chat con tu IA, pega este documento completo, luego pega la tarjeta de la tarea (plantilla en la sección 10) y di quién eres ("soy el Integrante 2"). La IA debe respetar todo lo de aquí: no debe inventar otra arquitectura ni cambiar decisiones de diseño.

---

## 1. Qué estamos construyendo

Materia: Arquitectura de Computadoras (SIS-131), UCB Santa Cruz, docente Ing. Paulo César Loayza Carrasco. Equipo de 3 personas. Es el **Segundo Parcial**: un **simulador de computadora completo en Google Sheets + Google Apps Script** (JavaScript). Extiende el simulador del Parcial 1 (CPU von Neumann de un solo núcleo, un solo proceso, un solo hilo).

Lo que el docente exige (resumen del enunciado):
1. **Registros de 8 bits:** AX, BX, CX, DX + PC, IR, MAR, MDR + banderas ZF, CF, SF.
2. **RAM física de 256 B = 8 marcos de 32 B** y **memoria virtual de 512 B = 16 páginas de 32 B**, con **tabla de marcos** (VPN, bit Presente, PFN, Dirty, Ref) y **Page Fault** con reemplazo FIFO/LRU y swap.
3. **Caché:** L1I 8 B, L1D 8 B, L2 32 B, con animación Hit/Miss, contadores y Hit Rate.
4. **Buses:** control (Read, Write, Clock, IO), direcciones y datos; internos y externos; **buffers tri-estado (High-Z)**: en cada instante **solo un** componente conduce al bus; la hoja ilumina quién conduce. **Micro-palabra de control** por micro-paso: `[En_PC, Ld_MAR, Mem_R, Mem_W, Ld_MDR, En_MDR, Ld_IR, En_ALU, Ld_AX, En_AX, ..., En_KBD, Ld_LCD]`.
5. **E/S mapeada en memoria:** teclado (cola de 8 B) y pantalla LCD 8x1 (buffer de video de 8 B), con instrucciones `IN reg,[KBD]` y `OUT [LCD],reg` dentro del ciclo completo.
6. **Directorio de programas:** catálogo con 3 programas (aritmético con bucles usando AX–DX; teclado con eco al LCD; accesos dispersos que provoquen Page Faults y fallos de caché), editor, verificación de sintaxis y cargador a las páginas virtuales.
7. **Documentación bilingüe:** `README.md` (es) y `README_EN.md` (en), con diagramas Mermaid, tabla ISA, especificación de micro-palabra, manual y enlace a la hoja.
8. **Equipo:** nombre y logo; repo nuevo, Kanban nuevo (Backlog, To Do, In Progress, In Review, Done); ramas personales `feature/nombre-estudiante/modulo`; commits semánticos; PRs; reparto equitativo.
9. **Defensa:** 30 min (20 de exposición uniformados + 10 de preguntas individuales con **modificación de código o memoria en vivo**).

Nada de esto se puede commitear después de la fecha y hora de cierre.

---

## 2. Qué ya existe (Parcial 1)

Arquitectura implementada y probada (99–102 pruebas, validadas con una simulación de Sheets en Node; **hay que confirmarlas en Sheets real**):
- **Ciclo de instrucción de 4 fases**, una micro-operación por paso: Búsqueda (`MAR←PC`, `MDR←RAM[MAR]`, `IR←MDR`, `PC←PC+1`), Decodificación (busca el operando por MAR/MDR), Ejecución, Almacenamiento. La cola de micro-operaciones pendientes vive en `DocumentProperties` (`UC_ESTADO`).
- **ISA:** 35 instrucciones de 1 o 2 bytes agrupadas por nibble alto (0x control, 1x transferencia, 2x aritmética, 3x lógica, 4x saltos). Operandos `inm`, `[dir]`, `dir`.
- **Banderas:** toda operación de la ALU recalcula ZF, CF, SF. INC/DEC/NOT también actualizan CF. Las lógicas dejan CF = 0. En la resta CF = préstamo (a < b).
- **Ensamblador de dos pasadas** con `.data`/`.code`, `DB`, etiquetas, comentarios `;`, números `15` / `0x0F` / `0Fh`, errores con número de línea.
- **Interfaz:** hoja `CPU` "Arquitectura von Neumann", hoja `Log` (una fila por micro-operación), panel de las últimas 10 micro-ops, resaltado ámbar = destino / celeste = origen, controles dentro de la hoja (casillas en la columna P) y `Panel.html` opcional.
- **Archivos (`src/`):** Configuracion, Memoria (objetos `Memoria` y `UtilMemoria`), VistaRam, Libro, Principal, Registros, ALU, ISA, Bus, EnsambladorLexico, Ensamblador, Compilador, VistaCompilador, MicroOperaciones, UnidadControl, LogMicroops, Resaltado, Traza, Simulacion, ProgramasDemo, Controles, `Panel.html`, `pruebas/` (EjecutorPruebas + 10 suites, 102 pruebas).
- **Herramientas (`herramientas/`):** `construir.js` (une `src/` en `dist/SimuladorCompleto.gs` para pegar en Apps Script) y `probar-local.js` (corre las 102 pruebas en Node con una hoja simulada). La hoja simulada no reemplaza probar en Google Sheets real.
- El compilador de alto nivel (nivel 2) **ya no se pide** en el Parcial 2: no lo extiendan.

Cambios de este parcial sobre lo existente: memoria plana → memoria virtual con MMU y caché; `Bus.transfer` implícito → buses con micro-palabra; datos desde `80h` → segmento de datos con dirección virtual `100h + dir`.

**Nota sobre `Memoria`:** hoy el resto del código llama a `Memoria.leer/escribir/cargar/volcar/limpiar` (la RAM plana de 256 B en la hoja). En el Parcial 2, `Memoria` pasa a ser la **capa física** (marcos de 32 B) y el CPU deja de llamarla directamente: pasa por `AccesoMemoria` (decisión D-9). La tarea 1-2 crea `AccesoMemoria` como paso directo hacia `Memoria` y cambia las llamadas de `UnidadControl`, `Ensamblador` y `Bus`.

---

## 3. Decisiones de diseño (obligatorias, no cambiar sin avisar)

- **D-1** Espacio virtual de 9 bits (000h–1FFh). Páginas 0–7 (000h–0FFh) = **código**; páginas 8–15 (100h–1FFh) = **datos**. PC y saltos de 8 bits (dirVirtual de código = PC). `[dir]` es de 8 bits y la dirección virtual efectiva de datos es `100h + dir`.
- **D-2** `VPN = dirVirtual >> 5` · `offset = dirVirtual & 31` · `dirFísica = PFN*32 + offset`.
- **D-3** E/S en la página 15 (virtual 1E0h–1FFh): cola de teclado `1F0h–1F7h` (dir de datos F0h–F7h), LCD `1F8h–1FFh` (F8h–FFh). Página 15 **fija** en el marco 7, nunca se desaloja, no pasa por caché. Quedan 7 marcos reemplazables.
- **D-4** Orden: CPU → MMU → L1 (I o D) → L2 → RAM. La caché usa direcciones **físicas**.
- **D-5** L1I = 1 línea de 8 B (etiqueta `dirFísica >> 3`). L1D igual. L2 = 1 bloque de 32 B (etiqueta `dirFísica >> 5`, mostrado como 4 líneas de 8 B). **Write-through**. Si se desaloja una página, se invalida su caché.
- **D-6** Reemplazo FIFO por defecto, LRU seleccionable en una celda de configuración. Víctima con Dirty = 1 se guarda en la hoja `Swap`.
- **D-7** Page Fault: se ejecuta el manejador (con sus micro-operaciones en el log) y se **repite la micro-operación que falló**, sin avanzar PC.
- **D-8** Tri-estado: en cada micro-paso **como máximo un `En_*` = 1**; los demás buffers = High-Z. Se valida por código y falla con error claro.
- **D-9** El CPU solo usa `AccesoMemoria.leer(dirVirtual, tipo)` y `AccesoMemoria.escribir(dirVirtual, valor)` con `tipo` = `'I'` o `'D'`. Nadie más accede a la RAM directamente.

---

## 4. Contratos entre módulos (lo que NO se rompe)

```
AccesoMemoria.leer(dirVirtual, tipo)        -> {valor, info}   // info: {vpn, pfn, dirFisica, fallo, hitL1, hitL2}
AccesoMemoria.escribir(dirVirtual, valor)   -> {info}

MMU.traducir(dirVirtual)                    -> {vpn, offset, presente, pfn, dirFisica}
MMU.manejarFalloDePagina(vpn)               -> {pfnAsignado, victima|null, escribioSwap}

Cache.acceder(tipo, dirFisica, esEscritura, valor?) -> {hit, nivel, valor}
Cache.contadores()                          -> {L1I:{h,m}, L1D:{h,m}, L2:{h,m}}
Cache.invalidarPagina(pfn)

Perifericos.teclado.encolar(char) / .desencolar() / .estado()
Perifericos.lcd.escribir(pos, byte) / .texto()

MicroPalabra.crear(nombresDeSenales[])      -> palabra (objeto de bits)
MicroPalabra.validarUnSoloEmisor(palabra)   -> lanza error si hay 2 En_* activos
Bus.estadoBuffers(palabra)                  -> {componente: 'CONDUCE'|'HIGH-Z'}
Bus.ejecutarPaso(palabra, datos)            -> aplica la micro-palabra, registra log y resalta
```

Firmas nuevas o modificadas deben anunciarse **en el grupo** antes de mergear, porque rompen el código de otro integrante.

---

## 5. Quién es dueño de qué archivo

| Integrante | Archivos nuevos o propios | Puede tocar con cuidado |
|---|---|---|
| **1 (Adrian)** | `MicroPalabra.gs`, `Bus.gs`, `VistaBuses.gs`, `Registros.gs` (CX/DX), `ISA.gs`, `UnidadControl.gs`, `MicroOperaciones.gs`, `docs/microword.md`, README raíz | `Libro.gs`, `Resaltado.gs` |
| **2** | `MMU.gs`, `TablaMarcos.gs`, `Swap.gs`, `VistaRam.gs` (marcos), `ManejadorFallos.gs`, `Ensamblador.gs` (cargador), `docs/memoria-virtual.md` | `AccesoMemoria.gs` (solo la parte de MMU) |
| **3** | `Cache.gs`, `VistaCache.gs`, `Perifericos.gs`, `ProgramasCatalogo.gs`, `Editor.gs`, `docs/cache-es.md`, `docs/io.md` | `AccesoMemoria.gs` (solo la parte de caché), `ISA.gs` para `IN`/`OUT` (coordinar con 1) |

Archivos compartidos (`Libro.gs`, `Configuracion.gs`, `AccesoMemoria.gs`, `Principal.gs`): cambios pequeños, un PR corto, avisar en el grupo, y hacer **Pull de `main` antes de empezar** y de nuevo antes de abrir el PR.

---

## 6. Convenciones

**Idioma**
- Títulos de tarjetas y de PR: **inglés**.
- Todo lo demás (código, nombres, comentarios, commits, docs técnicas): **español**.
- Nombres técnicos se quedan en inglés: PC, IR, MAR, MDR, AX, BX, CX, DX, ZF, CF, SF, mnemónicos, API de Apps Script, nombres de señales (`En_PC`, `Ld_MAR`, ...).
- README: español en `README.md`, inglés en `README_EN.md`.

**Git (flujo)**
1. `main` → **Fetch → Pull**.
2. Crear rama `feature/<nombre>/<modulo>` (ejemplo: `feature/adrian/bus-tristate`).
3. Commits pequeños y atómicos en español con prefijo: `feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `perf:`, `chore:` (ejemplo: `feat(bus): validar emisor único en el bus de datos`).
4. Push → Pull Request en **inglés** con `Closes #N`.
5. **Otro integrante** revisa y aprueba. Se mergea. Volver a `main` y hacer Pull antes de la siguiente rama.
6. Mover la tarjeta del Kanban en cada paso: To Do → In Progress (al empezar) → In Review (al abrir el PR) → Done (al mergear).

**Reparto equitativo:** ningún integrante debe pasar más de ~40 % de los commits. No hagan un solo commit masivo al final. No hagan commits después del cierre.

---

## 7. Cómo se implementa una tarea (paso a paso)

1. **Lee la tarjeta** completa: By, For, Reason, Details, Acceptance criteria.
2. **Lee las secciones 3 y 4** de este documento; confirma que tu tarea respeta las decisiones y los contratos.
3. **Pull de `main`** y crea la rama.
4. **Escribe primero la prueba** en `src/pruebas/` (suite del módulo) con los casos de los criterios de aceptación. Usa `EjecutorPruebas` (el mismo patrón de las suites existentes).
5. **Implementa** en tus archivos. Funciones pequeñas, nombres en español, comentarios en español explicando el "por qué" (ejemplo: "PC se incrementa antes de decodificar, como dice el enunciado").
6. **Muestra el estado en la hoja:** si cambias estado interno, actualiza su panel y escribe una línea en el log (es lo que se evalúa en la defensa).
7. **Prueba en dos lugares:** local (`node herramientas/construir.js && node herramientas/probar-local.js`) y la **hoja real** (menú → Pruebas → Ejecutar todas). Anota resultados en el PR. Si agregas un archivo `.gs` nuevo, ponlo en la lista `ORDEN` de `herramientas/construir.js`.
8. **Commit(s)** → push → PR con plantilla (sección 10) → pide revisión.
9. **Corrige** lo que pida el revisor. Merge. Mueve la tarjeta a Done.
10. Si tocas algo que afecta a otro integrante (contrato, ISA, configuración), **avisa en el grupo**.

**Definición de "hecho"** (la tarjeta solo pasa a Done si se cumple todo):
- [ ] Todos los criterios de aceptación cumplidos y marcados.
- [ ] Pruebas escritas y pasando (local y hoja real).
- [ ] Visible en la hoja (panel o resaltado) y registrado en el log, si aplica.
- [ ] Documentación breve en `docs/` y, para cada integrante, su sección en español e inglés.
- [ ] PR revisado por otro integrante y mergeado.
- [ ] Sin romper pruebas previas.

---

## 8. Reglas técnicas de Apps Script y de este proyecto

- Estado persistente → `DocumentProperties` o celdas con nombre. **No** uses variables globales para estado entre pasos (cada ejecución las reinicia).
- Limita escrituras a la hoja: agrupa con `setValues` y `SpreadsheetApp.flush()` al final del paso. Evita `setValue` en bucles.
- Una ejecución de Apps Script dura máximo ~6 minutos y no se pausa: el RUN se controla desde el cliente (temporizador del sidebar) o con las casillas de control de la hoja, avanzando una micro-operación por llamada.
- La hoja debe tener configuración regional **Estados Unidos** (hay un error conocido con `REGEXMATCH` en español). No dependas de reglas de validación con regex: valida en código (`onEdit`).
- Todos los valores de registro y memoria son de **8 bits**: `valor & 0xFF`. Las direcciones virtuales son de 9 bits: `dir & 0x1FF`.
- Los números se muestran en **hex** en las vistas, con `0x`/`h` consistente en toda la hoja (`0Fh`).
- Los colores de la hoja: ámbar = destino, celeste = origen, **rojo = Page Fault o Miss**, **verde = Hit o buffer conduciendo**, **gris = High-Z**.
- No modifiques el contrato de otro sin avisar. No muevas archivos de lugar.
- No uses librerías externas ni servicios que requieran permisos nuevos.

---

## 9. Detalle técnico por módulo (para que cada IA sepa qué hacer)

### 9.1 Micro-palabra y buses (Integrante 1)
- Archivo `MicroPalabra.gs`: lista fija de señales. Mínimo: `En_PC, Ld_PC, Inc_PC, Ld_MAR, Mem_R, Mem_W, Ld_MDR, En_MDR, Ld_IR, En_IR, En_ALU, Ld_REN1, Ld_REN2, Ld_AX, En_AX, Ld_BX, En_BX, Ld_CX, En_CX, Ld_DX, En_DX, Ld_FLAGS, En_RAM, En_KBD, Ld_LCD, IO` + código de operación de ALU (`ALU_op`, 3–4 bits).
- La micro-palabra es un objeto/vector de bits; la hoja la muestra como fila de 0/1 con los bits en 1 resaltados.
- **Regla D-8:** solo un `En_*` activo por paso sobre el bus de datos interno. `Bus.estadoBuffers(palabra)` devuelve para cada componente `CONDUCE` o `HIGH-Z`.
- Bus de **direcciones** lo maneja MAR (sale hacia el externo); bus de **control** transporta `Read/Write/Clock/IO`; bus de **datos** es bidireccional con tri-estado.
- Distinguir y mostrar **bus interno** (ALU y registros) y **externo** (CPU ↔ MMU/caché/RAM/E/S).
- Cada micro-operación del ciclo se redefine con su micro-palabra. Ejemplo de búsqueda:
  1. `MAR←PC`: `En_PC=1, Ld_MAR=1`.
  2. `MDR←RAM[MAR]`: `Mem_R=1, En_RAM=1, Ld_MDR=1`.
  3. `IR←MDR`: `En_MDR=1, Ld_IR=1`.
  4. `PC←PC+1`: `Inc_PC=1`.
- Debe quedar claro qué buffers conducen en cada paso y el log debe imprimir la palabra.

### 9.2 Registros e ISA (Integrante 1)
- Agregar CX (contador de bucles) y DX (datos y E/S) igual que AX/BX: en `Registros.gs`, hoja, resaltado, ALU.
- Extender ISA con variantes para CX y DX; reservar un grupo de opcodes (ejemplo `5x`) para **E/S**: `IN reg,[KBD]` y `OUT [LCD],reg`. Avisar a Integrante 3 los opcodes **el día 2**.
- `LOOP` es opcional (`DEC CX; JNZ`). Mantener instrucciones de 1–2 bytes.
- Actualizar la hoja ISA y `ISA.gs` juntos (una sola fuente de verdad) y la prueba de coincidencia entre ambos.

### 9.3 Memoria virtual (Integrante 2)
- **Hoja `Swap`:** 16 páginas de 32 B = 512 B de almacenamiento; es el "disco". Primitivas `leerPagina(vpn)`/`escribirPagina(vpn, bytes)`.
- **Tabla de marcos:** 16 filas (VPN 0–15): Presente, PFN (0–7), Dirty, Ref. Getters/setters con nombres de rango. Inicialmente P = 0 salvo la página 15 (E/S) fija en el marco 7.
- **RAM:** 8 marcos de 32 B en la grilla.
- **MMU:** calcula VPN/offset/PFN según D-2; si P = 0 → page fault.
- **Page Fault:** resalta rojo en la tabla, busca marco libre; si no hay, aplica FIFO/LRU, escribe la víctima en `Swap` si Dirty = 1, invalida su caché, copia los 32 B de la página pedida al marco, P = 1, y la UC repite la micro-operación (D-7). Todo esto se registra en el log como micro-operaciones del manejador.
- Bits: Ref = 1 en cada acceso; Dirty = 1 en cada escritura (D-5 usa write-through, pero Dirty sigue marcando que la RAM difiere del Swap).
- Contadores visibles: accesos, fallos, desalojos.
- **Cargador (tarea 2-8):** el ensamblador coloca el código en páginas 0–7 y los datos en 8–15 vía `Swap` (la carga inicial escribe en el almacén virtual; las páginas se traen a RAM al ser referenciadas). Las direcciones de datos se emiten relativas a `100h`.

### 9.4 Caché (Integrante 3)
- Tamaños exactos: **L1I = 8 B, L1D = 8 B, L2 = 32 B.**
- Flujo de lectura de instrucción: L1I → si miss, L2 → si miss, traer el bloque de 32 B desde el marco de RAM a L2 y la línea de 8 B a L1I.
- Datos: igual con L1D.
- Escritura: write-through (actualiza L1D si hay línea cargada, L2 y RAM).
- Contadores de hit/miss y **Hit Rate = hits / (hits + misses)** por nivel, visibles y sincronizados con el log.
- Animación: nivel en verde (hit) o rojo (miss), línea reemplazada resaltada, mensaje en log (`[Paso 12] L1I MISS → L2 HIT → línea 3 cargada`).
- `Cache.invalidarPagina(pfn)` cuando la MMU desaloja una página.
- La página de E/S (15) **no pasa por caché**.

### 9.5 Periféricos E/S (Integrante 3)
- **Teclado:** cola circular de 8 B en `1F0h–1F7h`. Panel de entrada en la hoja: el usuario escribe un carácter, se guarda como byte ASCII en la cola. `IN reg,[KBD]` lee el siguiente byte; usa `En_KBD` en la micro-palabra. Si está vacía, devuelve 0 y marca ZF.
- **LCD 8x1:** buffer de 8 B en `1F8h–1FFh`. `OUT [LCD],reg` escribe un byte en la posición actual; `Ld_LCD` en la micro-palabra. La hoja muestra 8 celdas con el texto decodificado desde ASCII.
- Ambos viven en **RAM** (marco 7); el log y los buffers tri-estado deben reflejarlos.
- Señal `IO` en el bus de control durante `IN`/`OUT`.

### 9.6 Catálogo, editor y programas (Integrante 3, con apoyo de 2)
- Hoja `Programas`: desplegable con **3 programas** en ensamblador:
  1. **Aritmético con bucles:** usa AX, BX, CX, DX (por ejemplo suma de 1..N con CX como contador y DX como acumulador de verificación).
  2. **Teclado + LCD:** lee caracteres con `IN` y los reproduce en el LCD con `OUT` hasta que el usuario escribe un terminador; eco interactivo.
  3. **Accesos dispersos:** lee y escribe datos en varias páginas de datos (8–15) intercalando saltos entre páginas de código, para provocar Page Faults, desalojos y misses de caché.
- **Editor:** celdas editables con el código; botón que valida sintaxis (reusa errores con número de línea del ensamblador) y carga a las páginas virtuales.
- Cada programa tiene una descripción corta y el comportamiento esperado, y debe llegar a `HLT` sin errores en la hoja real.

---

## 10. Plantillas

### Tarjeta (issue)
```
Title (English): <Verb> <object>

By: <nombre>
For: <nombre del integrante>
Reason: <por qué esta tarea es necesaria para la rúbrica (G# / I#)>
Details: <qué se hace, archivos que se tocan, contratos que usa>
Acceptance criteria:
- [ ] ...
- [ ] ...
Labels: bus | cache | memory | io | isa | docs | ui | testing
Branch: feature/<nombre>/<modulo>
Depends on: #N (si aplica)
```

### Pull Request (título en inglés, cuerpo en español)
```
Title: <Verb> <object> (Closes #N)

## Resumen
## Qué cambió (archivos)
## Cómo probarlo (hoja real y pruebas locales)
## Capturas / log de ejemplo
## Checklist
- [ ] Criterios de aceptación cumplidos
- [ ] Pruebas pasando (N/N)
- [ ] Documentación actualizada (ES/EN)
- [ ] Contratos no rotos
```

### Prompt para tu IA al iniciar una tarea
```
Contexto: pegué la guía del proyecto (Parcial 2, simulador en Google Sheets + Apps Script).
Soy el Integrante <N>. Mi tarea es la tarjeta de abajo.
Reglas: respeta las decisiones D-1 a D-9 y los contratos de la sección 4; escribe código, comentarios,
commits y docs en español (títulos de tarjeta y PR en inglés); no cambies archivos de otros integrantes
sin avisarme; entrégame (1) las pruebas, (2) el código, (3) los mensajes de commit sugeridos,
(4) el texto del PR, (5) cómo verificarlo en la hoja real.
Tarjeta: <pega la tarjeta>
Estado actual del repo: <pega la lista de archivos o los fragmentos relevantes>
```

---

## 11. Rutina diaria del equipo

- **Inicio del día (10 min):** qué hizo cada uno, qué bloquea, qué contrato cambia.
- **Durante el día:** cada tarea sigue la sección 7; revisión cruzada de PRs el mismo día.
- **Fin del día:** merge a `main`, **Ejecutar todas las pruebas en la hoja real**, mover tarjetas, anotar en el grupo qué quedó.
- **Integraciones obligatorias:** final de los días 3, 5 y 7.
- **Día 8:** nada nuevo. Corregir, ensayar con cronómetro, entregar enlaces del repositorio, del GitHub Project y de la hoja antes del cierre.

---

## 12. Qué debe saber explicar cada uno en la defensa

- **Todos:** el flujo completo CPU → bus → MMU → caché → RAM, qué es la micro-palabra y la regla del emisor único, cómo se ve un Page Fault y un Miss en la hoja.
- **Integrante 1:** cada bit de la micro-palabra, qué buffers conducen en cada fase, Gitflow y el Kanban.
- **Integrante 2:** traducción VPN/offset/PFN con números reales, Page Fault paso a paso, FIFO vs LRU, Dirty y write-back.
- **Integrante 3:** flujo L1I/L1D/L2, Hit Rate, cola de teclado y LCD, cómo `IN`/`OUT` usan el bus.
- **Código en vivo:** cada uno debe poder cambiar una instrucción en un programa o un valor de memoria y predecir el efecto en caché, tabla de marcos y bus **antes** de ejecutar.
