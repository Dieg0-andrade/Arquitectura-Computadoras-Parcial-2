# Memoria virtual — módulo y verificación (español)

**Proyecto:** Simulador de CPU de 8 bits, Los Tigris — Arquitectura de Computadoras.  
**Tarea:** 26, Issue #27.  
**Implementación:** Google Sheets y Apps Script.

## 1. Organización de memoria

El espacio virtual tiene **512 bytes**, con direcciones de `000h` a `1FFh` (9 bits), organizados en **16 páginas de 32 bytes**. La memoria RAM física tiene **256 bytes**: **8 marcos de 32 bytes**. Los marcos 0–6 se pueden reemplazar; el **marco 7** está reservado para la página virtual **15** de entrada/salida.

| Segmento virtual | Direcciones | VPN | Finalidad |
|---|---|---|---|
| Código | `000h–0FFh` | 0–7 | Instrucciones; el PC sigue teniendo 8 bits |
| Datos | `100h–1DFh` | 8–14 | Variables y datos |
| E/S | `1E0h–1FFh` | 15 | Dispositivos; VPN 15 fija en PFN 7 |

El teclado ocupa `1F0h–1F7h` y el LCD, `1F8h–1FFh`. El almacenamiento secundario simulado es la hoja **Swap**, que contiene 16 páginas de 32 bytes; en la carga de programas se utilizan las páginas 0–14, mientras que la 15 está reservada a E/S.

## 2. Traducción de direcciones

La **MMU** calcula:

```text
VPN          = direccionVirtual >> 5
Desplazamiento = direccionVirtual & 31
DireccionFisica = PFN * 32 + Desplazamiento
```

La hoja **TablaMarcos** muestra `VPN`, `P` (presencia), `PFN` (marco físico), `Dirty` (modificada) y `Ref` (referenciada). Una entrada con `P = 0` no tiene marco asignado. Como ejemplo, si VPN 8 está en PFN 1, la dirección virtual `103h` se convierte en la dirección física `023h`.

Con la memoria virtual desactivada se conserva el modo del primer parcial: código `00h–7Fh` y datos `80h–FFh` en RAM plana.

## 3. Carga y Page Fault

El ensamblador en modo virtual genera una imagen de 512 bytes: código desde `000h` y datos desde `100h`. Los símbolos de datos conservan direcciones completas, y las instrucciones `LOAD`/`STORE` usan desplazamientos de 8 bits relativos a `100h`. Durante la carga, se guardan las páginas de programa en **Swap** y se precargan hasta siete páginas en los marcos disponibles sin incrementar el contador de fallos.

Si una instrucción intenta acceder a una página ausente, `AccesoMemoria` comunica un `PAGE_FAULT`. El manejador lee los 32 bytes desde Swap, elige un marco libre o una víctima y actualiza la tabla. La **UnidadControl** reintenta la micro-operación sin adelantar el PC por el fallo. El simulador destaca la página que faltaba en rojo y el marco de destino en amarillo.

## 4. Políticas FIFO y LRU

La política se elige en **TablaMarcos!H20**:

- **FIFO:** desaloja la página residente cuya carga ocurrió primero, aunque haya sido utilizada recientemente.
- **LRU:** desaloja la página residente menos recientemente utilizada; las lecturas/escrituras actualizan su historial.

La página virtual 15 no puede ser víctima. Al reutilizar un marco, se invalidan sus líneas de caché para evitar leer datos antiguos.

## 5. Dirty Write-Back

Las lecturas marcan `Ref = 1`; las escrituras marcan además `Dirty = 1`. Cuando una víctima está modificada, **ManejadorFallos** escribe sus 32 bytes actuales en Swap antes de sustituirla. Una víctima limpia no requiere escritura de regreso. Tras un nuevo fallo, la página puede recargarse desde Swap con sus cambios conservados.

La caché de datos utiliza *write-through* hacia RAM, mientras que **Dirty Write-Back** se refiere al respaldo de la página **RAM → Swap** cuando se desaloja. Son dos niveles distintos de persistencia.

## 6. Contadores e interfaz

En la hoja **TablaMarcos** se muestran el selector FIFO/LRU, los Page Faults, los desalojos y el último marco utilizado. Las columnas G–H muestran la información del último fallo y la hoja **Log** mantiene el evento. `prepararLibro()` reconstruye el simulador, por lo que debe ejecutarse solamente en una copia de prueba si existen datos que se quieren conservar.

## 7. Archivos responsables

| Archivo | Función |
|---|---|
| `src/MMU.gs` | Traducción de direcciones virtuales |
| `src/TablaMarcos.gs` | Tabla visible y bits P, PFN, Dirty, Ref |
| `src/Swap.gs` | Lectura y escritura de páginas de 32 bytes |
| `src/ManejadorFallos.gs` | Page Fault, FIFO/LRU, desalojo y Dirty Write-Back |
| `src/AccesoMemoria.gs` | Enlace MMU → caché → RAM |
| `src/Ensamblador.gs` | Imagen virtual, carga en Swap y precarga en RAM |
| `src/pruebas/PruebasMemoriaVirtualFinal.gs` | Pruebas finales de la tarea 26 |

## 8. Pruebas reproducibles

Ejecutar, desde la raíz del repositorio:

```powershell
node herramientas/construir.js
node herramientas/probar-local.js
```

En una **copia personal** de Google Sheets, pegar `dist/SimuladorCompleto.gs`, recargar y ejecutar **Simulador CPU → Preparar libro**. Después, en Apps Script, elegir **`probarMemoriaVirtualFinal`** y pulsar **Ejecutar**.

La suite incluye accesos dispersos, FIFO, LRU, Dirty Write-Back, ausencia de write-back en páginas limpias y protección de la página 15. El simulador de Node no verifica colores ni interacción real de Sheets; por eso el resultado de Apps Script debe comprobarse aparte. Los resultados efectivamente obtenidos se registran en [`testing.md`](testing.md).

**English:** [`virtual-memory.md`](virtual-memory.md).
