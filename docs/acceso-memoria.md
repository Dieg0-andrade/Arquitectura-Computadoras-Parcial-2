# Contrato de acceso a memoria (tarea 1-2)

El CPU **nunca** toca la RAM directamente: todo acceso pasa por `AccesoMemoria` (decisión D-9).

```
CPU (Bus) ──► AccesoMemoria.leer(dirVirtual, tipo) / .escribir(dirVirtual, valor)
                     │  hoy (stub): directo a Memoria
                     │  tarea 2-4:  MMU.traducir → fallo de página → MMU.manejarFalloDePagina
                     │  tarea 3-3:  Cache.acceder (L1I/L1D → L2 → RAM)
                     ▼
                  Memoria (RAM física)
```

| Función | Devuelve |
|---|---|
| `AccesoMemoria.leer(dirVirtual, tipo)` | `{ valor, info }` — `tipo` = `'I'` (instrucción u operando) o `'D'` (dato) |
| `AccesoMemoria.escribir(dirVirtual, valor)` | `{ info }` |

`info = { vpn, pfn, dirFisica, fallo, hitL1, hitL2 }`. En el stub: `vpn = pfn = dir >> 5`, `fallo = false`, `hitL1 = hitL2 = null`.

## Qué marca `I` y qué marca `D`
| Micro-operación | Tipo |
|---|---|
| `MDR ← RAM[MAR]` de la búsqueda (opcode) | `I` |
| `MDR ← RAM[MAR]` del operando de una instrucción de 2 bytes | `I` |
| `MDR ← RAM[MAR]` de `LOAD` | `D` |
| `RAM[MAR] ← MDR` de `STORE` | `D` |

La micro-operación lleva el campo `acceso`; la Unidad de Control lo pasa a `Bus.transferir(origen, destino, inmediato, acceso)`.

## Módulos stub y quién los completa
| Módulo | Archivo | Tarea real | Dueño |
|---|---|---|---|
| MMU (`traducir`, `manejarFalloDePagina`) | `MMU.gs` | 2-4, 2-5 | Integrante 2 |
| Caché (`acceder`, `contadores`, `invalidarPagina`) | `Cache.gs` | 3-2, 3-3 | Integrante 3 |
| Teclado y LCD | `Perifericos.gs` | 3-5, 3-6 | Integrante 3 |

Al reemplazar un stub **no se cambian las firmas**; si hace falta cambiarlas, se avisa en el grupo antes del merge.

## Notas
- Hasta la tarea 2-4 solo se aceptan direcciones 00h–FFh (la RAM de 256 B).
- El desplazamiento `100h + dir` del segmento de datos (decisión D-1) lo aplicará `AccesoMemoria` cuando `tipo = 'D'`, en la tarea 2-8.
- El cargador (`Ensamblador.cargarEnMemoria`, `VistaRam`) sigue escribiendo en `Memoria`: no es el camino del CPU. La tarea 2-8 lo cambia a la memoria virtual.
