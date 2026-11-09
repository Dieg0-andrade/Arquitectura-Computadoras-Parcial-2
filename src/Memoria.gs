/**
 * RAM física de 256 bytes y acceso a las celdas de la hoja RAM.
 */
const Memoria = {
  leer(direccion) {
    UtilMemoria.validarDireccion(direccion);
    const crudo = UtilMemoria.copiaRam_()[direccion];
    const valor = UtilMemoria.parsearByte(crudo);

    if (valor === null) {
      throw new Error(
        'Byte inválido "' + crudo + '" en la dirección ' + UtilMemoria.aHex(direccion) + 'h'
      );
    }
    return valor;
  },

  escribir(direccion, valor) {
    Memoria.escribirFisica_(direccion, valor);
    // Una escritura directa puede dejar copias antiguas en caché.
    Cache.invalidarPagina(direccion >> 5);
  },

  escribirFisica_(direccion, valor) {
    UtilMemoria.validarDireccion(direccion);
    UtilMemoria.validarByte(valor);
    UtilMemoria.celdaDe(direccion).setValue(UtilMemoria.aHex(valor));
    if (UtilMemoria.ram_) UtilMemoria.ram_[direccion] = UtilMemoria.aHex(valor);
    const lcd = Perifericos.lcd;
    if (direccion >= lcd.BASE) lcd.mostrar_(direccion - lcd.BASE, [valor]);
  },

  volcar() {
    return UtilMemoria.copiaRam_().map(texto => {
      const v = UtilMemoria.parsearByte(texto);
      return v === null ? 0 : v;
    });
  },

  cargar(inicio, bytes) {
    UtilMemoria.validarDireccion(inicio);

    if (inicio + bytes.length > MAPA_MEMORIA.TAMANO) {
      throw new Error(
        'El programa no cabe en memoria: ' + bytes.length +
        ' bytes desde ' + UtilMemoria.aHex(inicio) + 'h'
      );
    }

    bytes.forEach(b => UtilMemoria.validarByte(b));
    const actual = Memoria.volcar();
    bytes.forEach((b, i) => { actual[inicio + i] = b; });
    UtilMemoria.rangoMatriz().setValues(UtilMemoria.aMatriz(actual));
    UtilMemoria.ram_ = actual.map(UtilMemoria.aHex);
    const lcd = Perifericos.lcd;
    const desde = Math.max(inicio, lcd.BASE);
    const fin = inicio + bytes.length;
    if (desde < fin) lcd.mostrar_(desde - lcd.BASE, actual.slice(desde, fin));
    Cache.invalidarTodo();
  },

  limpiar() {
    const ceros = new Array(MAPA_MEMORIA.TAMANO).fill(0);
    UtilMemoria.rangoMatriz().setValues(UtilMemoria.aMatriz(ceros));
    UtilMemoria.ram_ = ceros.map(UtilMemoria.aHex);
    Perifericos.lcd.mostrar_(0, ceros.slice(Perifericos.lcd.BASE));
    Cache.invalidarTodo();
  }
};

const UtilMemoria = {
  /**
   * Copia en memoria del texto de las 256 celdas de la RAM (tarea 1-10): la
   * matriz se lee de la hoja una vez y cada escritura actualiza la hoja y la
   * copia. rangoMatriz() la olvida, porque quien pide la matriz puede
   * escribirla directamente, y Simulacion la olvida al empezar cada acción
   * para ver los valores editados a mano en la hoja RAM.
   */
  ram_: null,

  copiaRam_() {
    if (!UtilMemoria.ram_) {
      const valores = UtilMemoria.rangoMatriz().getDisplayValues();
      const textos = [];
      valores.forEach(fila => fila.forEach(v => textos.push(v)));
      UtilMemoria.ram_ = textos;
    }
    return UtilMemoria.ram_;
  },

  olvidar() {
    UtilMemoria.ram_ = null;
  },

  validarDireccion(direccion) {
    if (!Number.isInteger(direccion) || direccion < 0 || direccion >= MAPA_MEMORIA.TAMANO) {
      throw new Error('Dirección fuera de rango: ' + direccion + ' (válido 00h–FFh)');
    }
  },

  validarByte(valor) {
    if (!Number.isInteger(valor) || valor < 0 || valor > MAPA_MEMORIA.BYTE_MAX) {
      throw new Error('Valor fuera de rango: ' + valor + ' (válido 00h–FFh)');
    }
  },

  parsearByte(texto) {
    if (texto === null || texto === undefined) return null;
    let s = String(texto).trim().toUpperCase();
    if (s === '') return 0;
    if (s.indexOf('0X') === 0) s = s.slice(2);
    if (s.charAt(s.length - 1) === 'H') s = s.slice(0, -1);
    if (!/^[0-9A-F]{1,2}$/.test(s)) return null;
    return parseInt(s, 16);
  },

  aHex(valor) {
    return ('0' + valor.toString(16).toUpperCase()).slice(-2);
  },

  aBin(valor) {
    return ('00000000' + valor.toString(2)).slice(-8);
  },

  posicion(direccion) {
    return {
      fila: MATRIZ_RAM.PRIMERA_FILA + (direccion >> 4),
      col: MATRIZ_RAM.PRIMERA_COL + (direccion & 0x0F)
    };
  },

  direccionEn(fila, col) {
    const f = fila - MATRIZ_RAM.PRIMERA_FILA;
    const c = col - MATRIZ_RAM.PRIMERA_COL;
    if (f < 0 || f >= MATRIZ_RAM.TAMANO || c < 0 || c >= MATRIZ_RAM.TAMANO) {
      return -1;
    }
    return f * 16 + c;
  },

  segmentoDe(direccion) {
    return direccion <= MAPA_MEMORIA.CODIGO_FIN ? 'CODIGO' : 'DATOS';
  },

  aMatriz(bytes) {
    const matriz = [];
    for (let f = 0; f < MATRIZ_RAM.TAMANO; f++) {
      const fila = [];
      for (let c = 0; c < MATRIZ_RAM.TAMANO; c++) {
        fila.push(UtilMemoria.aHex(bytes[f * 16 + c]));
      }
      matriz.push(fila);
    }
    return matriz;
  },

  hoja() {
    return SpreadsheetApp.getActive().getSheetByName(HOJAS.RAM);
  },

  rangoMatriz() {
    UtilMemoria.ram_ = null;
    return UtilMemoria.hoja().getRange(
      MATRIZ_RAM.PRIMERA_FILA, MATRIZ_RAM.PRIMERA_COL,
      MATRIZ_RAM.TAMANO, MATRIZ_RAM.TAMANO
    );
  },

  celdaDe(direccion) {
    const p = UtilMemoria.posicion(direccion);
    return UtilMemoria.hoja().getRange(p.fila, p.col);
  }
};