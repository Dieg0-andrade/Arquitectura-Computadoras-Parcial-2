/**
 * Bus.gs
 * Buses del sistema con buffers tri-estado (tarea 1-5).
 *
 * ┌──────────────────── CPU ────────────────────┐
 * │  PC  IR  MAR  AX BX CX DX  REN1 REN2  ALU   │
 * │  ════════════ BUS DE DATOS INTERNO ═════════ │
 * │                    MDR (puente)              │
 * └─────────┬───────────┬─────────────┬─────────┘
 *    BUS DE DATOS      BUS DE         BUS DE CONTROL
 *    EXTERNO           DIRECCIONES    (Read, Write, IO, Clock)
 *    MDR ↔ RAM/KBD/LCD MAR → MMU/RAM  UC → memoria y E/S
 *
 * Reglas:
 *   - Un componente pone su valor en el bus solo si su buffer tri-estado
 *     CONDUCE (señal En_* = 1). Si no, queda en HIGH-Z (desconectado).
 *   - Como máximo un emisor por micro-paso (D-8). Dos emisores = error.
 *   - El MDR es el único registro conectado a los dos segmentos del bus de
 *     datos: RAM, teclado y LCD hablan con el CPU solo a través del MDR.
 *   - El MAR maneja el bus de direcciones cuando hay Read o Write.
 *
 * Bus.estadoBuffers(palabra) y Bus.estadoBuses(palabra) calculan, a partir
 * de la micro-palabra, qué buffers conducen y qué hace cada bus en el paso.
 *
 * Bus.transferir(origen, destino, inmediato, acceso) sigue moviendo los datos
 * como en el Parcial 1, y ahora además calcula la micro-palabra y el estado de
 * los buffers de cada transferencia (evento.palabra, evento.buses).
 * Todo acceso a 'RAM' pasa por AccesoMemoria (contrato D-9).
 *
 * Orígenes y destinos válidos de transferir():
 *   - cualquier registro de LISTA_REGISTROS ('PC', 'MAR', 'MDR', 'AX', ...)
 *   - 'RAM': la celda apuntada por MAR
 *       Bus.transferir('RAM', 'MDR')  ->  MDR ← RAM[MAR]   (lectura)
 *       Bus.transferir('MDR', 'RAM')  ->  RAM[MAR] ← MDR   (escritura)
 *   - 'INM': un valor constante que se pasa como tercer argumento
 *       Bus.transferir('INM', 'REN2', 1)  ->  REN2 ← 01h
 */

/** Estados posibles de un buffer tri-estado. */
const CONDUCE = 'CONDUCE';
const HIGH_Z = 'HIGH-Z';

/** Segmentos del bus de datos. */
const SEGMENTO_INTERNO = 'INTERNO';
const SEGMENTO_EXTERNO = 'EXTERNO';

/**
 * Componentes con buffer tri-estado de salida, en el orden en que se muestran.
 * MAR no está en el bus de datos: su buffer maneja el bus de direcciones.
 */
const BUFFERS_BUS = ['PC', 'IR', 'MDR', 'AX', 'BX', 'CX', 'DX', 'ALU', 'RAM', 'KBD', 'MAR'];

/** A qué segmento del bus de datos está conectado cada componente (MDR: a los dos). */
const CONEXIONES_BUS = {
  PC: SEGMENTO_INTERNO, IR: SEGMENTO_INTERNO, MAR: SEGMENTO_INTERNO,
  AX: SEGMENTO_INTERNO, BX: SEGMENTO_INTERNO, CX: SEGMENTO_INTERNO, DX: SEGMENTO_INTERNO,
  REN1: SEGMENTO_INTERNO, REN2: SEGMENTO_INTERNO, ALU: SEGMENTO_INTERNO,
  MDR: 'AMBOS',
  RAM: SEGMENTO_EXTERNO, KBD: SEGMENTO_EXTERNO, LCD: SEGMENTO_EXTERNO
};

const Bus = {

  oyentes_: [],

  // ── Buffers tri-estado ──────────────────────────────────────────

  /**
   * Estado de cada buffer en el micro-paso descrito por la palabra:
   *   { PC: 'HIGH-Z', MDR: 'CONDUCE', ..., MAR: 'CONDUCE' }
   * Lanza error si la palabra tiene 2 emisores o una conexión imposible.
   */
  estadoBuffers(palabra) {
    return Bus.estadoBuses(palabra).buffers;
  },

  /**
   * Estado completo de los buses en un micro-paso:
   * {
   *   buffers:      { componente: 'CONDUCE' | 'HIGH-Z' },
   *   emisor:       'MDR' | null,            componente que conduce al bus de datos
   *   receptores:   ['IR'],                  componentes que cargan (Ld_*) del bus
   *   datosInterno: { activo, emisor, receptores },
   *   datosExterno: { activo, emisor, receptores },
   *   direcciones:  { activo, origen: 'MAR'|null, destino: 'MEMORIA'|'E/S'|null },
   *   control:      { Read, Write, IO, Clock }
   * }
   */
  estadoBuses(palabra) {
    MicroPalabra.validar(palabra);
    const s = palabra.senales;
    const lectura = s.Mem_R === 1, escritura = s.Mem_W === 1, io = s.IO === 1;

    // Emisor del bus de datos (como mucho uno: ya lo garantizó validar).
    const senalEmisor = MicroPalabra.validarUnSoloEmisor(palabra);
    const emisor = senalEmisor ? senalEmisor.slice(3) : null;

    // Coherencia de las líneas de control con quien emite.
    if (emisor === 'RAM' && (!lectura || io)) throw new Error('En_RAM necesita Mem_R = 1 e IO = 0 (la RAM solo conduce en una lectura de memoria)');
    if (emisor === 'KBD' && (!lectura || !io)) throw new Error('En_KBD necesita Mem_R = 1 e IO = 1 (lectura del teclado)');
    if (lectura && emisor !== 'RAM' && emisor !== 'KBD') throw new Error('Mem_R activa pero ni la RAM ni el teclado conducen al bus (falta En_RAM o En_KBD)');
    if (s.Ld_LCD && (!escritura || !io)) throw new Error('Ld_LCD necesita Mem_W = 1 e IO = 1 (escritura en el LCD)');
    if (escritura && emisor !== 'MDR') throw new Error('Mem_W activa: solo el MDR puede conducir hacia la memoria o la E/S (falta En_MDR)');

    // Segmento por el que viaja el dato.
    let segmento = null;
    if (emisor === 'RAM' || emisor === 'KBD') segmento = SEGMENTO_EXTERNO;
    else if (emisor === 'MDR' && escritura) segmento = SEGMENTO_EXTERNO;
    else if (emisor) segmento = SEGMENTO_INTERNO;

    // Receptores (Ld_*) y el segmento en el que están.
    const receptores = [];
    const agregar = (nombre, seg) => {
      if (!segmento) throw new Error(nombre + ' intenta cargar del bus, pero ningún buffer conduce (bus en HIGH-Z)');
      if (seg !== segmento) {
        throw new Error(nombre + ' está en el bus de datos ' + seg.toLowerCase() + ' y el emisor ' + emisor +
          ' en el ' + segmento.toLowerCase() + ': el dato debe pasar por el MDR');
      }
      receptores.push(nombre);
    };
    ['PC', 'IR', 'MAR', 'REN1', 'REN2', 'AX', 'BX', 'CX', 'DX'].forEach(r => {
      if (s['Ld_' + r]) agregar(r, SEGMENTO_INTERNO);
    });
    if (s.Ld_MDR) agregar('MDR', lectura ? SEGMENTO_EXTERNO : SEGMENTO_INTERNO);
    if (escritura && !io) agregar('RAM', SEGMENTO_EXTERNO);
    if (s.Ld_LCD) agregar('LCD', SEGMENTO_EXTERNO);
    if (escritura && io && !s.Ld_LCD) throw new Error('Escritura de E/S (IO = 1, Mem_W = 1) sin dispositivo destino (falta Ld_LCD)');
    if (emisor && receptores.length === 0) throw new Error(emisor + ' conduce al bus pero nadie carga el dato (falta un Ld_*)');

    // Buffers: conduce el emisor; el MAR conduce al bus de direcciones si hay Read o Write.
    const buffers = {};
    BUFFERS_BUS.forEach(c => { buffers[c] = HIGH_Z; });
    if (emisor) buffers[emisor] = CONDUCE;
    const usaDirecciones = lectura || escritura;
    if (usaDirecciones) buffers.MAR = CONDUCE;

    const bus = seg => ({
      activo: segmento === seg,
      emisor: segmento === seg ? emisor : null,
      receptores: segmento === seg ? receptores.slice() : []
    });

    return {
      buffers: buffers,
      emisor: emisor,
      receptores: receptores,
      segmento: segmento,
      datosInterno: bus(SEGMENTO_INTERNO),
      datosExterno: bus(SEGMENTO_EXTERNO),
      direcciones: {
        activo: usaDirecciones,
        origen: usaDirecciones ? 'MAR' : null,
        destino: usaDirecciones ? (io ? 'E/S' : 'MEMORIA') : null
      },
      control: { Read: s.Mem_R, Write: s.Mem_W, IO: s.IO, Clock: 1 }
    };
  },

  /** Texto para el log: "Bus interno: MDR → IR · conducen: MDR · resto HIGH-Z". */
  describirBuses(estado) {
    const partes = [];
    if (!estado.emisor) partes.push('Bus de datos en HIGH-Z');
    else partes.push('Bus ' + estado.segmento.toLowerCase() + ': ' + estado.emisor + ' → ' + estado.receptores.join(', '));
    if (estado.direcciones.activo) partes.push('Direcciones: MAR → ' + estado.direcciones.destino);
    const conducen = BUFFERS_BUS.filter(c => estado.buffers[c] === CONDUCE);
    partes.push('Conducen: ' + (conducen.length ? conducen.join(', ') : 'ninguno') + ' · resto HIGH-Z');
    return partes.join(' · ');
  },

  // ── Transferencias (Parcial 1, sin cambios de firma) ─────────────

  /**
   * Mueve un byte de origen a destino. Devuelve un objeto con el detalle
   * de la transferencia: {origen, destino, valor, direccion, acceso, palabra, buses}.
   * `acceso` ('I' | 'D') solo se usa cuando origen o destino es 'RAM'.
   * `palabra` y `buses` son null para 'INM' (constante que pone la UC, sin buffer).
   */
  transferir(origen, destino, inmediato, acceso) {
    if (origen === 'KBD' && destino !== 'MDR') {
      throw new Error('El teclado solo entrega datos al MDR');
    }
    if (origen === destino) throw new Error('Origen y destino iguales: ' + origen);
    if (destino === 'INM') throw new Error('INM no puede ser destino');

    // Micro-palabra y buffers del paso: si la conexión es imposible, falla antes de mover nada.
    let palabra = null, buses = null;
    if (origen !== 'INM' && Bus.tieneConexion_(origen) && Bus.tieneConexion_(destino)) {
      palabra = MicroPalabra.paraMicroOperacion({ tipo: 'bus', origen: origen, destino: destino });
      buses = Bus.estadoBuses(palabra);
    }

    let direccion = null;
    const usaRam = origen === 'RAM' || destino === 'RAM';
    if (usaRam) direccion = Registros.leer('MAR');
    const tipoAcceso = usaRam ? (acceso || 'D') : null;

    const valor = Bus.leerDe_(origen, direccion, inmediato, tipoAcceso);
    Bus.escribirEn_(destino, valor, direccion);

    const evento = {
      origen: origen, destino: destino, valor: valor, direccion: direccion, acceso: tipoAcceso,
      palabra: palabra, buses: buses
    };
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

  /** true si el nombre es un componente conectado al bus ('RESULTADO_ALU' cuenta como ALU). */
  tieneConexion_(nombre) {
    return nombre === 'RESULTADO_ALU' || nombre in CONEXIONES_BUS;
  },

  leerDe_(origen, direccion, inmediato, tipoAcceso) {
    if (origen === 'INM') {
      UtilMemoria.validarByte(inmediato);
      return inmediato;
    }
    if (origen === 'KBD') return Perifericos.teclado.desencolar();
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
