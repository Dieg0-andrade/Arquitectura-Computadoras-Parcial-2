/**
 * MicroPalabra.gs
 * Formato de la palabra de control (micro-palabra) y reglas tri-estado (D-8).
 *
 * Una micro-palabra dice qué señales de control están activas en UN micro-paso.
 * Cada señal es un bit (0 o 1); además hay un campo ALU_op de 4 bits.
 *
 *   En_X  (Enable) -> el buffer tri-estado de X CONDUCE: X pone su valor en el bus de datos.
 *                     Con En_X = 0 el buffer queda en alta impedancia (High-Z).
 *   Ld_X  (Load)   -> X carga (latch) el valor que hay en el bus de datos en este paso.
 *   Mem_R / Mem_W  -> líneas Read / Write del bus de control hacia memoria (o E/S si IO = 1).
 *   IO             -> el acceso va al espacio de E/S (teclado / LCD), no a la RAM.
 *   Inc_PC         -> PC ← PC + 1 (incrementador propio del PC, no usa el bus).
 *   Ld_FLAGS       -> ZF, CF y SF se actualizan con el resultado de la ALU.
 *   ALU_op         -> operación de la ALU (0000 = ninguna). Ver CODIGOS_ALU_OP.
 *
 * Regla D-8 (tri-estado): en cada micro-paso como MÁXIMO un En_* vale 1.
 * Si dos buffers condujeran a la vez habría un cortocircuito en el bus; por eso
 * MicroPalabra.validarUnSoloEmisor(palabra) lanza un error en ese caso.
 *
 * La palabra es un objeto { senales: {En_PC: 0|1, ...}, aluOp: 0..15 } y se puede
 * convertir a vector de bits (MicroPalabra.aBits) en el orden fijo de COLUMNAS_MICROPALABRA.
 * Especificación completa: docs/microword.md
 */

/** Señales de 1 bit, en el orden fijo en que se muestran (bit más significativo primero). */
const SENALES_MICROPALABRA = [
  // Contador de programa
  'En_PC', 'Ld_PC', 'Inc_PC',
  // Interfaz con memoria (bus de direcciones y bus de control)
  'Ld_MAR', 'Mem_R', 'Mem_W', 'Ld_MDR', 'En_MDR', 'En_RAM',
  // Registro de instrucción
  'Ld_IR', 'En_IR',
  // ALU
  'En_ALU', 'Ld_REN1', 'Ld_REN2', 'Ld_FLAGS',
  // Registros de propósito general
  'Ld_AX', 'En_AX', 'Ld_BX', 'En_BX', 'Ld_CX', 'En_CX', 'Ld_DX', 'En_DX',
  // Entrada / salida mapeada en memoria
  'En_KBD', 'Ld_LCD', 'IO'
];

/** Ancho del campo ALU_op en bits. */
const ANCHO_ALU_OP = 4;

/** Código binario de cada operación de la ALU (0 = la ALU no opera en este paso). */
const CODIGOS_ALU_OP = {
  NINGUNA: 0, ADD: 1, SUB: 2, INC: 3, DEC: 4, CMP: 5, AND: 6, OR: 7, XOR: 8, NOT: 9
};

/** Todas las columnas de la palabra: las 26 señales + ALU_op3..ALU_op0 = 30 bits. */
const COLUMNAS_MICROPALABRA = SENALES_MICROPALABRA.concat(
  Array.from({ length: ANCHO_ALU_OP }, (_, i) => 'ALU_op' + (ANCHO_ALU_OP - 1 - i)));

const MicroPalabra = {

  /**
   * Crea una micro-palabra con las señales indicadas en 1 y el resto en 0.
   * La operación de la ALU se pasa como 'ALU_op=ADD' dentro de la misma lista.
   *   MicroPalabra.crear(['En_PC', 'Ld_MAR'])
   *   MicroPalabra.crear(['Ld_FLAGS', 'ALU_op=SUB'])
   * Lanza error si una señal no existe o está repetida. NO valida la regla D-8:
   * eso lo hace validar() / validarUnSoloEmisor() antes de ejecutar el paso.
   */
  crear(nombres) {
    if (!Array.isArray(nombres)) throw new Error('MicroPalabra.crear espera una lista de señales');
    const palabra = MicroPalabra.vacia();
    const vistos = new Set();
    let aluDefinida = false;

    nombres.forEach(nombre => {
      if (vistos.has(nombre)) throw new Error('Señal repetida en la micro-palabra: ' + nombre);
      vistos.add(nombre);

      const alu = /^ALU_op=(\w+)$/.exec(nombre);
      if (alu) {
        if (aluDefinida) throw new Error('ALU_op definido dos veces en la misma micro-palabra');
        if (!(alu[1] in CODIGOS_ALU_OP)) throw new Error('Operación de ALU desconocida: ' + alu[1]);
        palabra.aluOp = CODIGOS_ALU_OP[alu[1]];
        aluDefinida = true;
        return;
      }
      if (!(nombre in palabra.senales)) throw new Error('Señal de control desconocida: ' + nombre);
      palabra.senales[nombre] = 1;
    });
    return palabra;
  },

  /** Micro-palabra con todas las señales en 0 (todos los buffers en High-Z). */
  vacia() {
    const senales = {};
    SENALES_MICROPALABRA.forEach(s => { senales[s] = 0; });
    return { senales: senales, aluOp: CODIGOS_ALU_OP.NINGUNA };
  },

  /** Valor (0 o 1) de una señal. */
  leer(palabra, senal) {
    if (!(senal in palabra.senales)) throw new Error('Señal de control desconocida: ' + senal);
    return palabra.senales[senal];
  },

  /** Nombre de la operación de la ALU ('ADD', ..., o 'NINGUNA'). */
  operacionAlu(palabra) {
    const nombre = Object.keys(CODIGOS_ALU_OP).find(k => CODIGOS_ALU_OP[k] === palabra.aluOp);
    if (!nombre) throw new Error('Código ALU_op inválido: ' + palabra.aluOp);
    return nombre;
  },

  /** Lista de las señales de 1 bit que valen 1, en el orden de la tabla. */
  activas(palabra) {
    return SENALES_MICROPALABRA.filter(s => palabra.senales[s] === 1);
  },

  /** Señales En_* activas: son los componentes que CONDUCEN al bus de datos. */
  emisores(palabra) {
    return MicroPalabra.activas(palabra).filter(s => s.indexOf('En_') === 0);
  },

  /**
   * Regla D-8: como máximo un En_* activo. Devuelve el nombre del único emisor
   * (por ejemplo 'En_PC') o null si en este paso nadie conduce al bus.
   * Lanza error si hay dos o más emisores simultáneos.
   */
  validarUnSoloEmisor(palabra) {
    const emisores = MicroPalabra.emisores(palabra);
    if (emisores.length > 1) {
      throw new Error('Conflicto en el bus de datos: ' + emisores.length + ' emisores simultáneos (' +
        emisores.join(', ') + '). Regla D-8: solo un En_* por micro-paso.');
    }
    return emisores.length === 1 ? emisores[0] : null;
  },

  /**
   * Validación completa de una micro-palabra antes de ejecutarla:
   *   1. un solo emisor (D-8)
   *   2. Mem_R y Mem_W no pueden estar activas a la vez
   *   3. un registro no puede emitir y cargar en el mismo paso (En_X y Ld_X)
   *   4. ALU_op tiene un código válido
   * Devuelve true o lanza error con el motivo.
   */
  validar(palabra) {
    MicroPalabra.validarUnSoloEmisor(palabra);
    const s = palabra.senales;
    if (s.Mem_R && s.Mem_W) throw new Error('Mem_R y Mem_W activas a la vez: no se puede leer y escribir en el mismo paso');
    SENALES_MICROPALABRA
      .filter(n => n.indexOf('En_') === 0)
      .forEach(en => {
        const ld = 'Ld_' + en.slice(3);
        if (s[en] && s[ld]) throw new Error(en + ' y ' + ld + ' activas a la vez: el registro no puede emitir y cargar en el mismo paso');
      });
    MicroPalabra.operacionAlu(palabra);
    return true;
  },

  // ── Representación como bits ────────────────────────────────────

  /** Vector de 30 bits en el orden de COLUMNAS_MICROPALABRA. */
  aBits(palabra) {
    const bitsAlu = [];
    for (let i = ANCHO_ALU_OP - 1; i >= 0; i--) bitsAlu.push((palabra.aluOp >> i) & 1);
    return SENALES_MICROPALABRA.map(s => palabra.senales[s]).concat(bitsAlu);
  },

  /** Operación inversa de aBits. */
  desdeBits(bits) {
    if (!Array.isArray(bits) || bits.length !== COLUMNAS_MICROPALABRA.length) {
      throw new Error('Se esperaban ' + COLUMNAS_MICROPALABRA.length + ' bits');
    }
    bits.forEach(b => { if (b !== 0 && b !== 1) throw new Error('Bit inválido: ' + b); });
    const palabra = MicroPalabra.vacia();
    SENALES_MICROPALABRA.forEach((s, i) => { palabra.senales[s] = bits[i]; });
    palabra.aluOp = bits.slice(SENALES_MICROPALABRA.length).reduce((acc, b) => (acc << 1) | b, 0);
    return palabra;
  },

  /** Texto binario agrupado de a 4 bits, por ejemplo "1001 0000 ... 0000". */
  aBinario(palabra) {
    const bits = MicroPalabra.aBits(palabra).join('');
    return bits.replace(/(.{4})(?=.)/g, '$1 ').trim();
  },

  /** Texto legible para el log: "En_PC Ld_MAR" o "Ld_FLAGS · ALU_op=ADD" o "(ninguna)". */
  describir(palabra) {
    const partes = MicroPalabra.activas(palabra);
    if (palabra.aluOp !== CODIGOS_ALU_OP.NINGUNA) partes.push('ALU_op=' + MicroPalabra.operacionAlu(palabra));
    return partes.length ? partes.join(' · ') : '(ninguna)';
  },

  // ── Traducción desde las micro-operaciones actuales ─────────────

  /**
   * Micro-palabra que corresponde a una micro-operación de MicroOperaciones.gs.
   *   { tipo: 'bus', origen: 'PC', destino: 'MAR' }  -> En_PC · Ld_MAR
   *   { tipo: 'bus', origen: 'RAM', destino: 'MDR' } -> Mem_R · Ld_MDR · En_RAM
   *   { tipo: 'alu', op: 'ADD' }                     -> Ld_FLAGS · ALU_op=ADD
   * El salto condicional usa la misma palabra que el incondicional; la UC
   * solo la aplica si la bandera cumple la condición.
   */
  paraMicroOperacion(op) {
    switch (op.tipo) {
      case 'bus':
        return MicroPalabra.crear(MicroPalabra.senalesDeEmisor_(op.origen).concat(MicroPalabra.senalesDeReceptor_(op.destino)));
      case 'incPC': return MicroPalabra.crear(['Inc_PC']);
      case 'alu': return MicroPalabra.crear(['Ld_FLAGS', 'ALU_op=' + op.op]);
      case 'salto': return MicroPalabra.crear(['En_MDR', 'Ld_PC']);
      case 'decodificar':
      case 'detener':
      case 'nada':
        return MicroPalabra.vacia();
    }
    throw new Error('Micro-operación sin micro-palabra: ' + op.tipo);
  },

  senalesDeEmisor_(origen) {
    if (origen === 'RAM') return ['Mem_R', 'En_RAM'];
    if (origen === 'RESULTADO_ALU') return ['En_ALU'];
    if (origen === 'KBD') return ['IO', 'Mem_R', 'En_KBD'];
    const senal = 'En_' + origen;
    if (SENALES_MICROPALABRA.indexOf(senal) < 0) throw new Error('Componente sin buffer de salida al bus: ' + origen);
    return [senal];
  },

  senalesDeReceptor_(destino) {
    if (destino === 'RAM') return ['Mem_W'];
    if (destino === 'LCD') return ['IO', 'Mem_W', 'Ld_LCD'];
    const senal = 'Ld_' + destino;
    if (SENALES_MICROPALABRA.indexOf(senal) < 0) throw new Error('Componente sin entrada de carga desde el bus: ' + destino);
    return [senal];
  }
};
