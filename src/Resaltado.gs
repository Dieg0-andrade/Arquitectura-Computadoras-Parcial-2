/**
 * Resaltado.gs
 * Pinta en la hoja CPU y en la hoja RAM los componentes que participan en la
 * micro-operación actual, para ver el flujo de datos en tiempo real:
 *
 *   ámbar   (COLORES.ACTIVO) -> destino: registro o celda que se escribe
 *   celeste (COLORES.ORIGEN) -> origen: de dónde sale el dato
 *
 * También se ilumina la fase actual (BÚSQUEDA, DECODIF., EJECUCIÓN, ALMACEN.).
 * Antes de pintar se restauran los colores normales del paso anterior.
 */

const Resaltado = {

  cache_: {},

  /**
   * Se calculan al usarse (no al cargar el archivo) porque dependen de
   * constantes de otros archivos y Apps Script no garantiza el orden de carga.
   */
  nombresFase_() {
    const m = {};
    m[FASES.BUSQUEDA] = 'FASE_BUSQUEDA';
    m[FASES.DECODIFICACION] = 'FASE_DECODIF';
    m[FASES.EJECUCION] = 'FASE_EJECUCION';
    m[FASES.ALMACENAMIENTO] = 'FASE_ALMACEN';
    return m;
  },

  componentes_() {
    return LISTA_REGISTROS.concat(LISTA_BANDERAS, ['DECODIFICADO', 'ESTADO']);
  },

  /** Restaura los colores normales de registros, fases y RAM. */
  limpiar() {
    Resaltado.componentes_().forEach(c => Registros.rango_(c).setBackground(COLORES.REGISTRO));
    Object.keys(Resaltado.nombresFase_()).forEach(f => Resaltado.fase_(f).setBackground(COLORES.REGISTRO));
    VistaRam.pintarSegmentos();
  },

  /** Resalta los componentes de un evento de la Unidad de Control. */
  aplicar(evento) {
    Resaltado.limpiar();
    if (!evento || !evento.microop) return;
    const op = evento.microop;
    const pintar = (componente, color) => Resaltado.pintar_(componente, color, evento.bus);

    switch (op.tipo) {
      case 'bus':
        pintar(op.origen, COLORES.ORIGEN);
        pintar(op.destino, COLORES.ACTIVO);
        break;
      case 'incPC':
        pintar('PC', COLORES.ACTIVO);
        break;
      case 'decodificar':
        pintar('IR', COLORES.ORIGEN);
        pintar('DECODIFICADO', COLORES.ACTIVO);
        break;
      case 'alu':
        pintar('REN1', COLORES.ORIGEN);
        pintar('REN2', COLORES.ORIGEN);
        pintar('RESULTADO_ALU', COLORES.ACTIVO);
        LISTA_BANDERAS.forEach(b => pintar(b, COLORES.ACTIVO));
        break;
      case 'salto':
        pintar(op.bandera || 'MDR', COLORES.ORIGEN);
        if (evento.bus) { pintar('MDR', COLORES.ORIGEN); pintar('PC', COLORES.ACTIVO); }
        break;
      case 'detener':
        pintar('ESTADO', COLORES.ACTIVO);
        break;
    }
    if (Resaltado.nombresFase_()[evento.fase]) Resaltado.fase_(evento.fase).setBackground(COLORES.ACTIVO);
  },

  pintar_(componente, color, bus) {
    if (componente === 'RAM') {
      if (bus && bus.direccion !== null) UtilMemoria.celdaDe(bus.direccion).setBackground(color);
      return;
    }
    if (Resaltado.componentes_().indexOf(componente) !== -1) Registros.rango_(componente).setBackground(color);
  },

  fase_(fase) {
    if (!Resaltado.cache_[fase]) {
      Resaltado.cache_[fase] = SpreadsheetApp.getActive().getRangeByName(NOMBRES[Resaltado.nombresFase_()[fase]]);
    }
    return Resaltado.cache_[fase];
  },

  /** Color de fondo actual de un componente (para las pruebas). */
  colorDe(componente) {
    return Registros.rango_(componente).getBackground();
  }
};
