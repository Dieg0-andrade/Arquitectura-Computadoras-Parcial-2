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
    t.prueba('opcode inválido detiene el CPU con estado ERROR', () => {
      Memoria.cargar(0, [0xFF]);
      UnidadControl.reiniciar();
      t.lanzaError(() => UnidadControl.ejecutarInstruccion());
      t.igual(Registros.leerTexto('ESTADO'), 'ERROR');
    });
  } finally {
    UtilMemoria.rangoMatriz().setValues(UtilMemoria.aMatriz(respaldoRam));
    UnidadControl.reiniciar();
  }

  return t;
}
