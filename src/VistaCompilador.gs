/**
 * VistaCompilador.gs
 * Muestra en la hoja Compilador el resultado del ensamblador (tokens, tabla
 * de símbolos y listado de código máquina) y marca en la hoja Código las
 * líneas que tienen errores.
 */

const COLOR_ERROR = '#FFCDD2';
const FILA_INICIO_COMPILADOR = 5;
const MAX_FILAS_COMPILADOR = 296;

const VistaCompilador = {

  mostrarEnsamblado(resultado) {
    const hoja = SpreadsheetApp.getActive().getSheetByName(HOJAS.COMPILADOR);

    VistaCompilador.escribirTabla_(hoja, 1, 3,
      resultado.tokens.map(t => [t.linea, t.tipo, t.texto]));

    VistaCompilador.escribirTabla_(hoja, 10, 3,
      resultado.simbolos.map(s => [s.nombre, s.tipo, s.direccion.toString(16).toUpperCase()
  .padStart(resultado.virtual ? 3 : 2, '0') + 'h']));

    VistaCompilador.escribirTabla_(hoja, 14, 4,
      resultado.listado.map(l => [
        l.direccion.toString(16).toUpperCase()
  .padStart(resultado.virtual ? 3 : 2, '0') + 'h',
        l.bytes.map(UtilMemoria.aHex).join(' '),
        l.bytes.map(UtilMemoria.aBin).join(' '),
        l.fuente
      ]));

    VistaCompilador.marcarErrores(resultado.errores);
  },

  /** Pinta en rojo las líneas con error en la hoja Código y escribe el mensaje al lado. */
  marcarErrores(errores) {
    const hoja = SpreadsheetApp.getActive().getSheetByName(HOJAS.CODIGO);
    hoja.getRange(4, 5, 100, 1).setBackground(COLORES.ENTRADA);
    const mensajes = [];
    for (let i = 0; i < 100; i++) mensajes.push(['']);
    errores.forEach(e => {
      if (e.linea >= 1 && e.linea <= 100) {
        hoja.getRange(3 + e.linea, 5).setBackground(COLOR_ERROR);
        mensajes[e.linea - 1] = ['⚠ ' + e.mensaje];
      }
    });
    hoja.getRange(4, 6, 100, 1).setValues(mensajes).setFontColor('#C62828');
  },

  /**
   * Etapas del compilador de alto nivel: tokens (A–C), AST (E) y ensamblador
   * generado (G–H). La tabla de símbolos y el listado los escribe el ensamblador.
   */
  mostrarEtapasAlto(comp, lineasAsm) {
    const hoja = SpreadsheetApp.getActive().getSheetByName(HOJAS.COMPILADOR);
    VistaCompilador.escribirTabla_(hoja, 1, 3, comp.tokens.map(t => [t.linea, t.tipo, t.texto]));
    VistaCompilador.escribirTabla_(hoja, 5, 1, comp.astTexto.map(l => [l]));
    VistaCompilador.escribirTabla_(hoja, 7, 2,
      lineasAsm.map((texto, i) => [comp.ensamblador[i] && comp.ensamblador[i].lineaAlto ? 'L' + comp.ensamblador[i].lineaAlto : '', texto]));
  },

  /** Marca en rojo las líneas con error en la columna de alto nivel (B) de la hoja Código. */
  marcarErroresAlto(errores) {
    const hoja = SpreadsheetApp.getActive().getSheetByName(HOJAS.CODIGO);
    hoja.getRange(4, 2, 100, 1).setBackground(COLORES.ENTRADA);
    errores.forEach(e => {
      if (e.linea >= 1 && e.linea <= 100) hoja.getRange(3 + e.linea, 2).setBackground(COLOR_ERROR);
    });
  },

  /** Limpia el bloque de columnas y escribe las filas a partir de la fila 5. */
  escribirTabla_(hoja, columna, ancho, filas) {
    hoja.getRange(FILA_INICIO_COMPILADOR, columna, MAX_FILAS_COMPILADOR, ancho).clearContent();
    if (filas.length === 0) return;
    const recorte = filas.slice(0, MAX_FILAS_COMPILADOR);
    hoja.getRange(FILA_INICIO_COMPILADOR, columna, recorte.length, ancho).setValues(recorte);
  }
};
