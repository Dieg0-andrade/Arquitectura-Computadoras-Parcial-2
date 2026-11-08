/**
 * Editor sobre Codigo!E4:E103.
 * H4 valida y H5 carga mediante el activador instalable de Controles.
 */
const Editor = {
  hoja_() {
    return SpreadsheetApp.getActive().getSheetByName(HOJAS.CODIGO);
  },

  construir() {
    const hoja = Editor.hoja_();

    hoja.getRange('H3:I3')
      .setValues([['Accion', 'Editor de ensamblador']])
      .setBackground('#263238')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold');

    hoja.getRange('H4:H5').insertCheckboxes().setValue(false);
    hoja.getRange('I4:I5')
      .setValues([
        ['Validar sintaxis'],
        ['Cargar en memoria virtual']
      ])
      .setFontWeight('bold');

    hoja.getRange('H7').setValue('Estado');
    hoja.getRange('I7')
      .setValue('Edita E4:E103 y marca una casilla.')
      .setWrap(true);

    hoja.getRange('I9').setValue(
      'Una instruccion por celda. Los errores aparecen en F. ' +
      'Cargar valida, reemplaza el programa activo y reinicia la CPU. ' +
      'Para ejecutar usa Simulador CPU > Ejecutar hasta HLT.'
    ).setWrap(true);

    hoja.getRange('E4:E103').setNumberFormat('@');
    hoja.setColumnWidth(6, 360);
    hoja.setColumnWidth(8, 75);
    hoja.setColumnWidth(9, 380);
  },

  analizar_() {
    const resultado = Ensamblador.ensamblar(
      Ensamblador.leerFuente(),
      { virtual: true }
    );

    const tieneCodigo = resultado.listado.some(
      linea => linea.direccion < 0x100
    );

    if (resultado.ok && !tieneCodigo) {
      resultado.ok = false;
      resultado.errores.push({
        linea: 1,
        mensaje: 'Escribe al menos una instruccion en .code.'
      });
    }

    VistaCompilador.mostrarEnsamblado(resultado);
    return resultado;
  },

  ejecutar(cargar) {
    const lock = LockService.getDocumentLock();

    if (!lock.tryLock(1000)) {
      throw new Error(
        'El editor esta ocupado. Espera y vuelve a intentarlo.'
      );
    }

    try {
      const resultado = Editor.analizar_();

      if (!resultado.ok) {
        const mensaje = resultado.errores.map(error =>
          'Linea ' + error.linea + ': ' + error.mensaje
        ).join('\n');

        Editor.hoja_().getRange('I7').setValue(mensaje);
        return { ok: false, errores: resultado.errores };
      }

      if (cargar) {
        const props = PropertiesService.getDocumentProperties();
        props.deleteProperty(ProgramasCatalogo.CLAVE);

        Editor.hoja_().getRange('I7')
          .setValue('Cargando memoria virtual...');

        Ensamblador.cargarEnMemoria(resultado);
        Traza.guardarMapaFuente(resultado.listado, true);
        Traza.guardarMapaAlto(null);
        Simulacion.reiniciar();
      }

      Editor.hoja_().getRange('I7').setValue(
        cargar
          ? 'Cargado en memoria virtual. CPU lista para ejecutar.'
          : 'Sintaxis valida. Puedes cargar el programa.'
      );

      return { ok: true, resultado: resultado };
    } catch (error) {
      Editor.hoja_().getRange('I7')
        .setValue('Error: ' + error.message);
      throw error;
    } finally {
      lock.releaseLock();
    }
  },

  atender(e) {
    if (!e || !e.range) return false;

    const rango = e.range;

    if (rango.getSheet().getName() !== HOJAS.CODIGO ||
        rango.getColumn() !== 8 ||
        rango.getNumRows() !== 1 ||
        rango.getNumColumns() !== 1 ||
        ![4, 5].includes(rango.getRow())) {
      return false;
    }

    if (String(e.value).toUpperCase() !== 'TRUE') return true;

    rango.setValue(false);
    SpreadsheetApp.flush();

    try {
      Editor.ejecutar(rango.getRow() === 5);
    } catch (error) {
      SpreadsheetApp.getActive()
        .toast(error.message, 'Editor', 6);
    }

    return true;
  }
};

function instalarEditor() {
  Editor.construir();
  Controles.instalarActivador();
  onOpen();
  SpreadsheetApp.getActive().setActiveSheet(Editor.hoja_());
}

function menuValidarEditor() {
  return Editor.ejecutar(false);
}

function menuCargarEditor() {
  return Editor.ejecutar(true);
}