/**
 * Principal.gs
 * Puntos de entrada: menú personalizado y activadores simples.
 */

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Simulador CPU')
    .addItem('Abrir panel de control', 'abrirPanel')
    .addSeparator()
    .addItem('Preparar libro', 'prepararLibro')
    .addSeparator()
    .addItem('Cargar programa demo (5 × 3)', 'menuCargarDemo')
    .addItem('Cargar demo de alto nivel (5 × 3)', 'menuCargarDemoAlto')
    .addItem('Compilar alto nivel y cargar', 'menuCompilar')
    .addItem('Ensamblar y cargar programa', 'menuEnsamblar')
    .addItem('Paso (una micro-operación)', 'menuPaso')
    .addItem('Ejecutar instrucción completa', 'menuEjecutarInstruccion')
    .addItem('Ejecutar hasta HLT', 'menuEjecutarHastaDetener')
    .addItem('Reiniciar CPU', 'menuReiniciarCpu')
    .addSeparator()
    .addItem('Limpiar RAM', 'menuLimpiarRam')
    .addItem('Cargar patrón de prueba en RAM', 'menuCargarPatronPrueba')
    .addItem('Actualizar tabla ISA', 'menuActualizarIsa')
    .addSeparator()
    .addSubMenu(ui.createMenu('Pruebas')
      .addItem('Ejecutar todas', 'probarTodo')
      .addSeparator()
      .addItem('Memoria', 'probarMemoria')
      .addItem('Acceso a memoria', 'probarAccesoMemoria')
      .addItem('Registros', 'probarRegistros')
      .addItem('ALU', 'probarALU')
      .addItem('ISA', 'probarISA')
      .addItem('Bus', 'probarBus')
      .addItem('Ensamblador', 'probarEnsamblador')
      .addItem('Unidad de control', 'probarUnidadControl')
      .addItem('Simulación', 'probarSimulacion')
      .addItem('Casos borde', 'probarBorde')
      .addItem('Compilador', 'probarCompilador'))
    .addToUi();
}

function onEdit(e) {
  if (!e || !e.range) return;
  VistaRam.alEditar(e);
}

/** Ensambla el programa de la hoja Código, lo muestra en Compilador y lo carga en RAM. */
function menuEnsamblar() {
  const resultado = Simulacion.cargar();
  if (!resultado.ok) {
    SpreadsheetApp.getUi().alert(resultado.mensaje, resultado.errores.slice(0, 10).join('\n'),
      SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }
  SpreadsheetApp.getActive().toast(resultado.mensaje, 'Ensamblador', 4);
}

/** Compila el alto nivel (columna B), escribe el ensamblador en la columna E y lo carga. */
function menuCompilar() {
  const resultado = Simulacion.compilar();
  if (!resultado.ok) {
    SpreadsheetApp.getUi().alert(resultado.mensaje, resultado.errores.slice(0, 10).join('\n'),
      SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }
  SpreadsheetApp.getActive().toast(resultado.mensaje, 'Compilador', 5);
}

function menuPaso() {
  const r = Simulacion.paso();
  SpreadsheetApp.getActive().toast(r.detenido && !r.paso
    ? 'CPU detenido. Usa "Reiniciar CPU".'
    : '[' + r.fase + '] ' + r.descripcion + ' · ' + r.detalle, 'Paso ' + r.paso, 3);
}

function menuEjecutarInstruccion() {
  const r = Simulacion.instruccion();
  SpreadsheetApp.getActive().toast(r.instruccion, 'Instrucción ejecutada', 3);
}

function menuEjecutarHastaDetener() {
  const r = Simulacion.hastaDetener();
  SpreadsheetApp.getActive().toast('Programa terminado en ' + r.pasosEjecutados + ' micro-operaciones.', 'HLT', 4);
}

function menuReiniciarCpu() {
  Simulacion.reiniciar();
  SpreadsheetApp.getActive().toast('Registros, banderas, log y ciclo reiniciados.', 'CPU', 3);
}

function menuLimpiarRam() {
  Memoria.limpiar();
  VistaRam.pintarSegmentos();
  SpreadsheetApp.getActive().toast('RAM limpia (todo en 00).', 'RAM', 3);
}

/** Escribe valor = dirección en cada celda (00, 01, ... FF) para verificar el mapeo de la matriz. */
function menuCargarPatronPrueba() {
  const bytes = [];
  for (let i = 0; i < MAPA_MEMORIA.TAMANO; i++) bytes.push(i);
  Memoria.cargar(0, bytes);
  SpreadsheetApp.getActive().toast('Patrón de prueba cargado: RAM[x] = x.', 'RAM', 3);
}

function menuActualizarIsa() {
  ISA.validar();
  ISA.escribirEnHoja();
  SpreadsheetApp.getActive().toast('Tabla ISA actualizada (' + TABLA_ISA.length + ' instrucciones).', 'ISA', 3);
}
