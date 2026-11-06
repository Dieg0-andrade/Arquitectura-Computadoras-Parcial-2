/**
 * MicroOperaciones.gs
 * Define qué micro-operaciones ejecuta cada instrucción, fase por fase.
 * Es el "secuenciador" del diagrama de clase: a partir de la instrucción
 * decodificada genera la lista de micro-órdenes que la Unidad de Control
 * ejecuta una por una.
 *
 * Cada micro-operación es un objeto simple (se puede guardar como JSON):
 *   { fase, tipo: 'bus',    origen, destino, acceso? }   ->  destino ← origen
 *       acceso: 'I' (instrucción) o 'D' (dato); solo en los accesos a RAM
 *   { fase, tipo: 'incPC' }                      ->  PC ← PC + 1
 *   { fase, tipo: 'decodificar' }                ->  interpreta el IR
 *   { fase, tipo: 'alu',    op }                 ->  ALU: REN1 op REN2
 *   { fase, tipo: 'salto',  bandera, valor }     ->  PC ← MDR (si se cumple)
 *   { fase, tipo: 'detener' }                    ->  HLT
 *   { fase, tipo: 'nada',   texto }              ->  la fase no hace nada
 *
 * Fases: BÚSQUEDA, DECODIFICACIÓN, EJECUCIÓN, ALMACENAMIENTO.
 *
 * Cada micro-operación tiene su palabra de control (tarea 1-6, ver
 * docs/microword.md): MicroOperaciones.palabraDeControl(op, banderas).
 */

const FASES = {
  BUSQUEDA: 'BÚSQUEDA',
  DECODIFICACION: 'DECODIFICACIÓN',
  EJECUCION: 'EJECUCIÓN',
  ALMACENAMIENTO: 'ALMACENAMIENTO'
};

const MicroOperaciones = {

  /**
   * Fase de búsqueda (pasos de la lámina de clase):
   *   1. RDM ← C.P.   (MAR ← PC)       3. R.I. ← RIM   (IR ← MDR)
   *   2. RIM ← M(RDM) (MDR ← RAM[MAR]) 5. C.P. ← C.P. + 1
   * y luego el paso 4, Sec ← Decod(RI), ya en la fase de decodificación.
   * Se incrementa el PC antes de decodificar, como indica el enunciado.
   */
  busqueda() {
    const F = FASES.BUSQUEDA;
    return [
      { fase: F, tipo: 'bus', origen: 'PC', destino: 'MAR' },
      { fase: F, tipo: 'bus', origen: 'RAM', destino: 'MDR', acceso: 'I' },
      { fase: F, tipo: 'bus', origen: 'MDR', destino: 'IR' },
      { fase: F, tipo: 'incPC' },
      { fase: FASES.DECODIFICACION, tipo: 'decodificar' }
    ];
  },

  /**
   * Micro-operaciones que siguen a la decodificación de una instrucción.
   * Si la instrucción ocupa 2 bytes, primero se busca el operando en memoria
   * (queda en MDR) y después se ejecuta.
   */
  planificar(entrada) {
    const D = FASES.DECODIFICACION, E = FASES.EJECUCION, A = FASES.ALMACENAMIENTO;
    const ops = [];

    if (entrada.bytes === 2) {
      ops.push({ fase: D, tipo: 'bus', origen: 'PC', destino: 'MAR' });
      ops.push({ fase: D, tipo: 'bus', origen: 'RAM', destino: 'MDR', operando: true, acceso: 'I' });
      ops.push({ fase: D, tipo: 'incPC' });
    }

    const m = entrada.mnemonico;

    // ── Control ──
    if (m === 'HLT') {
      ops.push({ fase: E, tipo: 'detener' });
      return ops;
    }

    // ── Transferencia de datos ──
    if (m === 'MOV') {
      const origen = entrada.origen === 'INM' ? 'MDR' : entrada.origen;
      ops.push({ fase: E, tipo: 'nada', texto: 'MOV no usa la ALU' });
      ops.push({ fase: A, tipo: 'bus', origen: origen, destino: entrada.destino });
      return ops;
    }
    if (m === 'LOAD') {
      ops.push({ fase: E, tipo: 'bus', origen: 'MDR', destino: 'MAR' });
      ops.push({ fase: E, tipo: 'bus', origen: 'RAM', destino: 'MDR', acceso: 'D' });
      ops.push({ fase: A, tipo: 'bus', origen: 'MDR', destino: entrada.destino });
      return ops;
    }
    if (m === 'STORE') {
      ops.push({ fase: E, tipo: 'bus', origen: 'MDR', destino: 'MAR' });
      ops.push({ fase: E, tipo: 'bus', origen: entrada.origen, destino: 'MDR' });
      ops.push({ fase: A, tipo: 'bus', origen: 'MDR', destino: 'RAM', acceso: 'D' });
      return ops;
    }

    // ── Aritmética y lógica ──
    if (entrada.alu) {
      ops.push({ fase: E, tipo: 'bus', origen: entrada.destino, destino: 'REN1' });
      if (entrada.origen === 'INM') ops.push({ fase: E, tipo: 'bus', origen: 'MDR', destino: 'REN2' });
      else if (entrada.origen) ops.push({ fase: E, tipo: 'bus', origen: entrada.origen, destino: 'REN2' });
      ops.push({ fase: E, tipo: 'alu', op: entrada.alu });
      if (OPERACIONES_ALU[entrada.alu].guardar) {
        ops.push({ fase: A, tipo: 'bus', origen: 'RESULTADO_ALU', destino: entrada.destino });
      } else {
        ops.push({ fase: A, tipo: 'nada', texto: entrada.alu + ' solo actualiza banderas (no guarda)' });
      }
      return ops;
    }

    // ── Saltos ──
    if (m === 'JMP') { ops.push({ fase: E, tipo: 'salto', bandera: null, valor: null }); return ops; }
    if (m === 'JZ')  { ops.push({ fase: E, tipo: 'salto', bandera: 'ZF', valor: 1 }); return ops; }
    if (m === 'JNZ') { ops.push({ fase: E, tipo: 'salto', bandera: 'ZF', valor: 0 }); return ops; }

    throw new Error('Instrucción sin micro-operaciones definidas: ' + m);
  },

  /**
   * Palabra de control (micro-palabra) que la Unidad de Control emite para
   * una micro-operación, en cualquiera de las 4 fases:
   *   MAR ← PC          -> En_PC · Ld_MAR
   *   MDR ← RAM[MAR]    -> Mem_R · En_RAM · Ld_MDR
   *   ALU: REN1 ADD REN2 -> Ld_FLAGS · ALU_op=ADD
   * Un salto condicional solo activa En_MDR y Ld_PC si la bandera cumple la
   * condición; si no salta, la palabra es vacía (todos los buffers en HIGH-Z).
   * `banderas` = {ZF, CF, SF}; solo se usa en los saltos condicionales.
   */
  palabraDeControl(op, banderas) {
    if (op.tipo === 'salto' && op.bandera && (!banderas || banderas[op.bandera] !== op.valor)) {
      return MicroPalabra.vacia();
    }
    return MicroPalabra.paraMicroOperacion(op);
  },

  /** Texto legible de una micro-operación, para el log y la hoja CPU. */
  describir(op) {
    const nombre = r => r === 'RAM' ? 'RAM[MAR]' : r;
    switch (op.tipo) {
      case 'bus': return nombre(op.destino) + ' ← ' + nombre(op.origen);
      case 'incPC': return 'PC ← PC + 1';
      case 'decodificar': return 'Decodificar IR';
      case 'alu': return 'ALU: RESULTADO ← REN1 ' + op.op + (OPERACIONES_ALU[op.op].aridad === 2 ? ' REN2' : '');
      case 'salto': return op.bandera ? 'Si ' + op.bandera + ' = ' + op.valor + ': PC ← MDR' : 'PC ← MDR';
      case 'detener': return 'HLT: detener el reloj';
      case 'nada': return op.texto;
    }
    return op.tipo;
  }
};
