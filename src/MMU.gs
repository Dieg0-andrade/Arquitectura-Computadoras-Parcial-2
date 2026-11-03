/**
 * MMU.gs  —  STUB (tarea 1-2). La implementación real es la tarea 2-4 (Integrante 2).
 *
 * Unidad de administración de memoria: traduce dirección virtual -> física
 * (decisión D-2):
 *   vpn = dirVirtual >> 5 · offset = dirVirtual & 31 · dirFisica = pfn * 32 + offset
 *
 * CONTRATO (no cambiar sin avisar):
 *   MMU.traducir(dirVirtual)           -> { vpn, offset, presente, pfn, dirFisica }
 *   MMU.manejarFalloDePagina(vpn)      -> { pfnAsignado, victima|null, escribioSwap }
 *
 * El stub usa traducción de identidad (la dirección virtual es la física) y
 * la página siempre está presente, así nunca hay fallo de página.
 */

const MMU = {

  traducir(dirVirtual) {
    if (!Number.isInteger(dirVirtual) || dirVirtual < 0 || dirVirtual > 0x1FF) {
      throw new Error('Dirección virtual fuera de rango: ' + dirVirtual + ' (válido 000h–1FFh)');
    }
    const dirFisica = dirVirtual & 0xFF;          // STUB: identidad sobre los 256 bytes de RAM
    return {
      vpn: dirVirtual >> 5,
      offset: dirVirtual & 31,
      presente: true,                              // STUB: nunca hay fallo de página
      pfn: dirFisica >> 5,
      dirFisica: dirFisica
    };
  },

  manejarFalloDePagina(vpn) {
    throw new Error('MMU.manejarFalloDePagina todavía no está implementado (tarea 2-5). vpn = ' + vpn);
  }
};
