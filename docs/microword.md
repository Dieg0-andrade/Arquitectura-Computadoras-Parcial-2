# Micro-palabra de control y reglas tri-estado (tarea 1-4)

La **micro-palabra** (palabra de control) indica qué señales de control están activas en **un micro-paso** del ciclo. Cada señal es **un bit** (0 o 1). La Unidad de Control emite una micro-palabra por cada micro-operación (tarea 1-6) y el bus la aplica (tarea 1-5).

Código: `src/MicroPalabra.gs` · Pruebas: `src/pruebas/PruebasMicroPalabra.gs` (menú *Simulador CPU → Pruebas → Micro-palabra*).

## 1. Formato: 30 bits

26 señales de 1 bit + el campo `ALU_op` de 4 bits. El orden es fijo (bit 29 = el más significativo, a la izquierda):

| Bit | Señal | Grupo | Qué hace cuando vale 1 |
|---:|---|---|---|
| 29 | `En_PC` | PC | El PC conduce su valor al bus de datos |
| 28 | `Ld_PC` | PC | El PC carga el valor del bus (saltos: `PC ← MDR`) |
| 27 | `Inc_PC` | PC | `PC ← PC + 1` (incrementador propio, no usa el bus) |
| 26 | `Ld_MAR` | Memoria | MAR carga el bus; su salida va al **bus de direcciones** |
| 25 | `Mem_R` | Control | Línea **Read** del bus de control |
| 24 | `Mem_W` | Control | Línea **Write** del bus de control (`RAM[MAR] ← bus`) |
| 23 | `Ld_MDR` | Memoria | MDR carga el valor del bus de datos |
| 22 | `En_MDR` | Memoria | MDR conduce al bus de datos |
| 21 | `En_RAM` | Memoria | La memoria conduce `RAM[MAR]` al bus de datos (va con `Mem_R`) |
| 20 | `Ld_IR` | IR | IR carga el bus |
| 19 | `En_IR` | IR | IR conduce al bus (reservado: hoy ninguna micro-operación lo usa) |
| 18 | `En_ALU` | ALU | `RESULTADO_ALU` conduce al bus |
| 17 | `Ld_REN1` | ALU | Registro de entrada 1 de la ALU carga el bus |
| 16 | `Ld_REN2` | ALU | Registro de entrada 2 de la ALU carga el bus |
| 15 | `Ld_FLAGS` | ALU | ZF, CF y SF se actualizan con el resultado |
| 14 | `Ld_AX` | Registros | AX carga el bus |
| 13 | `En_AX` | Registros | AX conduce al bus |
| 12 | `Ld_BX` | Registros | BX carga el bus |
| 11 | `En_BX` | Registros | BX conduce al bus |
| 10 | `Ld_CX` | Registros | CX carga el bus |
| 9 | `En_CX` | Registros | CX conduce al bus |
| 8 | `Ld_DX` | Registros | DX carga el bus |
| 7 | `En_DX` | Registros | DX conduce al bus |
| 6 | `En_KBD` | E/S | La cola del teclado conduce el primer carácter al bus |
| 5 | `Ld_LCD` | E/S | El buffer del LCD carga el bus |
| 4 | `IO` | Control | El acceso (`Mem_R`/`Mem_W`) va al espacio de E/S, no a la RAM |
| 3–0 | `ALU_op` | ALU | Operación de la ALU (tabla siguiente) |

### Campo `ALU_op` (4 bits)

| Código | Binario | Operación |
|---:|---|---|
| 0 | `0000` | ninguna (la ALU no opera) |
| 1 | `0001` | ADD |
| 2 | `0010` | SUB |
| 3 | `0011` | INC |
| 4 | `0100` | DEC |
| 5 | `0101` | CMP (solo banderas) |
| 6 | `0110` | AND |
| 7 | `0111` | OR |
| 8 | `1000` | XOR |
| 9 | `1001` | NOT |
| 10–15 | `1010`–`1111` | libres |

## 2. Reglas tri-estado (decisión D-8)

Cada componente que puede escribir en el bus de datos lo hace a través de un **buffer tri-estado** controlado por su señal `En_*`:

- `En_X = 1` → el buffer **conduce**: X pone su valor en el bus.
- `En_X = 0` → el buffer queda en **alta impedancia (High-Z)**: X está desconectado del bus.
- `Ld_X = 1` → X **carga** (latch) lo que hay en el bus. Varios `Ld_*` pueden estar activos a la vez (varios receptores leen el mismo valor).

**Regla 1 — un solo emisor.** En cada micro-paso, como máximo **un** `En_*` vale 1. Si dos buffers condujeran a la vez, dos valores distintos chocarían en el mismo cable (cortocircuito / contención). `MicroPalabra.validarUnSoloEmisor(palabra)` devuelve el emisor (o `null` si nadie conduce) y **lanza un error** si hay dos o más.

**Regla 2 — leer o escribir, no ambos.** `Mem_R` y `Mem_W` no pueden valer 1 en el mismo paso.

**Regla 3 — un registro no emite y carga a la vez.** `En_X` y `Ld_X` del mismo registro no pueden estar juntas.

`MicroPalabra.validar(palabra)` aplica las tres reglas y además comprueba que `ALU_op` sea un código válido. La Unidad de Control debe llamarla antes de ejecutar cada micro-paso (tarea 1-6).

Un paso sin ningún `En_*` es válido: todos los buffers están en High-Z (por ejemplo `Inc_PC` o la decodificación).

## 3. Micro-palabras del ciclo actual

`MicroPalabra.paraMicroOperacion(op)` traduce cada micro-operación de `MicroOperaciones.gs` a su micro-palabra. Una prueba recorre las **92 instrucciones** de la ISA y verifica que ninguna micro-operación viola las reglas.

### Búsqueda

| Paso | Micro-operación | Señales en 1 | Emisor |
|---|---|---|---|
| 1 | `MAR ← PC` | `En_PC`, `Ld_MAR` | PC |
| 2 | `MDR ← RAM[MAR]` | `Mem_R`, `En_RAM`, `Ld_MDR` | RAM |
| 3 | `IR ← MDR` | `En_MDR`, `Ld_IR` | MDR |
| 4 | `PC ← PC + 1` | `Inc_PC` | — (High-Z) |
| 5 | Decodificar IR | ninguna | — (High-Z) |

Paso 1 en bits: `1001 0000 0000 0000 0000 0000 0000 00`.

### Otras micro-operaciones

| Micro-operación | Señales en 1 |
|---|---|
| `REN1 ← CX` | `En_CX`, `Ld_REN1` |
| `REN2 ← MDR` (inmediato) | `En_MDR`, `Ld_REN2` |
| `ALU: REN1 ADD REN2` | `ALU_op=0001`, `Ld_FLAGS` |
| `CX ← RESULTADO_ALU` | `En_ALU`, `Ld_CX` |
| `MAR ← MDR` (LOAD / STORE) | `En_MDR`, `Ld_MAR` |
| `MDR ← AX` (STORE) | `En_AX`, `Ld_MDR` |
| `RAM[MAR] ← MDR` (STORE) | `En_MDR`, `Mem_W` |
| `PC ← MDR` (JMP; JZ/JNZ solo si se cumple la bandera) | `En_MDR`, `Ld_PC` |
| `HLT` | ninguna (la UC detiene el reloj) |

### E/S (propuesta para la tarea 3-7)

| Instrucción | Micro-operación | Señales en 1 |
|---|---|---|
| `IN AX, [KBD]` | `AX ← KBD` | `IO`, `Mem_R`, `En_KBD`, `Ld_AX` |
| `OUT [LCD], DX` | `LCD ← DX` | `IO`, `Mem_W`, `En_DX`, `Ld_LCD` |

### Ejemplo de error

`MicroPalabra.crear(['En_PC', 'En_MDR', 'Ld_MAR'])` → `validarUnSoloEmisor` lanza:

```
Conflicto en el bus de datos: 2 emisores simultáneos (En_PC, En_MDR). Regla D-8: solo un En_* por micro-paso.
```

## 4. API (`MicroPalabra.gs`)

| Función | Devuelve |
|---|---|
| `MicroPalabra.crear(nombres[])` | palabra `{ senales: {En_PC: 0\|1, ...}, aluOp: 0..15 }`. La ALU se indica como `'ALU_op=ADD'`. Error si una señal no existe o se repite |
| `MicroPalabra.vacia()` | palabra con todo en 0 |
| `MicroPalabra.validarUnSoloEmisor(palabra)` | nombre del único `En_*` activo o `null`; **error** si hay 2 o más |
| `MicroPalabra.validar(palabra)` | `true` o error (reglas 1–3 y `ALU_op` válido) |
| `MicroPalabra.leer(palabra, senal)` | 0 o 1 |
| `MicroPalabra.activas(palabra)` / `emisores(palabra)` | señales en 1 / solo los `En_*` en 1 |
| `MicroPalabra.operacionAlu(palabra)` | `'ADD'`, …, `'NINGUNA'` |
| `MicroPalabra.aBits(palabra)` / `desdeBits(bits)` | vector de 30 bits en el orden de `COLUMNAS_MICROPALABRA` y su inversa |
| `MicroPalabra.aBinario(palabra)` | texto `"1001 0000 …"` |
| `MicroPalabra.describir(palabra)` | texto para el log: `"En_PC · Ld_MAR"` |
| `MicroPalabra.paraMicroOperacion(op)` | micro-palabra de una micro-operación de `MicroOperaciones.gs` |

Constantes: `SENALES_MICROPALABRA` (26 señales), `COLUMNAS_MICROPALABRA` (30 columnas, para la vista de la tarea 1-7), `CODIGOS_ALU_OP`, `ANCHO_ALU_OP`.

## 5. Qué usa esto después

- **1-5 (`Bus.gs`):** `Bus.estadoBuffers(palabra)` marca `CONDUCE` el componente del `En_*` activo y `HIGH-Z` el resto.
- **1-6 (`UnidadControl.gs`):** cada micro-operación genera su palabra con `paraMicroOperacion`, se valida con `validar` y se imprime en el log con `describir` / `aBinario`.
- **1-7 (`VistaBuses.gs`):** fila de 30 celdas 0/1 con `COLUMNAS_MICROPALABRA` como encabezado.
- **3-5 / 3-6 / 3-7 (Integrante 3):** `En_KBD`, `Ld_LCD` e `IO` ya están reservadas en la palabra.
