/**
 * LogMicroops.gs
 * Log cronológico de micro-operaciones.
 *
 *   - Hoja Log: una fila por micro-operación (Paso, Instrucción, Fase,
 *     Micro-operación, Detalle, Micro-palabra, Bits), en orden. La fila del
 *     paso N es la 3 + N. Las dos últimas columnas son la palabra de control
 *     que emitió la Unidad de Control en ese paso (tarea 1-6).
 *   - Hoja CPU: panel con las últimas 10 micro-operaciones, la más reciente arriba.
 *
 * Las filas se acumulan en memoria con agregar() y se escriben todas juntas
 * con volcar(): así "Ejecutar hasta HLT" hace una sola escritura aunque
 * ejecute cientos de micro-operaciones.
 */

const FILA_INICIO_LOG = 4;
const COLUMNAS_LOG = 7;

const LogMicroops = {

  pendientes_: [],

  /** Acumula un evento de la Unidad de Control (se usa como suscriptor). */
  agregar(evento) {
    LogMicroops.pendientes_.push({
      paso: evento.paso,
      fila: [
        '[Paso ' + String(evento.paso).padStart(2, '0') + ']',
        '#' + evento.numeroInstruccion + ' ' + (evento.instruccion || ''),
        evento.fase,
        evento.descripcion,
        evento.detalle || '',
        evento.micropalabra || '',
        evento.micropalabraBits || ''
      ]
    });
  },

  /** Escribe en la hoja Log todas las filas acumuladas. */
  volcar() {
    const pendientes = LogMicroops.pendientes_;
    LogMicroops.pendientes_ = [];
    if (pendientes.length === 0) return;

    const hoja = SpreadsheetApp.getActive().getSheetByName(HOJAS.LOG);
    const filaInicial = FILA_INICIO_LOG - 1 + pendientes[0].paso;
    const filaFinal = filaInicial + pendientes.length - 1;
    if (filaFinal > hoja.getMaxRows()) {
      hoja.insertRowsAfter(hoja.getMaxRows(), filaFinal - hoja.getMaxRows() + 100);
    }
    hoja.getRange(filaInicial, 1, pendientes.length, COLUMNAS_LOG).setValues(pendientes.map(p => p.fila));
  },

  /** Muestra en la hoja CPU las últimas micro-operaciones (la más reciente arriba). */
  escribirPanel(historial) {
    const panel = SpreadsheetApp.getActive().getRangeByName(NOMBRES.PANEL_LOG);
    if (!panel) return;
    const hoja = panel.getSheet();
    const fila0 = panel.getRow();
    const columnas = { paso: [], fase: [], descripcion: [], detalle: [] };
    for (let i = 0; i < TAMANO_HISTORIAL; i++) {
      const h = historial[i];
      columnas.paso.push([h ? h.paso : '']);
      columnas.fase.push([h ? h.fase : '']);
      columnas.descripcion.push([h ? h.descripcion : '']);
      columnas.detalle.push([h ? h.detalle : '']);
    }
    hoja.getRange(fila0, 2, TAMANO_HISTORIAL, 1).setValues(columnas.paso);
    hoja.getRange(fila0, 3, TAMANO_HISTORIAL, 1).setValues(columnas.fase);
    hoja.getRange(fila0, 5, TAMANO_HISTORIAL, 1).setValues(columnas.descripcion);
    hoja.getRange(fila0, 8, TAMANO_HISTORIAL, 1).setValues(columnas.detalle);
  },

  /** Borra la hoja Log y el panel de la hoja CPU. */
  limpiar() {
    LogMicroops.pendientes_ = [];
    const hoja = SpreadsheetApp.getActive().getSheetByName(HOJAS.LOG);
    const filas = hoja.getMaxRows() - FILA_INICIO_LOG + 1;
    if (filas > 0) hoja.getRange(FILA_INICIO_LOG, 1, filas, COLUMNAS_LOG).clearContent();
    LogMicroops.escribirPanel([]);
  },

  /** Lee una fila del log (1 = primer paso). Útil para las pruebas. */
  leerFila(paso) {
    const hoja = SpreadsheetApp.getActive().getSheetByName(HOJAS.LOG);
    return hoja.getRange(FILA_INICIO_LOG - 1 + paso, 1, 1, COLUMNAS_LOG).getDisplayValues()[0];
  }
};
