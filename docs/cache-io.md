# Caché, entrada/salida y catálogo / Cache, I/O and program catalog
## Español
### Jerarquía de caché
La caché utiliza direcciones físicas después de la traducción de la MMU.
| Nivel | Capacidad | Uso |
|---|---|---|
| L1I | 8 bytes | Instrucciones |
| L1D | 8 bytes | Datos |
| L2 | 32 bytes | Compartida por instrucciones y datos |

Cada L1 conserva una línea de 8 bytes. L2 conserva un bloque de 32 bytes,
representado como cuatro líneas de 8 bytes.

En un hit de L1, el acceso termina en ese nivel. En un miss de L1 se consulta
L2. Si también ocurre un miss de L2, se carga desde RAM el bloque alineado
de 32 bytes y la línea solicitada pasa a L1.

Un nuevo bloque reemplaza el bloque anterior de L2. Cada L1 reemplaza su
línea cuando necesita otra dirección.

Las escrituras usan write-through y write-allocate. Se actualiza RAM y las
copias residentes del dato en L1I, L1D y L2. La invalidación de un marco
elimina sus líneas almacenadas en caché.

Cada nivel tiene contadores independientes de hits y misses. Un hit de L1
no incrementa los contadores de L2. La tasa de aciertos es
hits / (hits + misses), con valor cero cuando todavía no hubo accesos.

La hoja Cache_IO muestra las líneas, los contadores y los porcentajes.
La visualización utiliza verde para hit y rojo para miss.

### Teclado FIFO
El teclado utiliza una cola circular de ocho bytes.
- Direcciones virtuales de 1F0h a 1F7h.
- Direcciones físicas de F0h a F7h.
- Entrada interactiva en Cache_IO!C33.
- Contenido de la cola en Cache_IO!B31:I31, en orden de salida.
- La cola llena rechaza una nueva entrada.
- La lectura extrae el byte más antiguo.
- Una lectura de la cola vacía devuelve cero.

Los bytes se almacenan en RAM. La cabeza y la longitud de la cola se guardan
en las propiedades del documento.

### LCD
El LCD muestra ocho posiciones y utiliza un búfer de ocho bytes.
- Direcciones virtuales de 1F8h a 1FFh.
- Direcciones físicas de F8h a FFh.
- Pantalla en Cache_IO!K31:R31.
- Los valores ASCII imprimibles de 32 a 126 se muestran como caracteres.
- Los demás valores se representan visualmente con un espacio.

La página virtual 15 está reservada para E/S y permanece en el marco físico
7. Los accesos de E/S evitan la jerarquía de caché.

### Instrucciones de E/S
IN reg,[KBD] transfiere un byte desde el teclado al MDR y luego al registro.
Activa IO, Mem_R, En_KBD y Ld_MDR durante la lectura del dispositivo.

OUT [LCD],reg transfiere el registro al MDR y luego al LCD.
Activa IO, Mem_W, En_MDR y Ld_LCD durante la escritura del dispositivo.

Se admiten AX, BX, CX y DX. Los opcodes 50h–53h corresponden a IN y
54h–57h a OUT, en ese orden de registros.

Actualmente [LCD] selecciona la primera posición de la pantalla.
Las ocho posiciones del búfer se pueden escribir por dirección.

### Catálogo de programas
En la hoja Programas se selecciona un ejemplo en B3 y se carga desde
Simulador CPU > Cargar programa del catalogo.

La carga utiliza el ensamblador virtual y Swap, reemplaza el programa
activo y reinicia la CPU, el teclado, el LCD y los contadores de caché.
| Programa | Comprobación |
|---|---|
| Bucle aritmético AX–DX | AX=12, BX=4, CX=0, DX=12 y HLT |
| Eco teclado–LCD | Una letra ingresada pasa por IN/OUT y aparece en el LCD |
| Accesos dispersos | AX=28, fallos de página y misses de caché positivos, y HLT |

El ejemplo disperso utiliza siete páginas de datos y una de código.
El cargador precarga siete páginas, por lo que una queda ausente.
El manejador carga las páginas requeridas y la CPU reintenta la operación.

Para probar el eco manualmente, primero cargar el ejemplo, después ingresar
una letra en Cache_IO!C33 y finalmente ejecutar hasta HLT.

### Verificación y evidencias
Construir y ejecutar las pruebas locales con:
    node herramientas/construir.js
    node herramientas/probar-local.js

Copiar dist/SimuladorCompleto.gs en Apps Script y ejecutar individualmente
las funciones de la tabla de pruebas incluida al final de este documento.

Las pruebas se ejecutan en una copia de trabajo. Algunas cargan programas
y modifican RAM, registros, cola de teclado y pantalla.

Durante el desarrollo se verificaron en Google Sheets los tres programas.
Con FIFO, el ejemplo disperso produjo AX=28, seis fallos de página,
siete misses L1D y catorce misses L2. Estos valores son una referencia
de esa ejecución.

La validación final de la versión integrada se registra en la issue #29
y su pull request mediante resultados y capturas. Cada prueba debe mostrar
PASS antes de marcarla como completada. Los resultados de Node verifican
la simulación local; las capturas de Sheets verifican la ejecución real.

## English
### Cache hierarchy

The cache uses physical addresses after MMU translation.

| Level | Capacity | Purpose |
|---|---|---|
| L1I | 8 bytes | Instructions |
| L1D | 8 bytes | Data |
| L2 | 32 bytes | Shared by instructions and data |

Each L1 holds one 8-byte line. L2 holds one 32-byte block represented as four
8-byte lines.

An L1 hit completes the access at that level. An L1 miss queries L2.
On an L2 miss, the aligned 32-byte block is fetched from RAM and the requested
8-byte line is copied into L1.

A newly fetched block replaces the previous L2 block. Each L1 replaces its
line when another line is required.

Writes use write-through and write-allocate. RAM and resident copies in
L1I, L1D and L2 are updated. Frame invalidation removes cached lines
belonging to that frame.

Each level maintains its own hit and miss counters. An L1 hit leaves L2
counters unchanged. The hit rate is hits / (hits + misses), or zero before
the first access.

Cache_IO displays cache contents, counters and hit rates.
The visualization uses green for hits and red for misses.

### Keyboard FIFO
The keyboard uses an eight-byte circular queue.

- Virtual addresses 1F0h–1F7h.
- Physical addresses F0h–F7h.
- Interactive input at Cache_IO!C33.
- Queue contents at Cache_IO!B31:I31, in dequeue order.
- A full queue rejects additional input.
- Reading removes the oldest byte.
- Reading an empty queue returns zero.

Queue bytes are stored in RAM. The head index and length are stored in
document properties.

### LCD
The LCD has eight character positions backed by eight bytes.
- Virtual addresses 1F8h–1FFh.
- Physical addresses F8h–FFh.
- Display at Cache_IO!K31:R31.
- Printable ASCII values 32–126 appear as characters.
- Other values are visually rendered as spaces.

Virtual page 15 is reserved for I/O and remains mapped to physical frame 7.
I/O accesses bypass the cache hierarchy.

### I/O instructions
IN reg,[KBD] transfers a byte from the keyboard to MDR and then to the register.
The device read activates IO, Mem_R, En_KBD and Ld_MDR.

OUT [LCD],reg transfers the register to MDR and then to the LCD.
The device write activates IO, Mem_W, En_MDR and Ld_LCD.

AX, BX, CX and DX are supported. Opcodes 50h–53h encode IN and
54h–57h encode OUT, in that register order.

Currently [LCD] selects the first display position.
All eight buffer positions can be written by address.

### Program catalog

Select an example in Programas!B3 and use
Simulador CPU > Cargar programa del catalogo.

Loading uses the virtual assembler and Swap, replaces the active program
and resets the CPU, keyboard, LCD and cache counters.

| Program | Expected result |
|---|---|
| AX–DX arithmetic loop | AX=12, BX=4, CX=0, DX=12 and HLT |
| Keyboard-to-LCD echo | An input character passes through IN/OUT to the LCD |
| Scattered accesses | AX=28, positive page-fault and cache-miss counts, and HLT |

The scattered example uses seven data pages and one code page.
The loader preloads seven pages, leaving one absent.
The page-fault handler loads required pages and the CPU retries the operation.

For a manual echo test, load the example first, enter a character in
Cache_IO!C33, then execute until HLT.

### Verification and evidence

Build and run the local tests with:

    node herramientas/construir.js
    node herramientas/probar-local.js

Copy dist/SimuladorCompleto.gs into Apps Script and run each function
in the test matrix separately.

Use a working copy of the spreadsheet. Some tests load programs and modify
RAM, registers, the keyboard queue and the display.

All three catalog programs were verified in Google Sheets during development.
Under FIFO, the scattered example produced AX=28, six page faults,
seven L1D misses and fourteen L2 misses. These are reference results
from that execution.

Final integrated-version verification is recorded in issue #29 and its pull
request through logs and screenshots. Mark a test complete only after PASS.
Node results verify the local simulation; Sheets screenshots verify the
real spreadsheet execution.

## Matriz de pruebas / Test matrix

| Función / Function | Cobertura / Coverage |
|---|---|
| probarJerarquiaCache | L1I, L2 y reemplazo / L1I, L2 and replacement |
| probarIntegracionCache | MMU, L1I/L1D/L2, write-through, coherencia y porcentajes / MMU, L1I/L1D/L2, write-through, coherence and hit rates |
| probarAnimacionCache | Colores, líneas, contadores y Log / Colors, lines, counters and Log |
| probarTecladoFIFO | Capacidad, orden FIFO, vuelta circular y En_KBD / Capacity, FIFO order, wraparound and En_KBD |
| probarLCD8x1 | Ocho caracteres, búfer y Ld_LCD / Eight characters, video buffer and Ld_LCD |
| probarInOut | Ciclo completo de CPU con IN/OUT / Full CPU cycle with IN/OUT |
| probarCatalogoAritmetica | Cuatro registros y resultado / Four registers and result |
| probarCatalogoEco | Teclado a LCD / Keyboard-to-LCD echo |
| probarCatalogoDispersos | Fallos de página, misses y HLT / Page faults, misses and HLT |

