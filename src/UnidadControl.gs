/**
 * UnidadControl.gs
 * Unidad de Control: ejecuta el ciclo de instrucción una micro-operación a la vez.
 *
 *   BÚSQUEDA        MAR ← PC · MDR ← RAM[MAR] · IR ← MDR · PC ← PC + 1
 *   DECODIFICACIÓN  interpreta el IR y, si hace falta, busca el operando
 *   EJECUCIÓN       ALU, cálculo de direcciones o salto
 *   ALMACENAMIENTO  escribe el resultado en el registro o en RAM[MAR]
 *
 * Cada llamada a UnidadControl.paso() ejecuta UNA micro-operación y avanza
 * el reloj. Como Apps Script no guarda variables entre llamadas, la cola de
 * micro-operaciones pendientes se guarda en las propiedades del documento.
 *
 * API pública:
 *   paso()                  -> ejecuta una micro-operación y devuelve el evento
 *   ejecutarInstruccion()   -> termina la instrucción actual
 *   ejecutarHastaDetener()  -> corre hasta HLT (con límite de seguridad)
 *   reiniciar()             -> registros a cero y ciclo desde el principio
 *   suscribir(fn)           -> fn(evento) después de cada micro-operación
 */

const CLAVE_ESTADO_UC = 'UC_ESTADO';
const MAX_PASOS_EJECUCION = 5000;
const TAMANO_HISTORIAL = 10;

const UnidadControl = {

  oyentes_: [],

  paso() {
    const estado = UnidadControl.cargarEstado_();
    try {
      return UnidadControl.avanzar_(estado);
    } finally {
      UnidadControl.guardarEstado_(estado);
    }
  },

  ejecutarInstruccion() {
    const estado = UnidadControl.cargarEstado_();
    try {
      let evento;
      let pasos = 0;
      do {
        evento = UnidadControl.avanzar_(estado);
        pasos++;
      } while (!evento.finInstruccion && !evento.detenido && pasos < 50);
      return evento;
    } finally {
      UnidadControl.guardarEstado_(estado);
    }
  },

  ejecutarHastaDetener(maxPasos) {
    const limite = maxPasos || MAX_PASOS_EJECUCION;
    const estado = UnidadControl.cargarEstado_();
    try {
      let pasos = 0;
      let evento = { detenido: estado.detenido };
      while (!evento.detenido) {
        if (pasos >= limite) throw new Error('Se superaron ' + limite + ' micro-operaciones sin HLT (¿bucle infinito?)');
        evento = UnidadControl.avanzar_(estado);
        pasos++;
      }
      return pasos;
    } finally {
      UnidadControl.guardarEstado_(estado);
    }
  },

  /**
   * Ejecuta una micro-operación sobre el estado en memoria (sin leerlo ni
   * guardarlo): así ejecutar muchas seguidas no accede a las propiedades
   * del documento en cada paso.
   */
  avanzar_(estado) {
    if (estado.detenido) {
      return { detenido: true, finInstruccion: true, descripcion: 'CPU detenido. Usa "Reiniciar CPU".' };
    }
    if (estado.cola.length === 0) {
      estado.cola = MicroOperaciones.busqueda();
      estado.instrucciones++;
      estado.texto = '';
      estado.dirInstruccion = Registros.leer('PC');
    }

    const op = estado.cola.shift();
    estado.bus_ = null;
    let detalle;
    try {
      detalle = UnidadControl.ejecutarMicroop_(op, estado);
    } catch (e) {
      estado.detenido = true;
      estado.cola = [];
      Registros.escribirTexto('ESTADO', 'ERROR');
      throw e;
    }

    estado.paso++;
    const descripcion = MicroOperaciones.describir(op);
    Registros.escribirTexto('RELOJ', String(estado.paso));
    Registros.escribirTexto('FASE', op.fase);
    Registros.escribirTexto('MICROPASO', descripcion);
    if (!estado.detenido) Registros.escribirTexto('ESTADO', 'EJECUTANDO');

    estado.historial.unshift({ paso: estado.paso, fase: op.fase, descripcion: descripcion, detalle: detalle });
    if (estado.historial.length > TAMANO_HISTORIAL) estado.historial.length = TAMANO_HISTORIAL;

    const evento = {
      paso: estado.paso,
      numeroInstruccion: estado.instrucciones,
      direccionInstruccion: estado.dirInstruccion,
      fase: op.fase,
      microop: op,
      descripcion: descripcion,
      detalle: detalle,
      instruccion: estado.texto,
      bus: estado.bus_,
      historial: estado.historial.slice(),
      finInstruccion: estado.cola.length === 0,
      detenido: estado.detenido
    };
    estado.bus_ = null;
    UnidadControl.oyentes_.forEach(fn => fn(evento));
    return evento;
  },

  reiniciar() {
    Registros.reiniciar();
    UnidadControl.borrarEstado_();
  },

  estaDetenido() {
    return UnidadControl.cargarEstado_().detenido;
  },

  suscribir(fn) {
    UnidadControl.oyentes_.push(fn);
  },

  limpiarSuscriptores() {
    UnidadControl.oyentes_ = [];
  },

  // ── Ejecución de cada tipo de micro-operación ───────────────────

  ejecutarMicroop_(op, estado) {
    const hex = v => UtilMemoria.aHex(v) + 'h';

    switch (op.tipo) {
      case 'bus': {
        const evento = Bus.transferir(op.origen, op.destino, undefined, op.acceso);
        estado.bus_ = evento;
        if (op.operando) {
          estado.texto = ISA.formatear(ISA.porOpcode(estado.opcode), evento.valor);
          Registros.escribirTexto('DECODIFICADO', estado.texto);
        }
        return Bus.describir(evento);
      }

      case 'incPC': {
        const pc = (Registros.leer('PC') + 1) & 0xFF;
        Registros.escribir('PC', pc);
        return 'PC = ' + hex(pc);
      }

      case 'decodificar': {
        const ir = Registros.leer('IR');
        const entrada = ISA.porOpcode(ir);
        if (!entrada) {
          const dir = (Registros.leer('PC') - 1) & 0xFF;
          throw new Error('Opcode inválido ' + hex(ir) + ' en la dirección ' + hex(dir));
        }
        estado.opcode = ir;
        estado.texto = ISA.formatear(entrada);
        Registros.escribirTexto('DECODIFICADO', estado.texto);
        estado.cola = MicroOperaciones.planificar(entrada).concat(estado.cola);
        return 'IR = ' + hex(ir) + ' → ' + estado.texto + ' (' + entrada.bytes + ' byte' + (entrada.bytes > 1 ? 's' : '') + ')';
      }

      case 'alu': {
        const salida = ALU.ciclo(op.op);
        return 'resultado ' + hex(salida.resultado) + ' · ZF=' + salida.ZF + ' CF=' + salida.CF + ' SF=' + salida.SF;
      }

      case 'salto': {
        const banderas = Registros.leerBanderas();
        const cumple = !op.bandera || banderas[op.bandera] === op.valor;
        if (!cumple) return 'no salta (' + op.bandera + ' = ' + banderas[op.bandera] + ')';
        const evento = Bus.transferir('MDR', 'PC');
        estado.bus_ = evento;
        return 'salta a ' + hex(evento.valor);
      }

      case 'detener':
        estado.detenido = true;
        Registros.escribirTexto('ESTADO', 'DETENIDO');
        return 'CPU detenido por HLT';

      case 'nada':
        return op.texto;
    }
    throw new Error('Micro-operación desconocida: ' + op.tipo);
  },

  // ── Estado persistente entre llamadas ───────────────────────────

  cargarEstado_() {
    const texto = PropertiesService.getDocumentProperties().getProperty(CLAVE_ESTADO_UC);
    const vacio = { cola: [], detenido: false, paso: 0, instrucciones: 0, dirInstruccion: null, opcode: null, texto: '', historial: [] };
    if (!texto) return vacio;
    try { return Object.assign(vacio, JSON.parse(texto)); }
    catch (e) { return vacio; }
  },

  guardarEstado_(estado) {
    delete estado.bus_;
    PropertiesService.getDocumentProperties().setProperty(CLAVE_ESTADO_UC, JSON.stringify(estado));
  },

  borrarEstado_() {
    PropertiesService.getDocumentProperties().deleteProperty(CLAVE_ESTADO_UC);
  }
};
