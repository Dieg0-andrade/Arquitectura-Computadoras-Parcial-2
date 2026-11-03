/**
 * AccesoMemoria.gs
 * Contrato ÚNICO de acceso a memoria del CPU (decisión D-9 del Parcial 2).
 * El CPU (Bus, Unidad de Control) NUNCA toca la RAM directamente: siempre llama
 * a AccesoMemoria.leer / AccesoMemoria.escribir.
 *
 * API pública (no cambiar sin avisar al equipo):
 *   AccesoMemoria.leer(dirVirtual, tipo)       -> { valor, info }
 *   AccesoMemoria.escribir(dirVirtual, valor)  -> { info }
 *
 *   tipo: 'I' = búsqueda de instrucción (u operando de la instrucción)
 *         'D' = acceso a dato (LOAD / STORE)
 *   info: { vpn, pfn, dirFisica, fallo, hitL1, hitL2 }
 *
 * ESTADO ACTUAL: STUB DIRECTO (tarea 1-2).
 *   Ahora la dirección virtual es igual a la física y el acceso va directo a
 *   Memoria (la RAM plana de 256 bytes) sin MMU ni caché. Por eso info trae:
 *     vpn / pfn  = dirección >> 5 (identidad, cada marco tiene 32 bytes)
 *     fallo      = false
 *     hitL1/L2   = null  ("no aplica": todavía no hay caché)
 *
 * QUIÉN LO REEMPLAZA (el contrato no cambia, solo el interior de estas dos funciones):
 *   - Integrante 2 (tarea 2-4): traducir con MMU.traducir() y atender el
 *     fallo de página (MMU.manejarFalloDePagina) antes de acceder a la RAM.
 *   - Integrante 3 (tarea 3-3): pasar por Cache.acceder() en lugar de Memoria.
 *   - Integrante 2 (tarea 2-8): el segmento de datos pasa a la dirección virtual
 *     100h + dir; ese desplazamiento se aplica aquí cuando tipo = 'D'.
 */

const AccesoMemoria = {

  /** Lee un byte. Devuelve { valor, info }. */
  leer(dirVirtual, tipo) {
    AccesoMemoria.validarTipo_(tipo);
    AccesoMemoria.validarDireccion_(dirVirtual);
    const dirFisica = dirVirtual;               // STUB: sin traducción
    const valor = Memoria.leer(dirFisica);      // STUB: sin caché
    return { valor: valor, info: AccesoMemoria.info_(dirFisica) };
  },

  /** Escribe un byte. Devuelve { info }. Las escrituras son siempre de datos. */
  escribir(dirVirtual, valor) {
    AccesoMemoria.validarDireccion_(dirVirtual);
    UtilMemoria.validarByte(valor);
    const dirFisica = dirVirtual;               // STUB: sin traducción
    Memoria.escribir(dirFisica, valor);         // STUB: sin caché
    return { info: AccesoMemoria.info_(dirFisica) };
  },

  // ── Internos ────────────────────────────────────────────────────

  /** Información de depuración del acceso (la completan la MMU y la caché más adelante). */
  info_(dirFisica) {
    const marco = dirFisica >> 5;
    return { vpn: marco, pfn: marco, dirFisica: dirFisica, fallo: false, hitL1: null, hitL2: null };
  },

  validarTipo_(tipo) {
    if (tipo !== 'I' && tipo !== 'D') {
      throw new Error('Tipo de acceso inválido: "' + tipo + '" (usa \'I\' para instrucción o \'D\' para dato)');
    }
  },

  validarDireccion_(dirVirtual) {
    // STUB: hasta la tarea 2-4 solo existe la RAM de 256 bytes (00h–FFh).
    if (!Number.isInteger(dirVirtual) || dirVirtual < 0 || dirVirtual > MAPA_MEMORIA.DATOS_FIN) {
      throw new Error('Dirección fuera de rango: ' + dirVirtual + ' (válido 00h–FFh hasta que llegue la memoria virtual)');
    }
  }
};
