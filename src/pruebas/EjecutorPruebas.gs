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

function probarTodo() {
  mostrarReporte_([suiteMemoria_(), suiteAccesoMemoria_(), suiteRegistros_(), suiteRegistrosGenerales_(), suiteALU_(), suiteISA_(), suiteMicroPalabra_(), suiteBus_(),
    suiteEnsamblador_(), suiteUnidadControl_(), suiteSimulacion_(),suiteSwap_(), suiteBorde_(), suiteCompilador_()]);
}
