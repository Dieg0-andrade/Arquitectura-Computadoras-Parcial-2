function probarJerarquiaCache() {
  const dirA = 0x00;
  const dirB = 0x20;
  const dirC = 0x08;

  Cache.reiniciar();

  try {
    // Primer acceso: RAM carga en L2 el bloque 00h–1Fh.
    const a1 = Cache.acceder('I', dirA, false);
    if (a1.nivel !== 'RAM') {
      throw new Error('Error: primer acceso L1I');
    }

    const a2 = Cache.acceder('I', dirA, false);
    if (a2.nivel !== 'L1' || !a2.hit) {
      throw new Error('Error: HIT en L1I');
    }

    // 08h está en otra línea de L1, dentro del bloque que ya trajo L2.
    const b1 = Cache.acceder('I', dirC, false);
    if (b1.nivel !== 'L2') {
      throw new Error('Error: carga de segunda línea');
    }

    const a3 = Cache.acceder('I', dirA, false);
    if (a3.nivel !== 'L2' || !a3.hit) {
      throw new Error('Error: HIT en L2');
    }

    // 20h inicia otro bloque de 32 bytes.
    const b2 = Cache.acceder('I', dirB, false);
    if (b2.nivel !== 'RAM') {
      throw new Error('Error: reemplazo de L2');
    }

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