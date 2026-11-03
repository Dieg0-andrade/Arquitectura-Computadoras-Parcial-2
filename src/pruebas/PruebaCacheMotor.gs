
/**
 * Issue #9 — Pruebas adicionales de L1I, L2 y reemplazo.
 */
function probarJerarquiaCache() {
  const dirA = 0x00;
  const dirB = 0x20;
  const dirC = 0x08;

  Cache.reiniciar();

  try {
    // 1. Primer acceso a instrucciones: RAM.
    const a1 = Cache.acceder('I', dirA, false);
    if (a1.nivel !== 'RAM') {
      throw new Error('Error: primer acceso L1I');
    }

    // 2. Segundo acceso: HIT en L1I.
    const a2 = Cache.acceder('I', dirA, false);
    if (a2.nivel !== 'L1' || !a2.hit) {
      throw new Error('Error: HIT en L1I');
    }

    // 3. Acceder a otra línea: reemplaza L1I.
    const b1 = Cache.acceder('I', dirC, false);
    if (b1.nivel !== 'RAM') {
      throw new Error('Error: carga de segunda línea');
    }

    // 4. Volver a A: debe encontrarse en L2.
    const a3 = Cache.acceder('I', dirA, false);
    if (a3.nivel !== 'L2' || !a3.hit) {
      throw new Error('Error: HIT en L2');
    }

    // 5. Dirección B: misma posición de L2 que A.
    const b2 = Cache.acceder('I', dirB, false);
    if (b2.nivel !== 'RAM') {
      throw new Error('Error: reemplazo de L2');
    }

    // 6. Volver a A: ya no está en L1 ni L2.
    const a4 = Cache.acceder('I', dirA, false);
    if (a4.nivel !== 'RAM') {
      throw new Error('Error: MISS tras reemplazo');
    }

    Logger.log('PASS: L1I, L2 y reemplazo');
    Logger.log(JSON.stringify(Cache.contadores()));

  } finally {
    Cache.reiniciar();
  }
}
