/**
 * Simulacion.gs
 * Punto de entrada de la simulación para el menú y el panel lateral.
 * Conecta la Unidad de Control con el log y con el resaltado visual:
 *
 *   Simulacion.paso()          una micro-operación
 *   Simulacion.instruccion()   termina la instrucción actual
 *   Simulacion.hastaDetener()  corre hasta HLT
 *   Simulacion.reiniciar()     CPU, log y colores desde cero
 *   Simulacion.cargar()        ensambla la hoja Código (col. E) y carga la RAM
 *   Simulacion.compilar()      compila el alto nivel (col. B), genera el ensamblador y lo carga
 *
 * Todas devuelven un resumen simple (se puede enviar al panel HTML).
 */

const Simulacion = {

  paso() {
    return Simulacion.ejecutar_(() => UnidadControl.paso());
  },

  instruccion() {
    return Simulacion.ejecutar_(() => UnidadControl.ejecutarInstruccion());
  },

  hastaDetener() {
    return Simulacion.ejecutar_(() => UnidadControl.ejecutarHastaDetener());
  },

  reiniciar() {
    Simulacion.olvidarCopias_();
    UnidadControl.reiniciar();
    LogMicroops.limpiar();
    Resaltado.limpiar();
    Traza.limpiar();
    VistaBuses.limpiar();
    return Simulacion.resumen_(null);
  },

  cargar() {
    return Simulacion.cargar_(null);
  },

  /**
   * Compila el programa de alto nivel de la columna B, escribe el ensamblador
   * generado en la columna E (con comentarios que indican de qué línea viene)
   * y lo ensambla y carga como cualquier otro programa.
   */
  compilar() {
    const fuente = Compilador.leerFuente();
    const comp = Compilador.compilar(fuente);
    VistaCompilador.marcarErroresAlto(comp.errores);
    if (!comp.ok) {
      VistaCompilador.mostrarEtapasAlto(comp, []);
      return {
        ok: false,
        errores: comp.errores.map(e => e.mensaje),
        mensaje: 'El programa de alto nivel tiene errores'
      };
    }
    const lineasAsm = Simulacion.ensambladorComentado_(comp, fuente);
    const hoja = SpreadsheetApp.getActive().getSheetByName(HOJAS.CODIGO);
    hoja.getRange(4, 5, 100, 1).clearContent();
    hoja.getRange(4, 5, lineasAsm.length, 1).setValues(lineasAsm.map(l => [l]));

    const mapaAlto = {};
    comp.ensamblador.forEach((l, i) => { if (l.lineaAlto) mapaAlto[i + 1] = l.lineaAlto; });
    const r = Simulacion.cargar_(mapaAlto);
    VistaCompilador.mostrarEtapasAlto(comp, lineasAsm);
    if (r.ok) r.mensaje = 'Compilado a ' + lineasAsm.length + ' líneas de ensamblador. ' + r.mensaje;
    return r;
  },

  /** Agrega "; Ln: sentencia" a la primera instrucción generada por cada línea de alto nivel. */
  ensambladorComentado_(comp, fuente) {
    const vistas = {};
    let enCodigo = false;
    return comp.ensamblador.map(l => {
      let texto = l.texto;
      if (texto === '.code') enCodigo = true;
      if (enCodigo && texto.charAt(0) !== '.') {
        // Etiqueta en su propia columna de 6 caracteres: "_m1:  LOAD AX, [b]"
        const m = texto.match(/^(\w+:)\s*(.*)$/);
        texto = m ? (m[1] + '      ').slice(0, 6) + m[2] : '      ' + texto;
      }
      if (!l.lineaAlto || vistas[l.lineaAlto] || texto.charAt(0) === '.') return texto;
      vistas[l.lineaAlto] = true;
      const relleno = texto.length < 24 ? ' '.repeat(24 - texto.length) : ' ';
      return texto + relleno + '; L' + l.lineaAlto + ': ' + String(fuente[l.lineaAlto - 1]).trim();
    });
  },

  cargar_(mapaAlto, virtual) {
    const resultado = Ensamblador.ensamblar(
  Ensamblador.leerFuente(),
  { virtual: Boolean(virtual) }
);
    VistaCompilador.mostrarEnsamblado(resultado);
    if (!resultado.ok) {
      return {
        ok: false,
        errores: resultado.errores.map(e => 'Línea ' + e.linea + ': ' + e.mensaje),
        mensaje: 'El programa tiene ' + resultado.errores.length + ' error(es)'
      };
    }
    Ensamblador.cargarEnMemoria(resultado);
    Traza.guardarMapaFuente(
    resultado.listado,
    resultado.virtual
    );
    Traza.guardarMapaAlto(mapaAlto);
    Simulacion.reiniciar();
    const codigo = resultado.listado.filter(
  l => l.direccion <= (virtual ? 0xFF : MAPA_MEMORIA.CODIGO_FIN)
);
    const ultimo = codigo[codigo.length - 1];
    const tamano = ultimo ? ultimo.direccion + ultimo.bytes.length : 0;
    return {
      ok: true,
      errores: [],
      mensaje: 'Programa cargado: ' + tamano + ' bytes de código, ' + resultado.simbolos.length + ' símbolos.'
    };
  },

  /**
   * Ejecuta una acción de la Unidad de Control escuchando sus eventos:
   * cada micro-operación va al log y la última se resalta en la hoja.
   */
  ejecutar_(accion) {
    Simulacion.olvidarCopias_();
    const eventos = [];
    UnidadControl.limpiarSuscriptores();
    UnidadControl.suscribir(e => { eventos.push(e); LogMicroops.agregar(e); });

    let retorno, error = null;
    try {
      retorno = accion();
    } catch (e) {
      error = e;
    } finally {
      UnidadControl.limpiarSuscriptores();
      LogMicroops.volcar();
    }

    const ultimo = eventos[eventos.length - 1];
    if (ultimo) {
      LogMicroops.escribirPanel(ultimo.historial);
      Resaltado.aplicar(ultimo);
      Traza.aplicar(ultimo);
      VistaBuses.actualizar(ultimo);
    }
    if (error) throw error;

    const resumen = Simulacion.resumen_(ultimo || retorno);
    if (typeof retorno === 'number') resumen.pasosEjecutados = retorno;
    return resumen;
  },

  /**
   * Al empezar cada acción se vuelven a leer de la hoja los registros y la
   * RAM, por si se editaron a mano (por ejemplo, en vivo durante EJECUTAR).
   */
  olvidarCopias_() {
    Registros.olvidar();
    UtilMemoria.olvidar();
  },

  /** Datos que muestra el panel: último paso y estado del CPU. */
  resumen_(evento) {
    const hex = v => UtilMemoria.aHex(v) + 'h';
    return {
      paso: evento && evento.paso ? evento.paso : 0,
      fase: evento && evento.fase ? evento.fase : '—',
      descripcion: evento && evento.descripcion ? evento.descripcion : '—',
      detalle: evento && evento.detalle ? evento.detalle : '',
      instruccion: Registros.leerTexto('DECODIFICADO'),
      estado: Registros.leerTexto('ESTADO'),
      detenido: UnidadControl.estaDetenido(),
      pc: hex(Registros.leer('PC')),
      ax: hex(Registros.leer('AX')),
      bx: hex(Registros.leer('BX')),
      cx: hex(Registros.leer('CX')),
      dx: hex(Registros.leer('DX'))
    };
  }
};

// ── Funciones que llama el panel lateral (google.script.run) ─────────

function abrirPanel() {
  const html = HtmlService.createHtmlOutputFromFile('Panel').setTitle('Panel de control');
  SpreadsheetApp.getUi().showSidebar(html);
}

function panelPaso(porInstruccion) {
  return porInstruccion ? Simulacion.instruccion() : Simulacion.paso();
}

function panelReiniciar() {
  return Simulacion.reiniciar();
}

function panelCargar() {
  return Simulacion.cargar();
}

function panelCompilar() {
  return Simulacion.compilar();
}

function panelEstado() {
  return Simulacion.resumen_(null);
}
