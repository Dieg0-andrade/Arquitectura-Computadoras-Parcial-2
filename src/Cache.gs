/**
 * Cache.gs  —  STUB (tarea 1-2). La implementación real son las tareas 3-2 y 3-3 (Integrante 3).
 *
 * Jerarquía de caché (decisión D-5): L1I de 8 B, L1D de 8 B y L2 de 32 B,
 * trabajando con direcciones FÍSICAS y política write-through.
 *
 * CONTRATO (no cambiar sin avisar):
 *   Cache.acceder(tipo, dirFisica, esEscritura, valor) -> { hit, nivel, valor }
 *       tipo: 'I' | 'D' · nivel: 'L1' | 'L2' | 'RAM' (dónde se atendió el acceso)
 *   Cache.contadores()           -> { L1I:{h,m}, L1D:{h,m}, L2:{h,m} }
 *   Cache.invalidarPagina(pfn)   -> descarta las líneas del marco pfn (la llama la MMU al desalojar)
 *
 * El stub no guarda nada: cada acceso va directo a la RAM (nivel 'RAM', hit = false)
 * y los contadores se quedan en cero.
 */

const Cache = {

  acceder(tipo, dirFisica, esEscritura, valor) {
    if (tipo !== 'I' && tipo !== 'D') throw new Error('Tipo de acceso inválido: "' + tipo + '"');
    if (esEscritura) {
      Memoria.escribir(dirFisica, valor);
      return { hit: false, nivel: 'RAM', valor: valor };
    }
    return { hit: false, nivel: 'RAM', valor: Memoria.leer(dirFisica) };
  },

  contadores() {
    return { L1I: { h: 0, m: 0 }, L1D: { h: 0, m: 0 }, L2: { h: 0, m: 0 } };
  },

  invalidarPagina(pfn) {
    // STUB: no hay líneas que descartar.
  }
};
