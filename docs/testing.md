# Informe de pruebas — memoria virtual / Virtual memory test report

**Proyecto / Project:** Los Tigris — Simulador de CPU de 8 bits  
**Tarea / Task:** 26, Issue #27  
**Responsable / Owner:** Daniel Roca  
**Fecha / Date:** 2026-11-08  
**Versión / Branch:** `feature/daniel/virtual-memory-tests-docs`

> **Estado verificado / Verified status:** La suite `probarMemoriaVirtualFinal` se ejecutó en Google Apps Script el 8 de noviembre de 2026, con **6 de 6 pruebas aprobadas** según el registro de ejecución. La ejecución local completa de Node.js debe registrarse por separado. / The `probarMemoriaVirtualFinal` suite ran in Google Apps Script on November 8, 2026, with **6 out of 6 tests passing** in the execution log. The complete Node.js run must be recorded separately.

## 1. Procedimiento / Procedure

1. Actualizar `main` con GitHub Desktop y trabajar en la rama de la tarea. / Update `main` in GitHub Desktop and work on the task branch.
2. Generar el script: `node herramientas/construir.js`. / Build the script.
3. Ejecutar `node herramientas/probar-local.js` y conservar el total de aprobadas. / Run the local test suite and record the passing total.
4. En una copia personal de Google Sheets, pegar `dist/SimuladorCompleto.gs` en Apps Script, guardar, recargar y ejecutar **Preparar libro**. / Test in a personal spreadsheet copy and prepare the workbook.
5. Ejecutar en Apps Script **`probarMemoriaVirtualFinal`** y comprobar el registro. / Run the test function and inspect the execution log.

## 2. Casos nuevos / New test cases

| ID | Prueba / Test | Resultado esperado / Expected outcome | Resultado observado / Observed |
|---|---|---|---|
| VM-01 | Accesos dispersos / Scattered accesses | 8 fallos, 1 desalojo, VPN15 fija en PFN7 / 8 faults, 1 eviction, VPN15 pinned to PFN7 | **Aprobada / Passed (Apps Script)** |
| VM-02 | FIFO | VPN0 desalojada aunque se acceda de nuevo / VPN0 evicted despite recent access | **Aprobada / Passed (Apps Script)** |
| VM-03 | LRU | VPN1 desalojada después de acceder a VPN0 / VPN1 evicted after accessing VPN0 | **Aprobada / Passed (Apps Script)** |
| VM-04 | Dirty Write-Back | `0xAB` permanece en Swap y se recupera / `0xAB` persists in Swap and is recovered | **Aprobada / Passed (Apps Script)** |
| VM-05 | Página limpia / Clean page | No se escribe a Swap al desalojar / No Swap write on eviction | **Aprobada / Passed (Apps Script)** |
| VM-06 | Página presente + E/S / Resident page + I/O | No doble conteo; VPN15 → PFN7 / No double count; VPN15 → PFN7 | **Aprobada / Passed (Apps Script)** |

## 3. Pruebas existentes relacionadas / Existing relevant suites

Se deben conservar las pruebas previas de `PruebasSwap.gs`, `PruebasTablaMarcos.gs`, `PruebasMMU.gs`, `PruebasFallosPagina.gs`, `PruebasReemplazoPaginas.gs`, `PruebasVisualFallos.gs` y `PruebasCargaVirtual.gs`. / Previous tests in those files must continue passing.

## 4. Resultado de ejecución / Execution results

| Entorno / Environment | Resultado / Result | Evidencia / Evidence |
|---|---|---|
| Node.js, `node herramientas/probar-local.js` | **Pendiente de registrar / Not yet recorded**: ___ / ___ | Captura de la terminal después de actualizar `main` / Terminal screenshot after updating `main` |
| Google Apps Script, `probarMemoriaVirtualFinal` | **6 / 6 aprobadas / passed** (2026-11-08) | Registro de ejecución suministrado, con las seis marcas de aprobación / Supplied execution log showing all six passes |
| Integración con suites anteriores / Regression | **Por confirmar / To verify** | Ejecutar `node herramientas/probar-local.js` sobre la rama actualizada / Run the full local suite on the updated branch |

## 5. Conclusión / Conclusion

**Resultados confirmados en Google Apps Script: 6/6. / Confirmed Google Apps Script result: 6/6.**

La ejecución en Google Apps Script confirmó los casos VM-01 a VM-06, incluyendo accesos dispersos, políticas FIFO/LRU, escritura de páginas Dirty a Swap, conservación de páginas limpias y la página de E/S reservada. La regresión completa en Node.js sigue pendiente de registrar; no se considera validada hasta obtener una ejecución con todas las pruebas aprobadas. / The Google Apps Script execution confirmed test cases VM-01 through VM-06, covering scattered accesses, FIFO/LRU policies, dirty-page write-back to Swap, clean-page handling, and the reserved I/O page. The full Node.js regression remains to be recorded and is not claimed as validated until all tests pass.

Documentación: [Español](memoria-virtual.md) · [English](virtual-memory.md)
