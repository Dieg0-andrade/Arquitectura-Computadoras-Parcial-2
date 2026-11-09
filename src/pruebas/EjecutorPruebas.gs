/**
 * pruebas/EjecutorPruebas.gs
 * Mini framework de pruebas compartido por todos los módulos.
 *
 * Uso dentro de un archivo de pruebas:
 *   function testAlgo_() {
 *     const t = crearSuite_('Algo');
 *     t.prueba('descripción', () => { t.igual(1 + 1, 2); });
 *     return t;
 *   }
 * y luego mostrarReporte_([testAlgo_()]).
 */

function crearSuite_(nombre) {
  const resultados = [];
  return {
    nombre: nombre,
    resultados: resultados,

    prueba(descripcion, fn) {
      try { fn(); resultados.push({ ok: true, texto: descripcion }); }
      catch (err) { resultados.push({ ok: false, texto: descripcion + ' → ' + err.message }); }
    },

    igual(obtenido, esperado) {
      if (obtenido !== esperado) throw new Error('se esperaba ' + esperado + ', se obtuvo ' + obtenido);
    },

    lanzaError(fn) {
      let fallo = false;
      try { fn(); } catch (e) { fallo = true; }
      if (!fallo) throw new Error('se esperaba un error');
    },

    aprobados() { return resultados.filter(r => r.ok).length; }
  };
}

/** Muestra un resumen de una o varias suites en un cuadro de diálogo y en el Logger. */
function mostrarReporte_(suites) {
  let total = 0, aprobados = 0;
  const lineas = [];
  suites.forEach(s => {
    total += s.resultados.length;
    aprobados += s.aprobados();
    lineas.push('── ' + s.nombre + ' (' + s.aprobados() + '/' + s.resultados.length + ')');
    s.resultados.forEach(r => lineas.push((r.ok ? '✔ ' : '✘ ') + r.texto));
    lineas.push('');
  });
  const texto = lineas.join('\n');
  Logger.log(texto);
  SpreadsheetApp.getUi().alert('Pruebas: ' + aprobados + '/' + total + ' aprobados\n\n' + texto);
}

/** Suites de "Ejecutar todas", en orden. */
function suitesTodas_() {
  return [suiteMemoria_, suiteAccesoMemoria_, suiteRegistros_, suiteRegistrosGenerales_, suiteALU_, suiteISA_, suiteMicroPalabra_, suiteBus_, suiteVistaBuses_, suiteIdentidad_, suiteEnsamblador_, suiteCargaVirtual_, suiteUnidadControl_, suiteSimulacion_, suiteSwap_, suiteTablaMarcos_, suiteMMU_, suiteFallosPagina_, suiteReemplazoPaginas_, suiteVisualFallos_, suiteMemoriaVirtualFinal_, suiteBorde_, suiteCompilador_];
}

const CLAVE_PROGRESO_PRUEBAS = 'PRUEBAS_PROGRESO';
const LIMITE_PRUEBAS_MS = 210000;        // 3,5 min: margen frente al límite de 6 min de Apps Script
const VIGENCIA_PROGRESO_MS = 1800000;    // un progreso guardado hace más de 30 min se descarta

/**
 * Ejecutar todas. Si se acerca al límite de 6 minutos de Apps Script, guarda
 * el resultado de las suites ya ejecutadas y avisa que hay que volver a
 * elegir "Ejecutar todas": la siguiente vez continúa donde quedó y al final
 * muestra el reporte completo.
 */
function probarTodo() {
  Registros.olvidar();
  UtilMemoria.olvidar();
  const props = PropertiesService.getDocumentProperties();
  const fabricas = suitesTodas_();
  const inicio = Date.now();

  let progreso = null;
  try { progreso = JSON.parse(props.getProperty(CLAVE_PROGRESO_PRUEBAS) || 'null'); } catch (e) { progreso = null; }
  if (!progreso || inicio - progreso.fecha > VIGENCIA_PROGRESO_MS) progreso = { siguiente: 0, resumen: [], fecha: inicio };

  const nuevas = [];
  for (let i = progreso.siguiente; i < fabricas.length; i++) {
    if (nuevas.length > 0 && Date.now() - inicio > LIMITE_PRUEBAS_MS) {
      progreso.resumen = progreso.resumen.concat(nuevas.map(resumirSuite_));
      progreso.siguiente = i;
      progreso.fecha = Date.now();
      props.setProperty(CLAVE_PROGRESO_PRUEBAS, JSON.stringify(progreso));
      const hechas = progreso.resumen.reduce((a, s) => a + s.total, 0);
      const ok = progreso.resumen.reduce((a, s) => a + s.aprobados, 0);
      SpreadsheetApp.getUi().alert('Pruebas: parte terminada',
        'Van ' + i + ' de ' + fabricas.length + ' suites (' + ok + '/' + hechas + ' pruebas aprobadas).\n\n' +
        'Apps Script corta cada ejecución a los 6 minutos. Vuelve a elegir\n' +
        'Simulador CPU → Pruebas → Ejecutar todas para continuar donde quedó.',
        SpreadsheetApp.getUi().ButtonSet.OK);
      return;
    }
    nuevas.push(fabricas[i]());
  }

  props.deleteProperty(CLAVE_PROGRESO_PRUEBAS);
  mostrarReporte_(progreso.resumen.map(rehidratarSuite_).concat(nuevas));
}

/** Resumen compacto de una suite para guardarlo entre ejecuciones. */
function resumirSuite_(s) {
  return {
    nombre: s.nombre,
    total: s.resultados.length,
    aprobados: s.aprobados(),
    fallos: s.resultados.filter(r => !r.ok).map(r => r.texto).slice(0, 10)
  };
}

/** Convierte un resumen guardado en una suite para mostrarReporte_. */
function rehidratarSuite_(r) {
  const resultados = [];
  for (let i = 0; i < r.aprobados; i++) resultados.push({ ok: true, texto: '(aprobada en la parte anterior)' });
  r.fallos.forEach(t => resultados.push({ ok: false, texto: t }));
  return { nombre: r.nombre, resultados: resultados, aprobados: () => r.aprobados };
}
