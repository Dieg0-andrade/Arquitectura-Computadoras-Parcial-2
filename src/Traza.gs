/**
 * Traza.gs
 * Marca en la hoja Código la línea que se está ejecutando:
 *   - columna E (Ensamblador): la instrucción en curso
 *   - columna B (Alto nivel): la sentencia que la generó, si el programa se compiló
 *
 * Mapas guardados en las propiedades del documento al cargar un programa:
 *   MAPA_FUENTE : dirección de memoria  -> línea de ensamblador
 *   MAPA_ALTO   : línea de ensamblador  -> línea de alto nivel
 * Al seguir la dirección de inicio de cada instrucción, la traza también
 * sigue los saltos (JMP, JZ, JNZ).
 */

const CLAVE_MAPA_FUENTE = 'MAPA_FUENTE';
const CLAVE_MAPA_ALTO = 'MAPA_ALTO';

const Traza = {

  cache_: null,

  /** Guarda dirección -> línea de ensamblador a partir del listado del ensamblador. */
  guardarMapaFuente(listado) {
    const mapa = {};
    listado.forEach(l => { if (l.direccion <= MAPA_MEMORIA.CODIGO_FIN) mapa[l.direccion] = l.linea; });
    PropertiesService.getDocumentProperties().setProperty(CLAVE_MAPA_FUENTE, JSON.stringify(mapa));
    Traza.cache_ = null;
  },

  /** Guarda línea de ensamblador -> línea de alto nivel (o lo borra si mapa es null). */
  guardarMapaAlto(mapa) {
    const props = PropertiesService.getDocumentProperties();
    if (mapa) props.setProperty(CLAVE_MAPA_ALTO, JSON.stringify(mapa));
    else props.deleteProperty(CLAVE_MAPA_ALTO);
    Traza.cache_ = null;
  },

  /** Líneas (ensamblador y alto nivel) de la instrucción que empieza en una dirección. */
  lineasDe(direccion) {
    const mapas = Traza.mapas_();
    const lineaEns = mapas.fuente[direccion] || null;
    const lineaAlto = lineaEns && mapas.alto ? (mapas.alto[lineaEns] || null) : null;
    return { ensamblador: lineaEns, alto: lineaAlto };
  },

  /** Resalta las líneas de la instrucción del evento. */
  aplicar(evento) {
    Traza.limpiar();
    if (!evento || evento.direccionInstruccion === null || evento.direccionInstruccion === undefined) return;
    const lineas = Traza.lineasDe(evento.direccionInstruccion);
    const hoja = SpreadsheetApp.getActive().getSheetByName(HOJAS.CODIGO);
    if (lineas.ensamblador) hoja.getRange(3 + lineas.ensamblador, 5).setBackground(COLORES.ACTIVO);
    if (lineas.alto) hoja.getRange(3 + lineas.alto, 2).setBackground(COLORES.ACTIVO);
  },

  /** Quita el resaltado de las columnas de código. */
  limpiar() {
    const hoja = SpreadsheetApp.getActive().getSheetByName(HOJAS.CODIGO);
    hoja.getRange(4, 2, 100, 1).setBackground(COLORES.ENTRADA);
    hoja.getRange(4, 5, 100, 1).setBackground(COLORES.ENTRADA);
  },

  mapas_() {
    if (!Traza.cache_) {
      const props = PropertiesService.getDocumentProperties();
      const leer = clave => { try { return JSON.parse(props.getProperty(clave) || 'null'); } catch (e) { return null; } };
      Traza.cache_ = { fuente: leer(CLAVE_MAPA_FUENTE) || {}, alto: leer(CLAVE_MAPA_ALTO) };
    }
    return Traza.cache_;
  }
};
