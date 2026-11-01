# Estado de la base importada

Importada del repositorio del Parcial 1 (`santihitler/repo_excel_arqcomp`, rama `feat/sheet-controls`, merge del PR #26) y **corregida** para que funcione completa. Tag: `v0-base-parcial1`.

## Qué se corrigió respecto a ese repositorio
| Problema | Solución |
|---|---|
| Quedaban 6 archivos viejos en inglés (`Config.gs`, `Main.gs`, `Memory.gs`, `RamView.gs`, `Setup.gs`, `tests/MemoryTests.gs`) que duplican nombres y rompen el script unido | Eliminados |
| Faltaba `Memoria.gs` (objetos `Memoria` y `UtilMemoria`), usado por 8 archivos y por las pruebas | Reconstruido desde `Memory.gs` y de acuerdo con `PruebasMemoria.gs` |
| `ProgramasDemo.gs` y `PruebasBorde.gs` estaban en el commit `7f01740` de `feat/compiler-trace`, nunca mergeado | Recuperados; se agregaron los botones demo del panel, los ítems del menú y `suiteBorde_` en `probarTodo` |
| `PruebasCompilador.gs` tenía líneas duplicadas del merge (`const t` declarado dos veces) | Se tomó la versión corregida de `feat/compiler-trace` |

## Verificación
`node herramientas/construir.js && node herramientas/probar-local.js` → **102/102** pruebas con la hoja simulada.
Pendiente: confirmar las 102 en **Google Sheets real** (menú Pruebas → Ejecutar todas) antes de empezar el Día 1.

## Nota para la auditoría
Este primer commit es la **base del Parcial 1**. Todo el trabajo del Parcial 2 va en ramas y commits posteriores del equipo.
