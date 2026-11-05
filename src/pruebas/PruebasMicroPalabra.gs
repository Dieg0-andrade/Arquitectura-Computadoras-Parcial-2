/**
 * pruebas/PruebasMicroPalabra.gs
 * Pruebas del formato de la micro-palabra y de la regla tri-estado D-8
 * (como máximo un En_* activo por micro-paso). Son funciones puras: no tocan
 * la hoja, la RAM ni los registros.
 */

function probarMicroPalabra() {
  mostrarReporte_([suiteMicroPalabra_()]);
}

function suiteMicroPalabra_() {
  const t = crearSuite_('Micro-palabra');
  const cadena = p => MicroPalabra.describir(p);

  t.prueba('formato: 26 señales + ALU_op de 4 bits = 30 bits', () => {
    t.igual(SENALES_MICROPALABRA.length, 26);
    t.igual(COLUMNAS_MICROPALABRA.length, 30);
    t.igual(COLUMNAS_MICROPALABRA[0], 'En_PC');
    t.igual(COLUMNAS_MICROPALABRA[29], 'ALU_op0');
  });
  t.prueba('contiene las señales pedidas: En_*, Ld_*, Mem_R, Mem_W, IO', () => {
    ['En_PC', 'Ld_PC', 'Inc_PC', 'Ld_MAR', 'Mem_R', 'Mem_W', 'Ld_MDR', 'En_MDR', 'Ld_IR', 'En_IR',
      'En_ALU', 'Ld_REN1', 'Ld_REN2', 'Ld_AX', 'En_AX', 'Ld_BX', 'En_BX', 'Ld_CX', 'En_CX',
      'Ld_DX', 'En_DX', 'Ld_FLAGS', 'En_RAM', 'En_KBD', 'Ld_LCD', 'IO']
      .forEach(s => t.igual(SENALES_MICROPALABRA.indexOf(s) >= 0, true));
  });
  t.prueba('sin nombres repetidos en la tabla de señales', () => {
    t.igual(new Set(COLUMNAS_MICROPALABRA).size, COLUMNAS_MICROPALABRA.length);
  });
  t.prueba('vacia(): todas las señales en 0 y ALU sin operación', () => {
    const p = MicroPalabra.vacia();
    t.igual(MicroPalabra.aBits(p).every(b => b === 0), true);
    t.igual(MicroPalabra.operacionAlu(p), 'NINGUNA');
    t.igual(cadena(p), '(ninguna)');
  });
  t.prueba('crear() pone en 1 solo las señales indicadas', () => {
    const p = MicroPalabra.crear(['En_PC', 'Ld_MAR']);
    t.igual(MicroPalabra.leer(p, 'En_PC'), 1);
    t.igual(MicroPalabra.leer(p, 'Ld_MAR'), 1);
    t.igual(MicroPalabra.leer(p, 'Ld_MDR'), 0);
    t.igual(MicroPalabra.activas(p).length, 2);
    t.igual(cadena(p), 'En_PC · Ld_MAR');
  });
  t.prueba('las señales son bits: cada posición vale 0 o 1', () => {
    const bits = MicroPalabra.aBits(MicroPalabra.crear(['Mem_R', 'En_RAM', 'Ld_MDR', 'ALU_op=NOT']));
    t.igual(bits.every(b => b === 0 || b === 1), true);
    t.igual(bits.filter(b => b === 1).length, 5); // 3 señales + 1001 (NOT)
  });
  t.prueba('ALU_op se codifica en binario: ADD = 0001, NOT = 1001', () => {
    t.igual(MicroPalabra.aBits(MicroPalabra.crear(['ALU_op=ADD'])).slice(26).join(''), '0001');
    t.igual(MicroPalabra.aBits(MicroPalabra.crear(['ALU_op=NOT'])).slice(26).join(''), '1001');
    t.igual(MicroPalabra.operacionAlu(MicroPalabra.crear(['ALU_op=CMP'])), 'CMP');
  });
  t.prueba('todas las operaciones de la ALU tienen código ALU_op distinto', () => {
    Object.keys(OPERACIONES_ALU).forEach(op => t.igual(op in CODIGOS_ALU_OP, true));
    const codigos = Object.keys(CODIGOS_ALU_OP).map(k => CODIGOS_ALU_OP[k]);
    t.igual(new Set(codigos).size, codigos.length);
    t.igual(Math.max.apply(null, codigos) < (1 << ANCHO_ALU_OP), true);
  });
  t.prueba('aBits / desdeBits ida y vuelta', () => {
    const p = MicroPalabra.crear(['En_CX', 'Ld_REN1', 'Ld_FLAGS', 'ALU_op=XOR']);
    const q = MicroPalabra.desdeBits(MicroPalabra.aBits(p));
    t.igual(MicroPalabra.aBinario(q), MicroPalabra.aBinario(p));
    t.igual(cadena(q), 'Ld_REN1 · Ld_FLAGS · En_CX · ALU_op=XOR');
  });
  t.prueba('aBinario agrupa de a 4 bits', () => {
    t.igual(MicroPalabra.aBinario(MicroPalabra.crear(['En_PC', 'Ld_MAR'])),
      '1001 0000 0000 0000 0000 0000 0000 00');
  });
  t.prueba('crear() rechaza señales desconocidas, repetidas o ALU_op inválido', () => {
    t.lanzaError(() => MicroPalabra.crear(['En_EX']));
    t.lanzaError(() => MicroPalabra.crear(['En_PC', 'En_PC']));
    t.lanzaError(() => MicroPalabra.crear(['ALU_op=MUL']));
    t.lanzaError(() => MicroPalabra.crear(['ALU_op=ADD', 'ALU_op=SUB']));
    t.lanzaError(() => MicroPalabra.crear('En_PC'));
    t.lanzaError(() => MicroPalabra.desdeBits([1, 0, 1]));
  });

  // ── Regla D-8: un solo emisor ──
  t.prueba('validarUnSoloEmisor acepta un único En_* y devuelve su nombre', () => {
    t.igual(MicroPalabra.validarUnSoloEmisor(MicroPalabra.crear(['En_PC', 'Ld_MAR'])), 'En_PC');
  });
  t.prueba('validarUnSoloEmisor acepta un paso sin emisores (todo en High-Z)', () => {
    t.igual(MicroPalabra.validarUnSoloEmisor(MicroPalabra.crear(['Inc_PC'])), null);
  });
  t.prueba('validarUnSoloEmisor rechaza dos emisores simultáneos', () => {
    t.lanzaError(() => MicroPalabra.validarUnSoloEmisor(MicroPalabra.crear(['En_PC', 'En_MDR', 'Ld_MAR'])));
    t.lanzaError(() => MicroPalabra.validarUnSoloEmisor(MicroPalabra.crear(['En_AX', 'En_BX', 'Ld_REN1'])));
    t.lanzaError(() => MicroPalabra.validarUnSoloEmisor(MicroPalabra.crear(['En_RAM', 'En_KBD', 'Ld_MDR'])));
  });
  t.prueba('el mensaje de error nombra a los emisores en conflicto', () => {
    let mensaje = '';
    try { MicroPalabra.validarUnSoloEmisor(MicroPalabra.crear(['En_ALU', 'En_CX', 'En_DX'])); }
    catch (e) { mensaje = e.message; }
    t.igual(/En_ALU, En_CX, En_DX/.test(mensaje), true);
    t.igual(/D-8/.test(mensaje), true);
  });
  t.prueba('validarUnSoloEmisor también funciona sobre una palabra armada con bits', () => {
    const bits = COLUMNAS_MICROPALABRA.map(c => (c === 'En_AX' || c === 'En_DX') ? 1 : 0);
    t.lanzaError(() => MicroPalabra.validarUnSoloEmisor(MicroPalabra.desdeBits(bits)));
  });
  t.prueba('validar() rechaza Mem_R y Mem_W juntas', () => {
    t.lanzaError(() => MicroPalabra.validar(MicroPalabra.crear(['Mem_R', 'Mem_W'])));
  });
  t.prueba('validar() rechaza que un registro emita y cargue en el mismo paso', () => {
    t.lanzaError(() => MicroPalabra.validar(MicroPalabra.crear(['En_AX', 'Ld_AX'])));
  });

  // ── Micro-operaciones existentes ──
  t.prueba('búsqueda: las 4 micro-palabras de la guía', () => {
    const palabras = MicroOperaciones.busqueda().map(op => cadena(MicroPalabra.paraMicroOperacion(op)));
    t.igual(palabras[0], 'En_PC · Ld_MAR');
    t.igual(palabras[1], 'Mem_R · Ld_MDR · En_RAM');
    t.igual(palabras[2], 'En_MDR · Ld_IR');
    t.igual(palabras[3], 'Inc_PC');
    t.igual(palabras[4], '(ninguna)');
  });
  t.prueba('ALU, escritura en RAM y salto', () => {
    t.igual(cadena(MicroPalabra.paraMicroOperacion({ tipo: 'alu', op: 'ADD' })), 'Ld_FLAGS · ALU_op=ADD');
    t.igual(cadena(MicroPalabra.paraMicroOperacion({ tipo: 'bus', origen: 'RESULTADO_ALU', destino: 'CX' })), 'En_ALU · Ld_CX');
    t.igual(cadena(MicroPalabra.paraMicroOperacion({ tipo: 'bus', origen: 'MDR', destino: 'RAM' })), 'Mem_W · En_MDR');
    t.igual(cadena(MicroPalabra.paraMicroOperacion({ tipo: 'salto', bandera: 'ZF', valor: 1 })), 'Ld_PC · En_MDR');
  });
  t.prueba('E/S: MDR ← KBD (IN) y LCD ← MDR (OUT) usan IO', () => {
    const entrada = MicroPalabra.paraMicroOperacion({ tipo: 'bus', origen: 'KBD', destino: 'MDR' });
    const salida = MicroPalabra.paraMicroOperacion({ tipo: 'bus', origen: 'MDR', destino: 'LCD' });
    t.igual(cadena(entrada), 'Mem_R · Ld_MDR · En_KBD · IO');
    t.igual(cadena(salida), 'Mem_W · En_MDR · Ld_LCD · IO');
    t.igual(MicroPalabra.validar(entrada), true);
    t.igual(MicroPalabra.validar(salida), true);
  });
  t.prueba('ninguna micro-operación de las 92 instrucciones viola D-8', () => {
    let revisadas = 0;
    TABLA_ISA.forEach(entrada => {
      MicroOperaciones.busqueda().concat(MicroOperaciones.planificar(entrada)).forEach(op => {
        const p = MicroPalabra.paraMicroOperacion(op);
        try { MicroPalabra.validar(p); }
        catch (e) { throw new Error(entrada.mnemonico + ' ' + entrada.operandos + ': ' + e.message); }
        revisadas++;
      });
    });
    t.igual(revisadas > TABLA_ISA.length * 5, true);
  });
  t.prueba('rechaza micro-operaciones o componentes sin señal', () => {
    t.lanzaError(() => MicroPalabra.paraMicroOperacion({ tipo: 'teletransportar' }));
    t.lanzaError(() => MicroPalabra.paraMicroOperacion({ tipo: 'bus', origen: 'EX', destino: 'AX' }));
    t.lanzaError(() => MicroPalabra.paraMicroOperacion({ tipo: 'bus', origen: 'AX', destino: 'KBD' }));
  });

  return t;
}
