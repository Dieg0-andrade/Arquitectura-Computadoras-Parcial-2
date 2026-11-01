/**
 * Registros.gs
 * Banco de registros del CPU. Cada registro vive en una celda con nombre de la
 * hoja CPU (ver NOMBRES en Libro.gs), así su valor siempre está visible y se
 * puede editar a mano durante la demostración.
 *
 * Registros de 8 bits (se guardan como hex de 2 dígitos):
 *   PC, IR, MAR, MDR, AX, BX, REN1, REN2, RESULTADO_ALU
 * Banderas de 1 bit (R. Estado):
 *   ZF (cero), CF (acarreo/préstamo), SF (signo = bit 7)
 * Campos de texto de la Unidad de Control:
 *   OP_ALU, DECODIFICADO, ESTADO, FASE, MICROPASO, RELOJ, BUS_ULTIMO
 *
 * API pública:
 *   Registros.leer('PC')                     -> número 0..255
 *   Registros.escribir('PC', 0x06)           -> escribe el registro
 *   Registros.leerBanderas()                 -> {ZF, CF, SF}
 *   Registros.escribirBanderas({ZF: 1, ...}) -> actualiza solo las banderas indicadas
 *   Registros.leerTexto / escribirTexto      -> campos de texto
 *   Registros.instantanea()                  -> copia de todos los registros y banderas
 *   Registros.reiniciar()                    -> todo a cero y estado LISTO
 */

const LISTA_REGISTROS = ['PC', 'IR', 'MAR', 'MDR', 'AX', 'BX', 'REN1', 'REN2', 'RESULTADO_ALU'];
const LISTA_BANDERAS = ['ZF', 'CF', 'SF'];
const CAMPOS_TEXTO = ['OP_ALU', 'DECODIFICADO', 'ESTADO', 'FASE', 'MICROPASO', 'RELOJ', 'BUS_ULTIMO'];

const Registros = {

  leer(nombre) {
    Registros.validarRegistro_(nombre);
    const crudo = Registros.rango_(nombre).getDisplayValue();
    const valor = UtilMemoria.parsearByte(crudo);
    if (valor === null) throw new Error('Valor inválido "' + crudo + '" en el registro ' + nombre);
    return valor;
  },

  escribir(nombre, valor) {
    Registros.validarRegistro_(nombre);
    UtilMemoria.validarByte(valor);
    Registros.rango_(nombre).setValue(UtilMemoria.aHex(valor));
  },

  leerBanderas() {
    const banderas = {};
    LISTA_BANDERAS.forEach(f => { banderas[f] = Registros.rango_(f).getDisplayValue() === '1' ? 1 : 0; });
    return banderas;
  },

  escribirBanderas(banderas) {
    Object.keys(banderas).forEach(f => {
      if (LISTA_BANDERAS.indexOf(f) === -1) throw new Error('Bandera desconocida: ' + f);
      Registros.rango_(f).setValue(banderas[f] ? '1' : '0');
    });
  },

  leerTexto(campo) {
    Registros.validarTexto_(campo);
    return Registros.rango_(campo).getDisplayValue();
  },

  escribirTexto(campo, texto) {
    Registros.validarTexto_(campo);
    Registros.rango_(campo).setValue(String(texto));
  },

  instantanea() {
    const copia = {};
    LISTA_REGISTROS.forEach(r => { copia[r] = Registros.leer(r); });
    Object.assign(copia, Registros.leerBanderas());
    return copia;
  },

  reiniciar() {
    LISTA_REGISTROS.forEach(r => Registros.escribir(r, 0));
    Registros.escribirBanderas({ ZF: 0, CF: 0, SF: 0 });
    Registros.escribirTexto('OP_ALU', '—');
    Registros.escribirTexto('DECODIFICADO', '—');
    Registros.escribirTexto('ESTADO', 'LISTO');
    Registros.escribirTexto('FASE', '—');
    Registros.escribirTexto('MICROPASO', '—');
    Registros.escribirTexto('RELOJ', '0');
    Registros.escribirTexto('BUS_ULTIMO', '—');
  },

  esRegistro(nombre) {
    return LISTA_REGISTROS.indexOf(nombre) !== -1;
  },

  // ── Internos ────────────────────────────────────────────────────

  /** Guarda cada rango ya buscado: getRangeByName es lento si se llama en cada paso. */
  cache_: {},

  rango_(nombre) {
    if (Registros.cache_[nombre]) return Registros.cache_[nombre];
    const nombreRango = NOMBRES[nombre];
    const rango = nombreRango && SpreadsheetApp.getActive().getRangeByName(nombreRango);
    if (!rango) throw new Error('No existe el rango con nombre de ' + nombre + '. Ejecuta "Preparar libro".');
    Registros.cache_[nombre] = rango;
    return rango;
  },

  validarRegistro_(nombre) {
    if (!Registros.esRegistro(nombre)) throw new Error('Registro desconocido: ' + nombre);
  },

  validarTexto_(campo) {
    if (CAMPOS_TEXTO.indexOf(campo) === -1) throw new Error('Campo desconocido: ' + campo);
  }
};
