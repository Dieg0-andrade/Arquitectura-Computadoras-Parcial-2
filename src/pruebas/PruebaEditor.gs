/**
 * Prueba del editor en la copia de trabajo.
 * Reemplaza el codigo fuente y el programa activo.
 */
function probarEditor() {
  const hoja = Editor.hoja_();
  Editor.construir();

  function igual(actual, esperado, mensaje) {
    if (JSON.stringify(actual) !== JSON.stringify(esperado)) {
      throw new Error(
        mensaje +
        ': esperado ' + JSON.stringify(esperado) +
        ', obtenido ' + JSON.stringify(actual)
      );
    }
  }

  function escribir(lineas) {
    hoja.getRange('E4:E103').clearContent();
    hoja.getRange(4, 5, lineas.length, 1)
      .setValues(lineas.map(linea => [linea]));
  }

  const ramAntes = Memoria.volcar();
  const estadoAntes = PropertiesService.getDocumentProperties()
    .getProperty(CLAVE_ESTADO_UC);

  escribir(['.code', 'MOV AX,', 'HLT']);

  const invalido = menuCargarEditor();
  igual(invalido.ok, false, 'Rechazo del programa invalido');
  igual(invalido.errores[0].linea, 2, 'Numero de linea');
  igual(
    hoja.getRange('E5').getBackground().toUpperCase(),
    COLOR_ERROR.toUpperCase(),
    'Color de error'
  );
  igual(Memoria.volcar(), ramAntes, 'RAM tras rechazar carga');
  igual(
    PropertiesService.getDocumentProperties()
      .getProperty(CLAVE_ESTADO_UC),
    estadoAntes,
    'CPU tras rechazar carga'
  );

  escribir(['; comentario']);
  igual(
    menuValidarEditor().ok,
    false,
    'Rechazo de fuente sin instrucciones'
  );

  escribir([
    '.data',
    'dato DB 9',
    '.code',
    'LOAD AX, [dato]',
    'ADD AX, 5',
    'STORE [dato], AX',
    'HLT'
  ]);

  igual(menuValidarEditor().ok, true, 'Sintaxis corregida');
  igual(
    hoja.getRange('E5').getBackground().toUpperCase(),
    COLORES.ENTRADA.toUpperCase(),
    'Retirar resaltado anterior'
  );
  igual(
    hoja.getRange('F5').getDisplayValue(),
    '',
    'Retirar mensaje anterior'
  );
  igual(Memoria.volcar(), ramAntes, 'Validacion conserva RAM');

  // Usa el mismo manejador que atiende la casilla de carga.
  const boton = hoja.getRange('H5');
  boton.setValue(true);

  igual(
    Editor.atender({ range: boton, value: 'TRUE' }),
    true,
    'Manejador de carga'
  );
  igual(boton.getValue(), false, 'Casilla desmarcada');
  igual(MMU.estaActiva(), true, 'MMU activada');
  igual(
    Ensamblador.modoVirtualActivo(),
    true,
    'Direccionamiento virtual'
  );
  igual(Registros.leer('PC'), 0, 'PC inicial');
  igual(
    AccesoMemoria.leer(0x100, 'D').valor,
    9,
    'Dato cargado'
  );

  Simulacion.hastaDetener();

  igual(UnidadControl.estaDetenido(), true, 'HLT');
  igual(
    Registros.leerTexto('ESTADO'),
    'DETENIDO',
    'Estado final'
  );
  igual(Registros.leer('AX'), 14, 'Resultado del codigo editado');
  igual(
    AccesoMemoria.leer(0x100, 'D').valor,
    14,
    'Resultado guardado en memoria'
  );

  Logger.log(
    'PASS: editor, error en linea 2, carga rechazada, ' +
    'correccion, boton virtual y HLT; AX=14'
  );
}