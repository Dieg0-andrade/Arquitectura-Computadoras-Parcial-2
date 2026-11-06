/**
 * LogMicroops.gs
 * Log cronológico de micro-operaciones.
 *
 * Hoja Log: Paso, Instrucción, Fase, Micro-operación, Detalle,
 * Micro-palabra y Bits. La fila del paso N es la 3 + N.
 *
 * Las filas se acumulan con agregar() y se escriben juntas con volcar().
 * Para la tarea 17, el campo Detalle también incluye el resultado de caché
 * cuando la micro-operación realiza un acceso a memoria.
 */

const FILA_INICIO_LOG = 4;
const COLUMNAS_LOG = 7;

const LogMicroops = {
  pendientes_: [],

  /**
   * Acumula un evento de la Unidad de Control.
   * El panel y el Log usan el resultado del mismo acceso.
   */
  agregar(evento) {
    let detalle = evento.detalle || '';

    if (VistaCacheActividad.anteriores_ === null) {
      // La primera micro-operación de una ejecución puede ser ya una
      // lectura. La base se prepara en el paso público de simulación.
      // Para llamadas aisladas al log se conserva el detalle original.
    } else {
      const actividad = VistaCacheActividad.registrar(evento);

      if (actividad) {
        detalle = detalle ? detalle + ' | ' + actividad : actividad;
        evento.detalle = detalle;

        const ultimo = evento.historial && evento.historial[0];
        if (ultimo && ultimo.paso === evento.paso) {
          ultimo.detalle = detalle;
        }
      }
    }

    LogMicroops.pendientes_.push({
      paso: evento.paso,
      fila: [
        '[Paso ' + String(evento.paso).padStart(2, '0') + ']',
        '#' + evento.numeroInstruccion + ' ' + (evento.instruccion || ''),
        evento.fase,
        evento.descripcion,
        detalle,
        evento.micropalabra || '',
        evento.micropalabraBits || ''
      ]
    });
  },

  volcar() {
    const pendientes = LogMicroops.pendientes_;
    LogMicroops.pendientes_ = [];
    if (pendientes.length === 0) return;

    const hoja = SpreadsheetApp.getActive().getSheetByName(HOJAS.LOG);
    const filaInicial = FILA_INICIO_LOG - 1 + pendientes[0].paso;
    const filaFinal = filaInicial + pendientes.length - 1;

    if (filaFinal > hoja.getMaxRows()) {
      hoja.insertRowsAfter(
        hoja.getMaxRows(),
        filaFinal - hoja.getMaxRows() + 100
      );
    }

    hoja.getRange(filaInicial, 1, pendientes.length, COLUMNAS_LOG)
      .setValues(pendientes.map(p => p.fila));
  },

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

  limpiar() {
    LogMicroops.pendientes_ = [];

    const hoja = SpreadsheetApp.getActive().getSheetByName(HOJAS.LOG);
    const filas = hoja.getMaxRows() - FILA_INICIO_LOG + 1;

    if (filas > 0) {
      hoja.getRange(FILA_INICIO_LOG, 1, filas, COLUMNAS_LOG).clearContent();
    }

    LogMicroops.escribirPanel([]);
    VistaCacheActividad.limpiar();
  },

  leerFila(paso) {
    const hoja = SpreadsheetApp.getActive().getSheetByName(HOJAS.LOG);
    return hoja.getRange(
      FILA_INICIO_LOG - 1 + paso, 1, 1, COLUMNAS_LOG
    ).getDisplayValues()[0];
  }
};