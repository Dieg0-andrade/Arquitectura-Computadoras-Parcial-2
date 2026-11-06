/**
 * Tarea 17: visualización del último acceso de caché de la CPU.
 *
 * Al comenzar cada ejecución se guardan los contadores iniciales.
 * Después de cada micro-operación se comparan con los actuales.
 * El mismo texto se usa en Cache_IO y en la fila del Log.
 */
const VistaCacheActividad = {
  HIT: '#C8E6C9',
  MISS: '#FFCDD2',
  NEUTRO: '#ECEFF1',

  anteriores_: null,

  iniciar() {
    VistaCacheActividad.anteriores_ = Cache.contadores();
  },

  finalizar() {
    VistaCacheActividad.anteriores_ = null;
  },

  registrar(evento) {
    const bus = evento.bus;

    if (!bus || (bus.origen !== 'RAM' && bus.destino !== 'RAM')) {
      return '';
    }

    const estado = Cache.cargarEstado_();
    const actuales = estado.estadisticas;
    const anteriores = VistaCacheActividad.anteriores_;
    VistaCacheActividad.anteriores_ = actuales;

    if (!anteriores) return '';

    const escritura = bus.destino === 'RAM';
    const nivel = escritura || bus.acceso !== 'I' ? 'L1D' : 'L1I';

    const hitL1 = actuales[nivel].h > anteriores[nivel].h;
    const missL1 = actuales[nivel].m > anteriores[nivel].m;

    // Un acceso de E/S evita la caché y no cambia sus contadores.
    if (!hitL1 && !missL1) return '';

    const hitL2 = actuales.L2.h > anteriores.L2.h;
    const missL2 = actuales.L2.m > anteriores.L2.m;
    const lineaL1 = estado[nivel];

    // Tras un acceso normal, L1 contiene la línea usada.
    if (!lineaL1) return '';

    const offset = bus.direccion & 7;
    const dirFisica = lineaL1.base + offset;
    const indiceL2 = Math.floor(dirFisica / Cache.TAM_LINEA) % Cache.LINEAS_L2;
    const hex = valor => UtilMemoria.aHex(valor) + 'h';

    const partes = [
      (escritura ? 'Escritura' : 'Lectura') + ' física ' + hex(dirFisica),
      nivel + (hitL1 ? ' HIT' : ' MISS')
    ];

    if (missL1) {
      partes.push('Línea ' + nivel + ' cargada ' +
        hex(lineaL1.base) + '–' + hex(lineaL1.base + 7));
    }

    if (hitL2) partes.push('L2 HIT');

    if (missL2) {
      const baseBloque = dirFisica - (dirFisica % Cache.TAM_PAGINA);
      partes.push('L2 MISS');
      partes.push('RAM → L2 ' + hex(baseBloque) + '–' + hex(baseBloque + 31));
    }

    if (escritura) partes.push('write-through a RAM');

    const texto = partes.join(' | ');
    VistaCacheActividad.pintar_(estado, nivel, hitL1, hitL2, missL2, indiceL2, texto);
    return texto;
  },

  pintar_(estado, nivel, hitL1, hitL2, missL2, indiceL2, texto) {
    const hoja = SpreadsheetApp.getActive().getSheetByName(HOJAS.CACHE_IO);
    if (!hoja) return;

    const vista = VistaCacheActividad;

    vista.pintarLinea_(
      hoja.getRange('B6:I6'),
      estado.L1I,
      nivel === 'L1I' ? (hitL1 ? vista.HIT : vista.MISS) : vista.NEUTRO
    );

    vista.pintarLinea_(
      hoja.getRange('K6:R6'),
      estado.L1D,
      nivel === 'L1D' ? (hitL1 ? vista.HIT : vista.MISS) : vista.NEUTRO
    );

    for (let i = 0; i < Cache.LINEAS_L2; i++) {
      let color = vista.NEUTRO;

      // Un miss en L2 carga las cuatro filas del bloque de 32 bytes.
      if (missL2) color = vista.MISS;
      else if (hitL2 && i === indiceL2) color = vista.HIT;

      vista.pintarLinea_(
        hoja.getRange(12 + i * 2, 5, 1, 8),
        estado.L2[i],
        color
      );
    }

    hoja.getRange('B36').setValue(texto);
  },

  pintarLinea_(rango, linea, color) {
    const valores = linea
      ? linea.bytes.map(UtilMemoria.aHex)
      : Array(8).fill('—');

    rango.setValues([valores]).setBackground(color);
  },

  limpiar() {
    const hoja = SpreadsheetApp.getActive().getSheetByName(HOJAS.CACHE_IO);
    if (!hoja) return;

    // Reiniciar la CPU limpia el último resaltado. Las líneas que sigan
    // residentes en el motor conservan su contenido en el panel.
    const estado = Cache.cargarEstado_();
    const vista = VistaCacheActividad;

    vista.pintarLinea_(hoja.getRange('B6:I6'), estado.L1I, vista.NEUTRO);
    vista.pintarLinea_(hoja.getRange('K6:R6'), estado.L1D, vista.NEUTRO);

    for (let i = 0; i < Cache.LINEAS_L2; i++) {
      vista.pintarLinea_(
        hoja.getRange(12 + i * 2, 5, 1, 8),
        estado.L2[i],
        vista.NEUTRO
      );
    }

    hoja.getRange('B36').setValue('Esperando el siguiente acceso de la CPU');
  }
};
// Punto común de Paso, Ejecutar instrucción y Ejecutar hasta HLT.
// Se captura la base antes de que la CPU ejecute el primer acceso.
const ejecutarConLogOriginal_ = Simulacion.ejecutar_;

Simulacion.ejecutar_ = function (accion) {
  VistaCacheActividad.iniciar();
  try {
    return ejecutarConLogOriginal_(accion);
  } finally {
    VistaCacheActividad.finalizar();
  }
};