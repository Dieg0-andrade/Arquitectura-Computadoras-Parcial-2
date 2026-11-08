/**
 * Catalogo de los tres programas del parcial.
 * Cargar reemplaza el programa activo y reinicia sus dispositivos.
 */
const ProgramasCatalogo = {
  HOJA: 'Programas',
  CLAVE: 'CATALOGO_PROGRAMA_ACTIVO',

  lista() {
    const datos = [];
    for (let i = 0; i < 7; i++) {
      datos.push(
        'p' + i + ' DB ' +
        [i + 1].concat(Array(31).fill(0)).join(', ')
      );
    }

    return [
      {
        nombre: 'Bucle aritmetico AX-DX',
        descripcion:
          'Suma 4 tres veces. AX acumula, BX contiene 4, ' +
          'CX cuenta y DX conserva el resultado.',
        esperado: 'HLT. AX=12, BX=4, CX=0, DX=12.',
        fuente: [
          '.code',
          'MOV AX, 0',
          'MOV BX, 4',
          'MOV CX, 3',
          'bucle: ADD AX, BX',
          'DEC CX',
          'JNZ bucle',
          'MOV DX, AX',
          'HLT'
        ]
      },
      {
        nombre: 'Eco teclado-LCD',
        descripcion:
          'Carga el programa, ingresa una letra en Cache_IO!C33 ' +
          'y ejecuta. IN consume un byte; OUT lo muestra ' +
          'en la primera posicion del LCD.',
        esperado:
          'HLT. AX contiene el codigo ASCII y K31 muestra la letra ingresada.',
        fuente: [
          '.code',
          'IN AX, [KBD]',
          'OUT [LCD], AX',
          'HLT'
        ]
      },
      {
        nombre: 'Accesos dispersos',
        descripcion:
          'Usa siete paginas de datos y una de codigo. ' +
          'El cargador precarga siete paginas; p6 queda ausente ' +
          'y provoca fallos de pagina durante la ejecucion.',
        esperado:
          'HLT. AX=28, fallos de pagina>0 y misses L1D/L2>0.',
        fuente: ['.data'].concat(datos, [
          '.code',
          'MOV AX, 0',
          'LOAD BX, [p6]',
          'ADD AX, BX',
          'LOAD BX, [p0]',
          'ADD AX, BX',
          'LOAD BX, [p4]',
          'ADD AX, BX',
          'LOAD BX, [p1]',
          'ADD AX, BX',
          'LOAD BX, [p5]',
          'ADD AX, BX',
          'LOAD BX, [p2]',
          'ADD AX, BX',
          'LOAD BX, [p3]',
          'ADD AX, BX',
          'HLT'
        ])
      }
    ];
  },

  hoja_() {
    const hoja = SpreadsheetApp.getActive()
      .getSheetByName(ProgramasCatalogo.HOJA);

    if (!hoja) {
      throw new Error('Ejecuta instalarCatalogo primero.');
    }
    return hoja;
  },

  construir() {
    const ss = SpreadsheetApp.getActive();
    const hoja = ss.getSheetByName(ProgramasCatalogo.HOJA) ||
      ss.insertSheet(ProgramasCatalogo.HOJA);

    const lista = ProgramasCatalogo.lista();

    hoja.getRange('A1:D1')
      .setValues([['Catalogo de programas', '', '', '']])
      .setFontSize(16)
      .setFontWeight('bold');

    hoja.getRange('A3').setValue('Seleccion');

    const selector = hoja.getRange('B3');
    const nombres = lista.map(p => p.nombre);

    if (!nombres.includes(selector.getValue())) {
      selector.setValue(nombres[0]);
    }

    selector.setDataValidation(
      SpreadsheetApp.newDataValidation()
        .requireValueInList(nombres, true)
        .setAllowInvalid(false)
        .build()
    );

    hoja.getRange('A5:D8').setValues([
      ['Programa', 'Funcion', 'Resultado esperado', 'Memoria'],
      ...lista.map(p => [
        p.nombre,
        p.descripcion,
        p.esperado,
        'Virtual / Swap'
      ])
    ]).setWrap(true);

    hoja.getRange('A5:D5')
      .setBackground('#263238')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold');

    hoja.setColumnWidth(1, 230);
    hoja.setColumnWidth(2, 360);
    hoja.setColumnWidth(3, 320);
    hoja.setColumnWidth(4, 150);

    hoja.getRange('A10').setValue('Uso');
    hoja.getRange('B10').setValue(
      'Selecciona B3 y usa Simulador CPU > Cargar programa del catalogo. ' +
      'Luego ejecuta hasta HLT.'
    ).setWrap(true);

    hoja.getRange('A12').setValue('Programa cargado');
    hoja.getRange('A13').setValue('Estado de verificacion');
    hoja.getRange('A15').setValue('Fuente del ultimo programa cargado');
    hoja.setFrozenRows(5);

    return hoja;
  },

  cargar(nombre) {
    const hoja = ProgramasCatalogo.hoja_();
    const elegido = nombre || hoja.getRange('B3').getValue();
    const programa = ProgramasCatalogo.lista()
      .find(p => p.nombre === elegido);

    if (!programa) {
      throw new Error('Selecciona un programa valido en B3.');
    }

    // Comprobar la infraestructura antes de reemplazar el programa.
    const io = TablaMarcos.obtener(15);
    if (io.presente !== 1 || io.pfn !== 7) {
      throw new Error(
        'TablaMarcos debe tener VPN 15 presente en PFN 7.'
      );
    }

    const resultado = Ensamblador.ensamblar(
      programa.fuente,
      { virtual: true }
    );

    if (!resultado.ok) {
      throw new Error(resultado.errores.map(e =>
        'Linea ' + e.linea + ': ' + e.mensaje
      ).join('\n'));
    }

    PropertiesService.getDocumentProperties()
      .deleteProperty(ProgramasCatalogo.CLAVE);

    hoja.getRange('B13').setValue('Cargando...');

    const codigo = SpreadsheetApp.getActive()
      .getSheetByName(HOJAS.CODIGO);

    codigo.getRange('E4:E103').clearContent();
    codigo.getRange(4, 5, programa.fuente.length, 1)
      .setValues(programa.fuente.map(linea => [linea]));

    const carga = Simulacion.cargar_(null, true);
    if (!carga.ok) {
      throw new Error(carga.errores.join('\n'));
    }

    Perifericos.teclado.reiniciar();
    for (let i = 0; i < 8; i++) {
      Perifericos.lcd.escribir(i, 0);
    }
    Cache.reiniciar();

    hoja.getRange('B3').setValue(elegido);
    hoja.getRange('B12').setValue(elegido);
    hoja.getRange('B13')
      .setValue('Cargado. ' + programa.esperado);

    hoja.getRange('A16:A115').clearContent();
    hoja.getRange(16, 1, programa.fuente.length, 1)
      .setValues(programa.fuente.map(linea => [linea]));

    PropertiesService.getDocumentProperties()
      .setProperty(ProgramasCatalogo.CLAVE, elegido);

    return programa;
  },

  verificar() {
    const nombre = PropertiesService.getDocumentProperties()
      .getProperty(ProgramasCatalogo.CLAVE);

    if (!nombre) {
      throw new Error('Carga un programa del catalogo primero.');
    }

    if (!UnidadControl.estaDetenido() ||
        Registros.leerTexto('ESTADO') !== 'DETENIDO') {
      throw new Error('El programa debe terminar mediante HLT.');
    }

    const ax = Registros.leer('AX');
    const cache = Cache.contadores();
    const fallos = ManejadorFallos.cargarEstado_().fallos;

    if (nombre === 'Bucle aritmetico AX-DX') {
      if (ax !== 12 ||
          Registros.leer('BX') !== 4 ||
          Registros.leer('CX') !== 0 ||
          Registros.leer('DX') !== 12) {
        throw new Error('Resultado aritmetico incorrecto.');
      }
    } else if (nombre === 'Eco teclado-LCD') {
      const panel = SpreadsheetApp.getActive()
        .getSheetByName(HOJAS.CACHE_IO);

      if (ax < 32 || ax > 126 ||
          Memoria.leer(0xF8) !== ax ||
          panel.getRange('K31').getDisplayValue() !==
            String.fromCharCode(ax)) {
        throw new Error(
          'El eco requiere una letra ASCII imprimible ' +
          'en la cola antes de ejecutar.'
        );
      }
    } else if (nombre === 'Accesos dispersos') {
      if (ax !== 28 || fallos < 1 ||
          cache.L1D.m < 1 || cache.L2.m < 1) {
        throw new Error(
          'Accesos dispersos: AX=' + ax +
          ', fallos=' + fallos +
          ', L1D misses=' + cache.L1D.m +
          ', L2 misses=' + cache.L2.m
        );
      }
    } else {
      throw new Error('Programa activo desconocido.');
    }

    const mensaje =
      'PASS: ' + nombre +
      ' | HLT | AX=' + ax +
      ' | Page Faults=' + fallos +
      ' | L1D misses=' + cache.L1D.m +
      ' | L2 misses=' + cache.L2.m;

    ProgramasCatalogo.hoja_().getRange('B13')
      .setValue(mensaje)
      .setWrap(true);

    Logger.log(mensaje);
    return mensaje;
  },

  probar(indice) {
    ProgramasCatalogo.construir();
    ProgramasCatalogo.cargar(
      ProgramasCatalogo.lista()[indice].nombre
    );

    if (indice === 1) {
      Perifericos.teclado.encolar('A');
    }

    Simulacion.hastaDetener();
    return ProgramasCatalogo.verificar();
  }
};

function instalarCatalogo() {
  const hoja = ProgramasCatalogo.construir();
  onOpen();
  SpreadsheetApp.getActive().setActiveSheet(hoja);
}

function menuCargarCatalogo() {
  const programa = ProgramasCatalogo.cargar();
  SpreadsheetApp.getActive()
    .toast(programa.esperado, 'Catalogo', 8);
}

function menuVerificarCatalogo() {
  const mensaje = ProgramasCatalogo.verificar();
  SpreadsheetApp.getActive()
    .toast(mensaje, 'Catalogo', 8);
}

function probarCatalogoAritmetica() {
  return ProgramasCatalogo.probar(0);
}

function probarCatalogoEco() {
  return ProgramasCatalogo.probar(1);
}

function probarCatalogoDispersos() {
  return ProgramasCatalogo.probar(2);
}