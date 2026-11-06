/**
 * pruebas/PruebasUnidadControl.gs
 * Pruebas del ciclo de instrucción completo sobre la hoja: cada prueba
 * ensambla un programa corto, lo carga en RAM y lo ejecuta con la Unidad
 * de Control. La RAM se respalda antes y se restaura al final.
 */

function probarUnidadControl() {
  mostrarReporte_([suiteUnidadControl_()]);
}

function suiteUnidadControl_() {
  const t = crearSuite_('Unidad de control');
  const cargar = lineas => {
    const r = Ensamblador.ensamblar(lineas);
    if (!r.ok) throw new Error('el programa de prueba no ensambla: ' + r.errores[0].mensaje);
    Memoria.cargar(0, r.memoria);
    UnidadControl.reiniciar();
  };
  const respaldoRam = Memoria.volcar();

  try {
    t.prueba('búsqueda: 4 micro-pasos (MAR ← PC, MDR ← RAM, IR ← MDR, PC + 1)', () => {
      cargar(['MOV AX, 5', 'HLT']);
      const fases = [];
      for (let i = 0; i < 4; i++) fases.push(UnidadControl.paso().fase);
      t.igual(fases.join(','), [FASES.BUSQUEDA, FASES.BUSQUEDA, FASES.BUSQUEDA, FASES.BUSQUEDA].join(','));
      t.igual(Registros.leer('MAR'), 0x00);
      t.igual(Registros.leer('MDR'), 0x10);
      t.igual(Registros.leer('IR'), 0x10);
      t.igual(Registros.leer('PC'), 0x01);
    });
    t.prueba('decodificación: identifica la instrucción y busca el operando', () => {
      const ev = UnidadControl.paso();
      t.igual(ev.fase, FASES.DECODIFICACION);
      t.igual(Registros.leerTexto('DECODIFICADO'), 'MOV AX, inm');
      UnidadControl.paso(); UnidadControl.paso(); UnidadControl.paso();
      t.igual(Registros.leerTexto('DECODIFICADO'), 'MOV AX, 05h');
      t.igual(Registros.leer('PC'), 0x02);
    });
    t.prueba('ejecución y almacenamiento: MOV AX, 5 deja AX = 05h', () => {
      UnidadControl.ejecutarInstruccion();
      t.igual(Registros.leer('AX'), 5);
    });
    t.prueba('HLT detiene el CPU y los pasos siguientes no hacen nada', () => {
      UnidadControl.ejecutarInstruccion();
      t.igual(UnidadControl.estaDetenido(), true);
      t.igual(Registros.leerTexto('ESTADO'), 'DETENIDO');
      t.igual(UnidadControl.paso().detenido, true);
    });
    t.prueba('LOAD y STORE pasan por MAR y MDR', () => {
      cargar(['.data', 'x DB 9', 'y DB 0', '.code', 'LOAD AX, [x]', 'STORE [y], AX', 'HLT']);
      UnidadControl.ejecutarHastaDetener();
      t.igual(Registros.leer('AX'), 9);
      t.igual(Memoria.leer(0x81), 9);
    });
    t.prueba('SUB AX, 5 con AX = 5 deja AX = 0 y ZF = 1', () => {
      cargar(['MOV AX, 5', 'SUB AX, 5', 'HLT']);
      UnidadControl.ejecutarHastaDetener();
      t.igual(Registros.leer('AX'), 0);
      t.igual(Registros.leerBanderas().ZF, 1);
    });
    t.prueba('CMP actualiza banderas sin cambiar AX', () => {
      cargar(['MOV AX, 7', 'CMP AX, 7', 'HLT']);
      UnidadControl.ejecutarHastaDetener();
      t.igual(Registros.leer('AX'), 7);
      t.igual(Registros.leerBanderas().ZF, 1);
    });
    t.prueba('JZ salta cuando ZF = 1', () => {
      cargar(['MOV AX, 1', 'CMP AX, 1', 'JZ si', 'MOV BX, 2', 'HLT', 'si: MOV BX, 9', 'HLT']);
      UnidadControl.ejecutarHastaDetener();
      t.igual(Registros.leer('BX'), 9);
    });
    t.prueba('JNZ no salta cuando ZF = 1', () => {
      cargar(['MOV AX, 1', 'CMP AX, 1', 'JNZ si', 'MOV BX, 2', 'HLT', 'si: MOV BX, 9', 'HLT']);
      UnidadControl.ejecutarHastaDetener();
      t.igual(Registros.leer('BX'), 2);
    });
    t.prueba('programa completo: 4 × 2 por sumas sucesivas = 8 en memoria', () => {
      const programa = PROGRAMA_PRUEBA_MULTIPLICACION
        .map(l => l.replace('a    DB 5', 'a    DB 4').replace('b    DB 3', 'b    DB 2'));
      cargar(programa);
      UnidadControl.ejecutarHastaDetener();
      t.igual(Memoria.leer(0x82), 8);
      t.igual(Memoria.leer(0x81), 0);
    });
    // ── Micro-palabra emitida por la UC (tarea 1-6) ──
    t.prueba('MicroOperaciones.palabraDeControl: una palabra por micro-operación en las 4 fases', () => {
      const ops = MicroOperaciones.busqueda().concat(MicroOperaciones.planificar(ISA.porOpcode(0x10)));
      const fases = new Set(ops.map(op => op.fase));
      t.igual(fases.size, 4);
      ops.forEach(op => t.igual(Array.isArray(MicroPalabra.aBits(MicroOperaciones.palabraDeControl(op))), true));
      const salto = { fase: FASES.EJECUCION, tipo: 'salto', bandera: 'ZF', valor: 1 };
      t.igual(MicroPalabra.describir(MicroOperaciones.palabraDeControl(salto, { ZF: 1 })), 'Ld_PC · En_MDR');
      t.igual(MicroPalabra.describir(MicroOperaciones.palabraDeControl(salto, { ZF: 0 })), '(ninguna)');
    });
    t.prueba('micro-palabra: la búsqueda emite las 4 palabras de la guía', () => {
      cargar(['MOV AX, 5', 'HLT']);
      const palabras = [];
      for (let i = 0; i < 5; i++) palabras.push(UnidadControl.paso().micropalabra);
      t.igual(palabras.join(' | '), 'En_PC · Ld_MAR | Mem_R · Ld_MDR · En_RAM | En_MDR · Ld_IR | Inc_PC | (ninguna)');
    });
    t.prueba('micro-palabra: cada evento trae palabra, bits y estado de los buses', () => {
      cargar(['MOV AX, 5', 'HLT']);
      const ev = UnidadControl.paso();
      t.igual(MicroPalabra.leer(ev.palabra, 'En_PC'), 1);
      t.igual(ev.micropalabraBits, '1001 0000 0000 0000 0000 0000 0000 00');
      t.igual(ev.buses.buffers.PC, CONDUCE);
      t.igual(ev.buses.buffers.MDR, HIGH_Z);
      t.igual(ev.descripcionBuses.indexOf('Bus interno: PC → MAR'), 0);
      t.igual(ev.historial[0].micropalabra, 'En_PC · Ld_MAR');
    });
    t.prueba('micro-palabra: la ALU emite ALU_op y Ld_FLAGS', () => {
      cargar(['MOV CX, 2', 'ADD CX, 3', 'HLT']);
      const vistas = [];
      UnidadControl.suscribir(e => vistas.push(e.micropalabra));
      UnidadControl.ejecutarHastaDetener();
      UnidadControl.limpiarSuscriptores();
      t.igual(vistas.indexOf('Ld_FLAGS · ALU_op=ADD') >= 0, true);
      t.igual(vistas.indexOf('En_ALU · Ld_CX') >= 0, true);
      t.igual(Registros.leer('CX'), 5);
    });
    t.prueba('micro-palabra: salto tomado activa Ld_PC; salto no tomado no activa nada', () => {
      const saltos = [];
      UnidadControl.suscribir(e => { if (e.microop.tipo === 'salto') saltos.push(e.micropalabra); });
      cargar(['MOV AX, 1', 'CMP AX, 1', 'JZ fin', 'MOV BX, 9', 'fin: HLT']);
      UnidadControl.ejecutarHastaDetener();
      cargar(['MOV AX, 1', 'CMP AX, 2', 'JZ fin', 'MOV BX, 9', 'fin: HLT']);
      UnidadControl.ejecutarHastaDetener();
      UnidadControl.limpiarSuscriptores();
      t.igual(saltos.join(' | '), 'Ld_PC · En_MDR | (ninguna)');
    });
    t.prueba('micro-palabra: un programa con los 4 registros nunca tiene dos emisores', () => {
      cargar(['.data', 'x DB 4', 'y DB 0', '.code', 'LOAD CX, [x]', 'MOV DX, 0', 'vuelta: ADD DX, 2',
        'MOV AX, DX', 'MOV BX, AX', 'DEC CX', 'JNZ vuelta', 'STORE [y], DX', 'HLT']);
      let pasos = 0, maxEmisores = 0;
      UnidadControl.suscribir(e => {
        pasos++;
        maxEmisores = Math.max(maxEmisores, MicroPalabra.emisores(e.palabra).length);
      });
      UnidadControl.ejecutarHastaDetener();
      UnidadControl.limpiarSuscriptores();
      t.igual(Memoria.leer(0x81), 8);
      t.igual(pasos > 50, true);
      t.igual(maxEmisores, 1);
    });
    t.prueba('micro-palabra inválida (AX ← RAM sin MDR) detiene el CPU con ERROR sin ejecutar el paso', () => {
      cargar(['HLT']);
      Registros.escribir('AX', 0x11);
      PropertiesService.getDocumentProperties().setProperty(CLAVE_ESTADO_UC, JSON.stringify({
        cola: [{ fase: FASES.EJECUCION, tipo: 'bus', origen: 'RAM', destino: 'AX', acceso: 'D' }]
      }));
      let mensaje = '';
      try { UnidadControl.paso(); } catch (e) { mensaje = e.message; }
      t.igual(/MDR/.test(mensaje), true);
      t.igual(Registros.leerTexto('ESTADO'), 'ERROR');
      t.igual(Registros.leer('AX'), 0x11);
    });
    t.prueba('opcode inválido detiene el CPU con estado ERROR', () => {
      Memoria.cargar(0, [0xFF]);
      UnidadControl.reiniciar();
      t.lanzaError(() => UnidadControl.ejecutarInstruccion());
      t.igual(Registros.leerTexto('ESTADO'), 'ERROR');
    });
  } finally {
    UnidadControl.limpiarSuscriptores();
    UtilMemoria.rangoMatriz().setValues(UtilMemoria.aMatriz(respaldoRam));
    UnidadControl.reiniciar();
  }

  return t;
}
