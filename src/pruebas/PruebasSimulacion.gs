/**
 * pruebas/PruebasSimulacion.gs
 * Pruebas de la interfaz de simulación: log de micro-operaciones, panel de la
 * hoja CPU, resaltado de componentes y funciones del panel lateral.
 * Restaura la RAM y la columna Ensamblador de la hoja Código al terminar.
 */

function probarSimulacion() {
  mostrarReporte_([suiteSimulacion_()]);
}

function suiteSimulacion_() {
  const t = crearSuite_('Simulación');
  const color = c => String(c).toLowerCase();
  const cargar = lineas => {
    const r = Ensamblador.ensamblar(lineas);
    if (!r.ok) throw new Error('el programa de prueba no ensambla');
    Memoria.cargar(0, r.memoria);
    Simulacion.reiniciar();
  };
  const hojaCodigo = SpreadsheetApp.getActive().getSheetByName(HOJAS.CODIGO);
  const respaldoRam = Memoria.volcar();
  const respaldoCodigo = hojaCodigo.getRange(4, 5, 100, 1).getDisplayValues();

  try {
    t.prueba('reiniciar limpia el log', () => {
      SpreadsheetApp.getActive().getSheetByName(HOJAS.LOG).getRange(4, 1).setValue('x');
      Simulacion.reiniciar();
      t.igual(LogMicroops.leerFila(1)[0], '');
    });
    t.prueba('cada paso agrega una fila al log con paso, instrucción, fase y micro-operación', () => {
      cargar(['MOV AX, 5', 'HLT']);
      Simulacion.paso();
      const fila = LogMicroops.leerFila(1);
      t.igual(fila[0], '[Paso 01]');
      t.igual(fila[1].indexOf('#1'), 0);
      t.igual(fila[2], FASES.BUSQUEDA);
      t.igual(fila[3], 'MAR ← PC');
    });
    t.prueba('resaltado: en MAR ← PC, MAR es destino y PC es origen', () => {
      t.igual(color(Resaltado.colorDe('MAR')), color(COLORES.ACTIVO));
      t.igual(color(Resaltado.colorDe('PC')), color(COLORES.ORIGEN));
      t.igual(color(Resaltado.fase_(FASES.BUSQUEDA).getBackground()), color(COLORES.ACTIVO));
    });
    t.prueba('resaltado: en MDR ← RAM[MAR] se pinta la celda de RAM y se limpia MAR', () => {
      Simulacion.paso();
      t.igual(color(Resaltado.colorDe('MDR')), color(COLORES.ACTIVO));
      t.igual(color(UtilMemoria.celdaDe(0x00).getBackground()), color(COLORES.ORIGEN));
      t.igual(color(Resaltado.colorDe('MAR')), color(COLORES.REGISTRO));
    });
    t.prueba('el panel de la hoja CPU muestra primero la micro-operación más reciente', () => {
      const panel = SpreadsheetApp.getActive().getRangeByName(NOMBRES.PANEL_LOG);
      t.igual(String(panel.getCell(1, 1).getDisplayValue()), '2');
      t.igual(String(panel.getCell(2, 1).getDisplayValue()), '1');
    });
    t.prueba('hasta HLT: el log tiene una fila por micro-operación y termina en HLT', () => {
      cargar(['MOV AX, 5', 'ADD AX, 3', 'HLT']);
      const r = Simulacion.hastaDetener();
      t.igual(r.detenido, true);
      t.igual(r.estado, 'DETENIDO');
      t.igual(r.ax, '08h');
      t.igual(LogMicroops.leerFila(r.pasosEjecutados)[3], 'HLT: detener el reloj');
      t.igual(LogMicroops.leerFila(r.pasosEjecutados + 1)[0], '');
    });
    t.prueba('panelPaso(true) ejecuta la instrucción completa', () => {
      cargar(['MOV BX, 7', 'HLT']);
      const r = panelPaso(true);
      t.igual(r.bx, '07h');
      t.igual(r.instruccion, 'MOV BX, 07h');
    });
    t.prueba('cargar informa los errores del programa sin cargarlo', () => {
      hojaCodigo.getRange(4, 5, 100, 1).clearContent();
      hojaCodigo.getRange(4, 5).setValue('MOV AX');
      const r = Simulacion.cargar();
      t.igual(r.ok, false);
      t.igual(r.errores.length, 1);
      t.igual(r.errores[0].indexOf('Línea 1'), 0);
    });
    t.prueba('cargar un programa válido reinicia el CPU', () => {
      hojaCodigo.getRange(4, 5, 2, 1).setValues([['MOV AX, 1'], ['HLT']]);
      const r = Simulacion.cargar();
      t.igual(r.ok, true);
      t.igual(Registros.leerTexto('ESTADO'), 'LISTO');
      t.igual(Memoria.leer(0x00), 0x10);
    });
    t.prueba('control PASO de la hoja CPU: ejecuta un paso y la casilla se desmarca', () => {
      cargar(['MOV AX, 5', 'HLT']);
      const hojaCpu = SpreadsheetApp.getActive().getSheetByName(HOJAS.CPU);
      const casilla = hojaCpu.getRange(FILA_PRIMER_CONTROL + 3, COL_CONTROLES);
      casilla.setValue(true);
      Controles.atender({ range: casilla, value: 'TRUE' });
      t.igual(String(casilla.getValue()), 'false');
      t.igual(Registros.leerTexto('MICROPASO'), 'MAR ← PC');
      t.igual(String(SpreadsheetApp.getActive().getRangeByName(NOMBRES.MENSAJE_CONTROL).getDisplayValue()).indexOf('MAR ← PC') !== -1, true);
    });
    t.prueba('control EJECUTAR corre hasta HLT', () => {
      cargar(['MOV AX, 2', 'ADD AX, 3', 'HLT']);
      SpreadsheetApp.getActive().getRangeByName(NOMBRES.RETARDO).setValue(0);
      const r = Controles.ejecutarContinuo();
      t.igual(r.motivo, 'hlt');
      t.igual(Registros.leer('AX'), 5);
    });
    t.prueba('control PAUSA detiene EJECUTAR antes de terminar', () => {
      cargar(['MOV AX, 1', 'MOV BX, 2', 'HLT']);
      const props = PropertiesService.getDocumentProperties();
      const original = Simulacion.instruccion;
      Simulacion.instruccion = () => { const r = original(); Controles.pausar(); return r; };
      try {
        const r = Controles.ejecutarContinuo();
        t.igual(r.motivo, 'pausa');
        t.igual(Registros.leer('BX'), 0);
      } finally {
        Simulacion.instruccion = original;
        props.setProperty(CLAVE_PAUSA, '0');
      }
    });
  } finally {
    hojaCodigo.getRange(4, 5, 100, 1).setValues(respaldoCodigo);
    VistaCompilador.marcarErrores([]);
    UtilMemoria.rangoMatriz().setValues(UtilMemoria.aMatriz(respaldoRam));
    Simulacion.reiniciar();
  }

  return t;
}
