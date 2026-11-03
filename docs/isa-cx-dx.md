# Registros CX y DX y su ISA (tarea 1-3)

El CPU tiene ahora **cuatro registros de propósito general de 8 bits**: `AX` (acumulador), `BX`, `CX` (contador de bucles) y `DX` (datos y E/S). Los cuatro se pueden usar en `MOV`, `ADD`, `SUB`, `CMP`, `INC` y `DEC`; `CX` y `DX` también en `LOAD` y `STORE`. `AND`, `OR`, `XOR` y `NOT` siguen solo con `AX`/`BX` (el enunciado no pide extenderlas).

## Qué cambió
| Dónde | Cambio |
|---|---|
| `Registros.gs` | `CX` y `DX` en `LISTA_REGISTROS` (rangos `REG_CX` y `REG_DX`) |
| `Libro.gs` | La hoja CPU muestra CX y DX debajo de AX y BX; REN1/REN2, C.OP, Resultado y banderas bajan una fila y el bus y el panel de micro-operaciones también |
| `ISA.gs` | 56 instrucciones nuevas (92 en total, antes 36) |
| `EnsambladorLexico.gs` | `CX` y `DX` son registros (ya no sirven como nombre de variable) |
| `Compilador.gs` | `cx` y `dx` son palabras reservadas |
| `Simulacion.gs`, `Panel.html` | El panel lateral muestra CX y DX |
| `ALU.gs`, `MicroOperaciones.gs`, `UnidadControl.gs`, `Resaltado.gs` | **Sin cambios**: trabajan sobre `LISTA_REGISTROS` y sobre la tabla ISA |

## Esquema de opcodes
Los 36 opcodes del Parcial 1 **no cambian** (los programas ya ensamblados siguen funcionando). Los nuevos usan este esquema:

| Rango | Contenido |
|---|---|
| `18h–1Dh` | `MOV r, inm` · `LOAD r, [dir]` · `STORE [dir], r` con r = CX, DX |
| `50h–5Fh` | **Reservado para E/S** (`IN` / `OUT`, Integrante 3) |
| `60h–63h` | `INC CX` · `INC DX` · `DEC CX` · `DEC DX` |
| `64h–69h` | `ADD`/`SUB`/`CMP` con r = CX, DX y dato inmediato |
| `70h–7Fh` | `MOV destino, origen` |
| `80h–8Fh` | `ADD destino, origen` |
| `90h–9Fh` | `SUB destino, origen` |
| `A0h–AFh` | `CMP destino, origen` |

En los cuatro bloques de registro a registro, **opcode = base + 4·d + s**, con AX = 0, BX = 1, CX = 2, DX = 3. Ejemplos: `MOV CX, AX` = `70h + 4·2 + 0` = `78h` · `ADD DX, CX` = `80h + 4·3 + 2` = `8Eh` · `CMP AX, DX` = `A0h + 4·0 + 3` = `A3h`. No existe `MOV AX, AX` ni equivalentes (d = s), y los pares `AX,BX` y `BX,AX` ya tienen su opcode del Parcial 1 (`12h`, `21h`, `25h`, `2Dh`...), por eso esos huecos quedan sin usar.

## Instrucciones nuevas (56)
| Opcode | Mnemónico | Operandos | Bytes | Descripción |
|---|---|---|---|---|
| `18h` | MOV | CX, inm | 2 | CX ← dato inmediato |
| `19h` | MOV | DX, inm | 2 | DX ← dato inmediato |
| `1Ah` | LOAD | CX, [dir] | 2 | CX ← RAM[dir] |
| `1Bh` | LOAD | DX, [dir] | 2 | DX ← RAM[dir] |
| `1Ch` | STORE | [dir], CX | 2 | RAM[dir] ← CX |
| `1Dh` | STORE | [dir], DX | 2 | RAM[dir] ← DX |
| `60h` | INC | CX | 1 | CX ← CX + 1 |
| `61h` | INC | DX | 1 | DX ← DX + 1 |
| `62h` | DEC | CX | 1 | CX ← CX − 1 |
| `63h` | DEC | DX | 1 | DX ← DX − 1 |
| `64h` | ADD | CX, inm | 2 | CX ← CX + inm |
| `65h` | ADD | DX, inm | 2 | DX ← DX + inm |
| `66h` | SUB | CX, inm | 2 | CX ← CX − inm |
| `67h` | SUB | DX, inm | 2 | DX ← DX − inm |
| `68h` | CMP | CX, inm | 2 | Banderas de CX − inm (no guarda) |
| `69h` | CMP | DX, inm | 2 | Banderas de DX − inm (no guarda) |
| `72h` | MOV | AX, CX | 1 | AX ← CX |
| `73h` | MOV | AX, DX | 1 | AX ← DX |
| `76h` | MOV | BX, CX | 1 | BX ← CX |
| `77h` | MOV | BX, DX | 1 | BX ← DX |
| `78h` | MOV | CX, AX | 1 | CX ← AX |
| `79h` | MOV | CX, BX | 1 | CX ← BX |
| `7Bh` | MOV | CX, DX | 1 | CX ← DX |
| `7Ch` | MOV | DX, AX | 1 | DX ← AX |
| `7Dh` | MOV | DX, BX | 1 | DX ← BX |
| `7Eh` | MOV | DX, CX | 1 | DX ← CX |
| `82h` | ADD | AX, CX | 1 | AX ← AX + CX |
| `83h` | ADD | AX, DX | 1 | AX ← AX + DX |
| `86h` | ADD | BX, CX | 1 | BX ← BX + CX |
| `87h` | ADD | BX, DX | 1 | BX ← BX + DX |
| `88h` | ADD | CX, AX | 1 | CX ← CX + AX |
| `89h` | ADD | CX, BX | 1 | CX ← CX + BX |
| `8Bh` | ADD | CX, DX | 1 | CX ← CX + DX |
| `8Ch` | ADD | DX, AX | 1 | DX ← DX + AX |
| `8Dh` | ADD | DX, BX | 1 | DX ← DX + BX |
| `8Eh` | ADD | DX, CX | 1 | DX ← DX + CX |
| `92h` | SUB | AX, CX | 1 | AX ← AX − CX |
| `93h` | SUB | AX, DX | 1 | AX ← AX − DX |
| `96h` | SUB | BX, CX | 1 | BX ← BX − CX |
| `97h` | SUB | BX, DX | 1 | BX ← BX − DX |
| `98h` | SUB | CX, AX | 1 | CX ← CX − AX |
| `99h` | SUB | CX, BX | 1 | CX ← CX − BX |
| `9Bh` | SUB | CX, DX | 1 | CX ← CX − DX |
| `9Ch` | SUB | DX, AX | 1 | DX ← DX − AX |
| `9Dh` | SUB | DX, BX | 1 | DX ← DX − BX |
| `9Eh` | SUB | DX, CX | 1 | DX ← DX − CX |
| `A2h` | CMP | AX, CX | 1 | Banderas de AX − CX (no guarda) |
| `A3h` | CMP | AX, DX | 1 | Banderas de AX − DX (no guarda) |
| `A6h` | CMP | BX, CX | 1 | Banderas de BX − CX (no guarda) |
| `A7h` | CMP | BX, DX | 1 | Banderas de BX − DX (no guarda) |
| `A8h` | CMP | CX, AX | 1 | Banderas de CX − AX (no guarda) |
| `A9h` | CMP | CX, BX | 1 | Banderas de CX − BX (no guarda) |
| `ABh` | CMP | CX, DX | 1 | Banderas de CX − DX (no guarda) |
| `ACh` | CMP | DX, AX | 1 | Banderas de DX − AX (no guarda) |
| `ADh` | CMP | DX, BX | 1 | Banderas de DX − BX (no guarda) |
| `AEh` | CMP | DX, CX | 1 | Banderas de DX − CX (no guarda) |

## Cómo probarlo
- Local: `node herramientas/construir.js && node herramientas/probar-local.js`
- Hoja real: menú **Pruebas → Registros CX y DX**, **ISA** y **Ejecutar todas**.
- Ejemplo (suma 5+4+3+2+1 con CX de contador): `MOV CX, 5` · `MOV DX, 0` · `bucle: ADD DX, CX` · `DEC CX` · `JNZ bucle` · `HLT` → DX = 0Fh.

## Nota para el README (tarea 1-9)
El README del Parcial 1 todavía dice "35 instrucciones" y solo lista AX/BX. Se reescribe completo en la tarea 1-9.
