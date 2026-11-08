/**
 * Controles.gs
 * Botones de control dentro de la hoja CPU (columna P): cada control es una
 * casilla de verificación. Al marcarla se ejecuta la acción y la casilla se
 * desmarca sola.
 *
 *   CARGAR DEMO · COMPILAR · ENSAMBLAR · PASO · INSTRUCCIÓN · EJECUTAR · PAUSA · REINICIAR
 *
 * EJECUTAR corre instrucción por instrucción con el retardo de la celda
 * "Retardo (ms)" hasta HLT o hasta que se marque PAUSA. PAUSA funciona porque
 * cada acción corre en su propia ejecución: EJECUTAR revisa en cada vuelta una
 * propiedad del documento que PAUSA pone en 1.
 *
 * Las casillas se atienden con un activador instalable onEdit (se crea en
 * prepararLibro), porque un activador simple solo dura 30 segundos y no
 * alcanzaría para EJECUTAR.
 */

const FILA_PRIMER_CONTROL = 5;
const COL_CONTROLES = 16;          // columna P: casillas
const CLAVE_PAUSA = 'EJECUCION_PAUSADA';
const LIMITE_EJECUCION_MS = 270000; // 4,5 min: margen frente al límite de 6 min de Apps Script

const CONTROLES = [
  { etiqueta: '★ CARGAR DEMO', accion: () => ProgramasDemo.cargarAlto() },
  { etiqueta: '⚙ COMPILAR (col. B)', accion: () => Simulacion.compilar() },
  { etiqueta: '⤓ ENSAMBLAR (col. E)', accion: () => Simulacion.cargar() },
  { etiqueta: '▶| PASO', accion: () => Simulacion.paso() },
  { etiqueta: '⏭ INSTRUCCIÓN', accion: () => Simulacion.instruccion() },
  { etiqueta: '▶ EJECUTAR', accion: () => Controles.ejecutarContinuo() },
  { etiqueta: '❚❚ PAUSA', accion: () => Controles.pausar() },
  { etiqueta: '↺ REINICIAR', accion: () => Simulacion.reiniciar() }
];

const Controles = {

  /** Dibuja la columna de controles en la hoja CPU. */
  construir(hoja) {
    const n = CONTROLES.length;
    Diseno.bloque(hoja, 'P3:R' + (FILA_PRIMER_CONTROL + n + 6), 'CONTROLES', COLORES.REGISTRO);
    hoja.getRange(FILA_PRIMER_CONTROL - 1, COL_CONTROLES, 1, 3).merge()
      .setValue('Marca una casilla para ejecutar').setFontSize(8).setFontColor('#546E7A')
      .setHorizontalAlignment('center');

    const casillas = hoja.getRange(FILA_PRIMER_CONTROL, COL_CONTROLES, n, 1);
    casillas.insertCheckboxes().setHorizontalAlignment('center');
    CONTROLES.forEach((c, i) => {
      hoja.getRange(FILA_PRIMER_CONTROL + i, COL_CONTROLES + 1, 1, 2).merge()
        .setValue(c.etiqueta).setFontWeight('bold').setFontSize(10).setBackground('#FFFFFF')
        .setBorder(true, true, true, true, null, null, COLORES.BORDE, SpreadsheetApp.BorderStyle.SOLID);
    });

    const filaRetardo = FILA_PRIMER_CONTROL + n + 1;
    hoja.getRange(filaRetardo, COL_CONTROLES, 1, 2).merge().setValue('Retardo (ms)').setFontSize(9).setFontWeight('bold');
    hoja.getRange(filaRetardo, COL_CONTROLES + 2).setValue(300).setBackground(COLORES.ENTRADA)
      .setHorizontalAlignment('center').setNote('Pausa entre instrucciones al EJECUTAR (0 a 3000 ms)');
    hoja.getParent().setNamedRange(NOMBRES.RETARDO, hoja.getRange(filaRetardo, COL_CONTROLES + 2));

    const filaMensaje = filaRetardo + 2;
    const mensaje = hoja.getRange(filaMensaje, COL_CONTROLES, 3, 3).merge();
    mensaje.setValue('Listo.').setWrap(true).setFontSize(9).setVerticalAlignment('top').setBackground('#FFFFFF');
    hoja.getParent().setNamedRange(NOMBRES.MENSAJE_CONTROL, mensaje);

    hoja.setColumnWidth(COL_CONTROLES - 1, 16);
    hoja.setColumnWidth(COL_CONTROLES, 30);
    hoja.setColumnWidths(COL_CONTROLES + 1, 2, 90);
  },

  /** Crea (una sola vez) el activador instalable que atiende las casillas. */
  instalarActivador() {
    const ss = SpreadsheetApp.getActive();
    ScriptApp.getProjectTriggers()
      .filter(t => t.getHandlerFunction() === 'alEditarControles')
      .forEach(t => ScriptApp.deleteTrigger(t));
    ScriptApp.newTrigger('alEditarControles').forSpreadsheet(ss).onEdit().create();
  },

  /** Ejecuta la acción de la casilla marcada (si el evento es de un control). */
  atender(e) {
    const rango = e.range;
    if (rango.getSheet().getName() !== HOJAS.CPU) return;
    if (rango.getColumn() !== COL_CONTROLES || rango.getNumRows() !== 1) return;
    const indice = rango.getRow() - FILA_PRIMER_CONTROL;
    if (indice < 0 || indice >= CONTROLES.length) return;
    if (String(e.value).toUpperCase() !== 'TRUE') return;

    rango.setValue(false);               // la casilla vuelve a desmarcarse: se comporta como un botón
    SpreadsheetApp.flush();
    const control = CONTROLES[indice];
    try {
      Controles.mensaje(control.etiqueta + '…');
      const r = control.accion();
      Controles.mensaje(Controles.describir_(control, r));
    } catch (err) {
      Controles.mensaje('⚠ ' + err.message);
    }
  },

  /** EJECUTAR: instrucción por instrucción hasta HLT, PAUSA o el límite de tiempo. */
  ejecutarContinuo() {
    const props = PropertiesService.getDocumentProperties();
    props.setProperty(CLAVE_PAUSA, '0');
    const inicio = Date.now();
    let r = Simulacion.resumen_(null);
    while (!r.detenido) {
      if (props.getProperty(CLAVE_PAUSA) === '1') return Object.assign(r, { motivo: 'pausa' });
      if (Date.now() - inicio > LIMITE_EJECUCION_MS) return Object.assign(r, { motivo: 'tiempo' });
      r = Simulacion.instruccion();
      Controles.mensaje('▶ Ejecutando… ' + r.instruccion + ' (paso ' + r.paso + ')');
      SpreadsheetApp.flush();
      const retardo = Controles.retardo_();
      if (retardo > 0) Utilities.sleep(retardo);
    }
    return Object.assign(r, { motivo: 'hlt' });
  },

  pausar() {
    PropertiesService.getDocumentProperties().setProperty(CLAVE_PAUSA, '1');
    return { motivo: 'pausa-pedida' };
  },

  mensaje(texto) {
    const celda = SpreadsheetApp.getActive().getRangeByName(NOMBRES.MENSAJE_CONTROL);
    if (celda) celda.setValue(texto);
  },

  retardo_() {
    const celda = SpreadsheetApp.getActive().getRangeByName(NOMBRES.RETARDO);
    const valor = celda ? Number(celda.getValue()) : 0;
    if (isNaN(valor)) return 0;
    return Math.max(0, Math.min(3000, valor));
  },

  describir_(control, r) {
    if (!r) return 'Listo.';
    if (r.ok === false) return '⚠ ' + r.mensaje + ':\n' + (r.errores || []).slice(0, 3).join('\n');
    if (r.motivo === 'pausa-pedida') return '❚❚ Pausa pedida: la ejecución se detiene al terminar la instrucción actual.';
    if (r.motivo === 'pausa') return '❚❚ En pausa en ' + r.instruccion + '. Marca EJECUTAR para seguir.';
    if (r.motivo === 'tiempo') return '⏱ Límite de tiempo de Apps Script. Marca EJECUTAR para continuar.';
    if (r.motivo === 'hlt' || r.detenido) return '■ Programa terminado (HLT) en ' + r.paso + ' micro-operaciones.';
    if (r.mensaje) return r.mensaje;
    return '[' + r.fase + '] ' + r.descripcion + (r.detalle ? ' · ' + r.detalle : '');
  }
};

/** Activador instalable onEdit (lo crea prepararLibro). */
function alEditarControles(e) {
  if (!e || !e.range) return;
  if (Editor.atender(e)) return;
  Controles.atender(e);
}
