/**
 * Memoria.gs
 * Memoria principal (RAM) de 256 bytes. La matriz de la hoja RAM es la fuente
 * de verdad: cada lectura o escritura va a la celda que representa la dirección,
 * así que cualquier edición manual en la hoja la ve la CPU de inmediato.
 *
 * API pública:
 *   Memoria.leer(direccion)             -> número 0..255
 *   Memoria.escribir(direccion, valor)  -> escribe un byte
 *   Memoria.volcar()                    -> número[256] (lectura en bloque)
 *   Memoria.cargar(inicio, bytes)       -> escritura en bloque (la usa el cargador)
 *   Memoria.limpiar()                   -> deja las 256 celdas en 00
 *
 * Las funciones auxiliares (conversión hex/binario, posición en la matriz,
 * validaciones) viven en UtilMemoria. Ninguna usa `this`, para poder pasarlas
 * directamente a map/forEach (por ejemplo bytes.map(UtilMemoria.aHex)).
 */

const Memoria = {

  leer(direccion) {
    UtilMemoria.validarDireccion(direccion);
    const crudo = UtilMemoria.celdaDe(direccion).getDisplayValue();
    const valor = UtilMemoria.parsearByte(crudo);
    if (valor === null) {
      throw new Error('Byte inválido "' + crudo + '" en la dirección ' + UtilMemoria.aHex(direccion) + 'h');
    }
    return valor;
  },

  escribir(direccion, valor) {
    UtilMemoria.validarDireccion(direccion);
    UtilMemoria.validarByte(valor);
    UtilMemoria.celdaDe(direccion).setValue(UtilMemoria.aHex(valor));
  },

  volcar() {
    const valores = UtilMemoria.rangoMatriz().getDisplayValues();
    const bytes = [];
    for (let f = 0; f < MATRIZ_RAM.TAMANO; f++) {
      for (let c = 0; c < MATRIZ_RAM.TAMANO; c++) {
        const v = UtilMemoria.parsearByte(valores[f][c]);
        bytes.push(v === null ? 0 : v);
      }
    }
    return bytes;
  },

  cargar(inicio, bytes) {
    UtilMemoria.validarDireccion(inicio);
    if (inicio + bytes.length > MAPA_MEMORIA.TAMANO) {
      throw new Error('El programa no cabe en memoria: ' + bytes.length +
        ' bytes desde ' + UtilMemoria.aHex(inicio) + 'h');
    }
    bytes.forEach(b => UtilMemoria.validarByte(b));
    const actual = Memoria.volcar();
    bytes.forEach((b, i) => { actual[inicio + i] = b; });
    UtilMemoria.rangoMatriz().setValues(UtilMemoria.aMatriz(actual));
  },

  limpiar() {
    const ceros = new Array(MAPA_MEMORIA.TAMANO).fill(0);
    UtilMemoria.rangoMatriz().setValues(UtilMemoria.aMatriz(ceros));
  }
};

/**
 * Auxiliares sin efectos secundarios (salvo hoja/rangoMatriz/celdaDe, que solo
 * ubican rangos). Separados para poder probarlos por unidad.
 */
const UtilMemoria = {

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

  /** Acepta "1F", "1f", "1Fh", "0x1F", " 5 ". Devuelve 0..255 o null. Vacío = 0. */
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

  /** Dirección -> {fila, col} (base 1) dentro de la hoja RAM. */
  posicion(direccion) {
    return {
      fila: MATRIZ_RAM.PRIMERA_FILA + (direccion >> 4),
      col: MATRIZ_RAM.PRIMERA_COL + (direccion & 0x0F)
    };
  },

  /** {fila, col} -> dirección, o -1 si la celda queda fuera de la matriz. */
  direccionEn(fila, col) {
    const f = fila - MATRIZ_RAM.PRIMERA_FILA;
    const c = col - MATRIZ_RAM.PRIMERA_COL;
    if (f < 0 || f >= MATRIZ_RAM.TAMANO || c < 0 || c >= MATRIZ_RAM.TAMANO) return -1;
    return f * 16 + c;
  },

  segmentoDe(direccion) {
    return direccion <= MAPA_MEMORIA.CODIGO_FIN ? 'CODIGO' : 'DATOS';
  },

  /** número[256] -> texto[16][16] para setValues. */
  aMatriz(bytes) {
    const matriz = [];
    for (let f = 0; f < MATRIZ_RAM.TAMANO; f++) {
      const fila = [];
      for (let c = 0; c < MATRIZ_RAM.TAMANO; c++) fila.push(UtilMemoria.aHex(bytes[f * 16 + c]));
      matriz.push(fila);
    }
    return matriz;
  },

  hoja() {
    return SpreadsheetApp.getActive().getSheetByName(HOJAS.RAM);
  },

  rangoMatriz() {
    return UtilMemoria.hoja().getRange(MATRIZ_RAM.PRIMERA_FILA, MATRIZ_RAM.PRIMERA_COL, MATRIZ_RAM.TAMANO, MATRIZ_RAM.TAMANO);
  },

  celdaDe(direccion) {
    const p = UtilMemoria.posicion(direccion);
    return UtilMemoria.hoja().getRange(p.fila, p.col);
  }
};
