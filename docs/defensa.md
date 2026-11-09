# Defensa del Parcial 2 · Los Tigris

Guía para la exposición (20 min) y las preguntas (10 min). Criterios que se evalúan en vivo:
**I3 Exposición** (cada integrante ≥ 5 min técnicos, uniformados) e **I4 Defensa y código en vivo**
(explicar cada bit de la micro-palabra y modificar una instrucción o un valor de memoria en vivo).

---

## 1. Antes de entrar (checklist)

- [ ] Hoja del equipo con el `dist/` del último `main`, **Preparar libro** hecho y región **Estados Unidos**.
- [ ] **Pruebas → Ejecutar todas = 273/273** y **Pruebas → Integración final = 12/12** en la hoja real.
- [ ] Enlace de la hoja (terminado en `/copy`) y del repositorio en `README.md` y `README_EN.md`.
- [ ] Tablero Kanban: todas las tarjetas en **Done**; ninguna rama ni PR abiertos.
- [ ] Logo y nombre en la presentación (`assets/logo-los-tigris.jpg`).
- [ ] Cada uno con su parte cronometrada; Retardo (ms) de la hoja CPU en **300**.
- [ ] Una pestaña con el repositorio abierto en *Insights → Network* (gráfico de ramas) y otra con el tablero.

---

## 2. Guion (20 minutos)

| Min | Quién | Qué | Hoja |
|---|---|---|---|
| 0–2 | Adrian | Equipo, objetivo, arquitectura completa (diagrama Mermaid del README) | Inicio · README |
| 2–7 | **Adrian** | **Buses, tri-estado y micro-palabra** + demo 1 | CPU · Buses · Log |
| 7–12 | **Daniel** | **Memoria virtual, tabla de marcos, Page Fault, FIFO/LRU** + demo 3 | TablaMarcos · Swap · RAM |
| 12–17 | **Diego** | **Caché L1I/L1D/L2 y periféricos** + demo 2 | Cache_IO · Programas |
| 17–19 | Adrian | **Gitflow y Kanban**: ramas, PRs con `Closes #N`, revisión cruzada, gráfico de commits | GitHub |
| 19–20 | Todos | Cierre: requisitos cumplidos (tabla de la sección 1 del README) | README |

---

## 3. Demos en vivo

### Demo 1 · Buses y micro-palabra (Adrian)
1. **Simulador CPU → Abrir catalogo de programas** → en `B3` elegir **Bucle aritmetico AX-DX** → **Cargar programa del catalogo**.
2. Ir a la hoja **Buses**. Marcar **▶| PASO** cuatro veces y mostrar cada paso de la búsqueda:

| Paso | Micro-operación | Qué señalar en la hoja Buses |
|---|---|---|
| 1 | `MAR ← PC` | Solo **PC** en verde (CONDUCE), todo lo demás gris (HIGH-Z). MAR en ámbar. Bits `En_PC` y `Ld_MAR` en 1. |
| 2 | `MDR ← RAM[MAR]` | Se apaga el bus interno y se enciende el **externo**: RAM conduce. MAR conduce al **bus de direcciones**. `Read = 1`. |
| 3 | `IR ← MDR` | El **MDR** conduce en el bus interno: es el puente entre los dos buses. |
| 4 | `PC ← PC + 1` | **Ningún** buffer conduce: el incremento no usa el bus. |

3. Seguir con PASO hasta un `ADD AX, BX`: mostrar `Ld_FLAGS` y `ALU_op = 0001`, y después `En_ALU` + `Ld_AX`.
4. Abrir la hoja **Log**: columnas F y G con la micro-palabra y sus 30 bits en cada paso.
5. **▶ EJECUTAR** hasta HLT → **Verificar resultado del catalogo** → `PASS`, AX = 12, DX = 12.

### Demo 2 · Teclado y LCD (Diego)
1. Catálogo → **Eco teclado-LCD** → cargar.
2. Hoja **Cache_IO**: escribir una letra en **C33** → aparece en la cola (`B31:I31`).
3. EJECUTAR. Durante `IN`: la micro-palabra tiene `IO`, `Mem_R`, `En_KBD`, `Ld_MDR`. Durante `OUT`: `IO`, `Mem_W`, `En_MDR`, `Ld_LCD`.
4. La letra aparece en el LCD (`K31`). Verificar → `PASS`.

### Demo 3 · Page Fault y caché (Daniel + Diego)
1. Catálogo → **Accesos dispersos** → cargar. En **TablaMarcos**, la página de `p6` está con `P = 0`.
2. EJECUTAR: la entrada se pone roja, se carga desde **Swap**, `P = 1`, y la micro-operación **se repite**.
3. Cache_IO: misses en rojo, hits en verde, contadores y Hit Rate.
4. Verificar → `PASS`, AX = 28, Page Faults > 0.

---

## 4. Cada bit de la micro-palabra (I4)

30 bits = 26 señales + `ALU_op` (4 bits). Regla de oro: **`En_` = pone su valor en el bus (CONDUCE)**,
**`Ld_` = carga lo que hay en el bus**, y **como máximo un `En_` por paso**.

| Bit | Señal | Qué hace | Cuándo vale 1 |
|---:|---|---|---|
| 29 | `En_PC` | PC conduce al bus interno | `MAR ← PC` (búsqueda y operando) |
| 28 | `Ld_PC` | PC carga del bus | `PC ← MDR` en un salto tomado |
| 27 | `Inc_PC` | PC + 1 con su propio incrementador (sin bus) | después de leer cada byte |
| 26 | `Ld_MAR` | MAR carga; su salida va al bus de direcciones | `MAR ← PC`, `MAR ← MDR` |
| 25 | `Mem_R` | línea **Read** del bus de control | lectura de RAM o del teclado |
| 24 | `Mem_W` | línea **Write** del bus de control | `STORE`, `OUT` |
| 23 | `Ld_MDR` | MDR carga (desde el bus interno o el externo) | `MDR ← RAM`, `MDR ← AX`, `MDR ← KBD` |
| 22 | `En_MDR` | MDR conduce (al interno, o al externo con `Mem_W`) | `IR ← MDR`, `AX ← MDR`, `RAM ← MDR` |
| 21 | `En_RAM` | la memoria conduce `RAM[MAR]` al bus externo | toda lectura de memoria |
| 20 | `Ld_IR` | IR carga el opcode | búsqueda, paso 3 |
| 19 | `En_IR` | IR conduce (reservado; ninguna instrucción lo usa) | — |
| 18 | `En_ALU` | el resultado de la ALU conduce | almacenamiento de ADD, SUB, INC… |
| 17 | `Ld_REN1` | entrada A de la ALU carga | primer operando |
| 16 | `Ld_REN2` | entrada B de la ALU carga | segundo operando |
| 15 | `Ld_FLAGS` | se actualizan ZF, CF y SF | todo paso de ALU (también CMP) |
| 14–7 | `Ld_AX`…`En_DX` | cargar / conducir cada registro general | según la instrucción |
| 6 | `En_KBD` | la cola del teclado conduce al bus externo | `IN` (con `IO` y `Mem_R`) |
| 5 | `Ld_LCD` | el buffer del LCD carga | `OUT` (con `IO` y `Mem_W`) |
| 4 | `IO` | el acceso va a E/S, no a la RAM | `IN`, `OUT` |
| 3–0 | `ALU_op` | `0001` ADD · `0010` SUB · `0011` INC · `0100` DEC · `0101` CMP · `0110` AND · `0111` OR · `1000` XOR · `1001` NOT | paso de ALU |

**Para memorizar:** `MAR ← PC` = `1001 0000 0000 0000 0000 0000 0000 00` (bits 29 y 26).

---

## 5. Código en vivo (I4)

Practicar cada uno **antes** de la defensa. Todo se hace en la hoja; **nunca** se edita el código en Apps Script.

| Pedido probable | Cómo hacerlo | Qué mostrar |
|---|---|---|
| "Cambia un valor de memoria" | Hoja **RAM**: escribir otro byte en la celda (p. ej. el dato `n`) → EJECUTAR | el resultado cambia; la hoja es la fuente de verdad |
| "Cambia una instrucción" | Hoja **Código** col. E: cambiar `MOV BX, 4` por `MOV BX, 5` → **Ensamblar y cargar** → EJECUTAR | AX = 15; los bytes nuevos en la RAM |
| "Haz un bucle con CX" | `MOV CX, 3` · `vuelta: INC AX` · `DEC CX` · `JNZ vuelta` · `HLT` | `DEC CX` → `ZF = 1` → `JNZ` no salta |
| "Escribe en el LCD" | `MOV AX, 41h` · `OUT [LCD], AX` · `HLT` | `A` en el LCD; `IO = 1`, `Ld_LCD = 1` |
| "Provoca un error" | escribir una instrucción inválida (`MOV EX, 1`) → Ensamblar | línea en rojo y mensaje con número de línea |
| "¿Qué pasa si dos buffers conducen?" | mostrar la prueba *Bus → error claro con dos emisores simultáneos* (menú Pruebas → Bus) | el CPU se detiene con `ERROR` sin ejecutar el paso |
| "Cambia la política de reemplazo" | TablaMarcos: celda de política → **LRU** → correr Accesos dispersos | otra víctima, contadores distintos |

---

## 6. Preguntas probables

**Buses y tri-estado (Adrian)**
- *¿Qué es High-Z?* Alta impedancia: la salida del buffer queda desconectada, ni 0 ni 1, así no interfiere con quien sí conduce.
- *¿Por qué solo un `En_` por paso?* Si dos buffers ponen valores distintos en el mismo cable hay cortocircuito (contención). `validarUnSoloEmisor` lo impide y la UC valida cada palabra antes de ejecutarla (D-8).
- *¿Por qué la RAM no escribe directo en AX?* Están en buses distintos: AX en el interno, la RAM en el externo. El MDR es el único registro conectado a los dos.
- *¿Qué lleva cada bus?* Datos: el byte. Direcciones: la salida del MAR hacia la MMU. Control: Read, Write, IO y Clock.
- *¿Dónde se ve el cuello de botella de von Neumann?* Un `LOAD` usa MAR/MDR tres veces (opcode, operando y dato) por el mismo camino.

**Memoria virtual (Daniel)**
- *¿Cómo se traduce `103h`?* VPN = 8, offset = 3; si VPN 8 está en PFN 1 → física = 1 × 32 + 3 = `23h`.
- *¿Qué hace el Page Fault?* Marca rojo, elige marco (libre o víctima FIFO/LRU), guarda la víctima en Swap si Dirty = 1, copia 32 B, pone P = 1 y **repite** la micro-operación sin avanzar el PC (D-7).
- *¿Por qué la página 15 no se desaloja?* Es E/S: el teclado y el LCD deben estar siempre en el marco 7.

**Caché (Diego)**
- *¿Por qué L1I y L1D separadas?* Instrucciones y datos no se pisan; alivian el cuello de botella.
- *¿Write-through?* Cada escritura va a L1D, L2 y RAM; la RAM nunca queda vieja.
- *¿Por qué la E/S no pasa por caché?* Un byte del teclado cambia sin que el CPU escriba: si se cacheara, se leería un valor viejo.
- *Hit Rate:* hits / (hits + misses) por nivel.

**Gitflow (Adrian)**
- Una rama por tarea `feature/<nombre>/<módulo>`, PR con `Closes #N` (cierra la tarjeta), revisión de otro integrante, merge a `main`.
- 30 PRs mergeados (#9–#59); commits en español con prefijo `feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:`.
- *El revert de #32:* se revirtió con el botón **Revert** de GitHub (#33) y se volvió a aplicar revirtiendo el revert (#35); así se deshace un merge sin reescribir la historia.

---

## 7. Datos para tener a mano

| Dato | Valor |
|---|---|
| Instrucciones | 100 (36 del Parcial 1 + 56 con CX/DX + 8 de E/S) |
| Micro-palabra | 30 bits (26 señales + ALU_op de 4) |
| Memoria | 512 B virtuales (16 × 32 B) · 256 B físicos (8 × 32 B) · Swap 16 páginas |
| Caché | L1I 8 B · L1D 8 B · L2 32 B (4 líneas) · write-through |
| E/S | Teclado `1F0h–1F7h` · LCD `1F8h–1FFh` · página 15 fija en marco 7 |
| Pruebas | 273 en *Ejecutar todas* + 12 en *Integración final* = 285 |
| Opcodes de E/S | `50h–53h` IN · `54h–57h` OUT |
