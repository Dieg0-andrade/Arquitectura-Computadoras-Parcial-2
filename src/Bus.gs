/**
 * Bus.gs
 * Abstracción del bus del sistema. TODO movimiento de datos entre registros,
 * ALU y memoria pasa por Bus.transferir(), igual que en el diagrama de clase
 * (flechas 1..5 de la fase de búsqueda).
 *
 * Por ahora el bus solo mueve el valor y avisa a quien esté suscrito
 * (el log y el resaltado visual, que llegan en las tareas 20 y 21).
 * En el Parcial 2 se reemplaza el interior de este módulo por un bus
 * multiplexado (líneas de dirección, datos y control) sin tocar el CPU.
 *
 * Todo acceso a 'RAM' pasa por AccesoMemoria (contrato D-9): el bus nunca toca
 * la memoria directamente. Por eso transferir() recibe el tipo de acceso:
 *   'I' = búsqueda de instrucción u operando · 'D' = dato (LOAD / STORE)
 *   Si se omite, se asume 'D'.
 *
 * Orígenes y destinos válidos:
 *   - cualquier registro de LISTA_REGISTROS ('PC', 'MAR', 'MDR', 'AX', ...)
 *   - 'RAM': la celda apuntada por MAR
 *       Bus.transferir('RAM', 'MDR')  ->  MDR ← RAM[MAR]   (lectura)
 *       Bus.transferir('MDR', 'RAM')  ->  RAM[MAR] ← MDR   (escritura)
 *   - 'INM': un valor constante que se pasa como tercer argumento
 *       Bus.transferir('INM', 'REN2', 1)  ->  REN2 ← 01h
 */

const Bus = {

  oyentes_: [],

  /**
   * Mueve un byte de origen a destino. Devuelve un objeto con el detalle
   * de la transferencia: {origen, destino, valor, direccion, acceso}.
   * `acceso` ('I' | 'D') solo se usa cuando origen o destino es 'RAM'.
   */
  transferir(origen, destino, inmediato, acceso) {
    if (origen === destino) throw new Error('Origen y destino iguales: ' + origen);
    if (destino === 'INM') throw new Error('INM no puede ser destino');

    let direccion = null;
    const usaRam = origen === 'RAM' || destino === 'RAM';
    if (usaRam) direccion = Registros.leer('MAR');
    const tipoAcceso = usaRam ? (acceso || 'D') : null;

    const valor = Bus.leerDe_(origen, direccion, inmediato, tipoAcceso);
    Bus.escribirEn_(destino, valor, direccion);

    const evento = { origen: origen, destino: destino, valor: valor, direccion: direccion, acceso: tipoAcceso };
    Registros.escribirTexto('BUS_ULTIMO', Bus.describir(evento));
    Bus.oyentes_.forEach(fn => fn(evento));
    return evento;
  },

  /** Texto legible: "PC → MAR (06h)" o "RAM[06h] → MDR (23h)". */
  describir(evento) {
    const hex = v => UtilMemoria.aHex(v) + 'h';
    const nombre = n => n === 'RAM' ? 'RAM[' + hex(evento.direccion) + ']' : n;
    return nombre(evento.origen) + ' → ' + nombre(evento.destino) + ' (' + hex(evento.valor) + ')';
  },

  /** Registra una función que se llama después de cada transferencia. */
  suscribir(fn) {
    Bus.oyentes_.push(fn);
  },

  limpiarSuscriptores() {
    Bus.oyentes_ = [];
  },

  // ── Internos ────────────────────────────────────────────────────

  leerDe_(origen, direccion, inmediato, tipoAcceso) {
    if (origen === 'INM') {
      UtilMemoria.validarByte(inmediato);
      return inmediato;
    }
    if (origen === 'RAM') return AccesoMemoria.leer(direccion, tipoAcceso).valor;
    if (Registros.esRegistro(origen)) return Registros.leer(origen);
    throw new Error('Origen de bus desconocido: ' + origen);
  },

  escribirEn_(destino, valor, direccion) {
    if (destino === 'RAM') return AccesoMemoria.escribir(direccion, valor);
    if (Registros.esRegistro(destino)) return Registros.escribir(destino, valor);
    throw new Error('Destino de bus desconocido: ' + destino);
  }
};
