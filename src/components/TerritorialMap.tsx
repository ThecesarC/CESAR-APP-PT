import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  Box, MapPin, Search as SearchIcon, Filter, X, 
  Upload, FileSpreadsheet, Trash2, Palette, Map as MapIcon, Search,
  ExternalLink, Database, Download, RefreshCcw, FileText, ChevronRight
} from 'lucide-react';
import { 
  MapContainer, TileLayer, Marker, Popup, GeoJSON, useMap 
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free';
// @ts-ignore
import toGeoJSON from 'togeojson';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { toast } from 'sonner';
import { 
  collection, doc, query, orderBy, onSnapshot, 
  addDoc as fireAddDoc, deleteDoc, writeBatch, serverTimestamp, limit, updateDoc 
} from 'firebase/firestore';
import { db } from '../firebase';

// Fix for default marker icon in leaflet
// @ts-ignore
import markerIcon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import markerIconRetina from 'leaflet/dist/images/marker-icon-2x.png';
// @ts-ignore
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    iconRetinaUrl: markerIconRetina,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Helper for KML style extraction
const extractKmlStyles = (kmlDoc: Document) => {
  const styles: Record<string, any> = {};
  
  const kmlColorToHex = (kmlColor: string | null) => {
    if (!kmlColor) return null;
    let a = 'ff', b = '00', g = '00', r = '00';
    
    // KML format is AABBGGRR (Alpha, Blue, Green, Red)
    let cleanColor = kmlColor.trim().replace('#', '');
    
    // Handle short formats or irregular lengths
    if (cleanColor.length === 8) {
      a = cleanColor.substring(0, 2);
      b = cleanColor.substring(2, 4);
      g = cleanColor.substring(4, 6);
      r = cleanColor.substring(6, 8);
    } else if (cleanColor.length === 6) {
      b = cleanColor.substring(0, 2);
      g = cleanColor.substring(2, 4);
      r = cleanColor.substring(4, 6);
    } else if (cleanColor.length === 3) {
      // Very rare in KML but just in case
      b = cleanColor.substring(0, 1) + cleanColor.substring(0, 1);
      g = cleanColor.substring(1, 2) + cleanColor.substring(1, 2);
      r = cleanColor.substring(2, 3) + cleanColor.substring(2, 3);
    } else {
      return null;
    }

    return {
      color: `#${r}${g}${b}`,
      opacity: parseInt(a, 16) / 255
    };
  };

  const styleElements = kmlDoc.getElementsByTagName('Style');
  for (let i = 0; i < styleElements.length; i++) {
    const styleId = styleElements[i].getAttribute('id');
    if (!styleId) continue;
    
    const polyStyle = styleElements[i].getElementsByTagName('PolyStyle')[0];
    const lineStyle = styleElements[i].getElementsByTagName('LineStyle')[0];
    
    const polyColor = kmlColorToHex(polyStyle?.getElementsByTagName('color')[0]?.textContent || null);
    const lineColor = kmlColorToHex(lineStyle?.getElementsByTagName('color')[0]?.textContent || null);

    const fillValue = polyStyle?.getElementsByTagName('fill')[0]?.textContent;
    const outlineValue = polyStyle?.getElementsByTagName('outline')[0]?.textContent;
    
    const fill = fillValue !== '0';
    const outline = outlineValue !== '0';

    styles[styleId] = {
      fillColor: polyColor?.color || lineColor?.color || '#4f46e5',
      fillOpacity: fill ? (polyColor?.opacity ?? 0.4) : 0,
      color: lineColor?.color || polyColor?.color || '#4f46e5',
      opacity: outline ? (lineColor?.opacity ?? 0.8) : 0,
      weight: parseFloat(lineStyle?.getElementsByTagName('width')[0]?.textContent || '2')
    };
  }

  const styleMapElements = kmlDoc.getElementsByTagName('StyleMap');
  for (let i = 0; i < styleMapElements.length; i++) {
    const mapId = styleMapElements[i].getAttribute('id');
    if (!mapId) continue;

    const pairs = styleMapElements[i].getElementsByTagName('Pair');
    for (let j = 0; j < pairs.length; j++) {
      const key = pairs[j].getElementsByTagName('key')[0]?.textContent;
      if (key === 'normal') {
        const styleUrl = pairs[j].getElementsByTagName('styleUrl')[0]?.textContent?.replace('#', '');
        if (styleUrl && styles[styleUrl]) {
          styles[mapId] = { ...styles[styleUrl] };
        }
      }
    }
  }

  return styles;
};

const PRESET_COLORS = [
  '#4f46e5', '#2563eb', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', 
  '#ec4899', '#8b5cf6', '#000000', '#6366f1', '#14b8a6', '#f97316'
];

import { saveAs } from 'file-saver';

// Helper for buffer conversion (XLSX)
const s2ab = (s: string) => {
  const buf = new ArrayBuffer(s.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i !== s.length; ++i) view[i] = s.charCodeAt(i) & 0xFF;
  return buf;
};

const exportToExcel = (data: any[], fileName: string) => {
  try {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Datos");
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'binary' });
    saveAs(new Blob([s2ab(excelBuffer)], { type: 'application/octet-stream' }), `${fileName}.xlsx`);
  } catch (err) {
    console.error("Excel export error:", err);
    toast.error("Error al exportar a Excel");
  }
};

function BatchDataManager({ layers, onClose }: { layers: any[], onClose: () => void }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const batches = useMemo(() => {
    const groups: Record<string, any> = {};
    layers.forEach(l => {
      // Use sourceFile as primary key, fallback to batchId or generic name
      const source = l.sourceFile || (l.batchId ? `Lote ${l.batchId.substring(0, 8)}` : 'Importación Manual');
      
      if (!groups[source]) {
        groups[source] = {
          name: source,
          count: 0,
          ids: [],
          type: l.type || 'unknown',
          data: [],
          rawLayers: []
        };
      }
      
      groups[source].count++;
      if (l.id) {
        groups[source].ids.push(l.id);
      }
      groups[source].rawLayers.push(l);
      
      // Update type if we have a valid one
      if (l.type && (groups[source].type === 'unknown' || groups[source].type === 'casilla')) {
        // KML/KMZ has priority for type if mixed
        if (l.type === 'kml') groups[source].type = 'kml';
        else if (groups[source].type === 'unknown') groups[source].type = l.type;
      }

      if (l.type === 'casilla' && l.coords) {
        groups[source].data.push({
          SECCION: l.seccion || 'N/A',
          CASILLA: l.name || 'N/A',
          LATITUD: l.coords[0],
          LONGITUD: l.coords[1],
          COORDENADAS: `${l.coords[0]},${l.coords[1]}`,
          FECHA: l.createdAt ? (l.createdAt.seconds ? new Date(l.createdAt.seconds * 1000).toLocaleString() : 'Reciente') : 'N/A'
        });
      }
    });

    return Object.values(groups).sort((a: any, b: any) => b.count - a.count);
  }, [layers]);

  const deleteBatch = async (ids: string[], name: string) => {
    // Filter and unique IDs
    const uniqueIds = Array.from(new Set(ids.filter(id => id && typeof id === 'string')));
    
    if (uniqueIds.length === 0) {
      toast.error("No hay elementos válidos para borrar en este lote");
      return;
    }

    const isConfirmed = window.confirm(
      `🚨 ATENCIÓN: ACCIÓN IRREVERSIBLE\n\n` +
      `¿Deseas eliminar definitivamente todos los elementos de "${name}"?\n\n` +
      `Se borrarán ${uniqueIds.length} registros del servidor de forma permanente.`
    );
    
    if (!isConfirmed) return;
    
    setIsDeleting(true);
    const loadingToast = toast.loading(`Iniciando borrado de ${uniqueIds.length} registros de "${name}"...`);
    
    try {
      // Chunk deletions to honor Firestore limits (max 500 per batch)
      const chunkSize = 250; // Smaller chunks for more reliability
      let deletedSoFar = 0;
      
      for (let i = 0; i < uniqueIds.length; i += chunkSize) {
        const chunk = uniqueIds.slice(i, i + chunkSize);
        const fbBatch = writeBatch(db);
        
        chunk.forEach(id => {
          fbBatch.delete(doc(db, 'map_layers', id));
        });
        
        await fbBatch.commit();
        deletedSoFar += chunk.length;
        
        // Accurate progress feedback
        toast.loading(`Progreso: ${deletedSoFar}/${uniqueIds.length} eliminados...`, { id: loadingToast });
        
        // Short pause to avoid overwhelming the write throughput
        if (i + chunkSize < uniqueIds.length) {
          await new Promise(r => setTimeout(r, 150));
        }
      }
      
      toast.dismiss(loadingToast);
      toast.success(`Se eliminaron con éxito ${uniqueIds.length} registros de "${name}"`);
    } catch (e: any) {
      console.error("Critical Batch Delete Error:", e);
      toast.dismiss(loadingToast);
      toast.error(`Error al borrar: ${e.message || 'Error desconocido'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const exportData = (batch: any) => {
    try {
      if (batch.type === 'casilla' && batch.data.length > 0) {
        toast.info(`Exportando Excel: ${batch.name}...`);
        exportToExcel(batch.data, batch.name);
      } else if (batch.type === 'kml' || (batch.rawLayers.length > 0)) {
        toast.info(`Exportando GeoJSON: ${batch.name}...`);
        const allFeatures = batch.rawLayers.reduce((acc: any[], l: any) => {
          if (l.data && l.data.features) return acc.concat(l.data.features);
          if (l.data && l.data.type === 'Feature') return acc.concat([l.data]);
          return acc;
        }, []);
        
        if (allFeatures.length === 0) {
          toast.error("No hay datos geográficos exportables en este lote");
          return;
        }

        const geojson = {
          type: 'FeatureCollection',
          features: allFeatures
        };
        
        const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
        saveAs(blob, `${batch.name}.geojson`);
        toast.success(`Descarga completada`);
      } else {
        toast.error("Este archivo no contiene datos compatibles para la exportación masiva");
      }
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Error al procesar la descarga");
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 border border-white/20">
        <div className="p-6 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-neutral-900 text-lg">Gestión de Archivos Importados</h3>
              <p className="text-xs text-neutral-500 font-medium tracking-tight">Administra tus capas y registros por lote</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-neutral-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-neutral-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid gap-4">
            {batches.length === 0 ? (
              <div className="text-center py-12">
                <div className="inline-flex p-4 bg-neutral-100 rounded-full mb-4">
                  <FileText className="w-8 h-8 text-neutral-300" />
                </div>
                <h4 className="font-bold text-neutral-400">No hay archivos cargados</h4>
                <p className="text-xs text-neutral-500 max-w-xs mx-auto mt-2">Importa archivos KML o Excel para gestionarlos desde este panel</p>
              </div>
            ) : (
              batches.map((batch, idx) => (
                <div key={idx} className="group flex items-center justify-between p-5 rounded-2xl border border-neutral-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-all">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${batch.type === 'casilla' ? 'bg-indigo-100' : 'bg-green-100'}`}>
                      {batch.type === 'casilla' ? (
                        <FileSpreadsheet className={`w-5 h-5 ${batch.type === 'casilla' ? 'text-indigo-600' : 'text-green-600'}`} />
                      ) : (
                        <MapIcon className="w-5 h-5 text-green-600" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-neutral-900 text-sm">{batch.name}</h4>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">{batch.type === 'casilla' ? 'REGISTROS EXCEL' : 'CAPA GEOGRÁFICA'}</span>
                        <span className="w-1 h-1 rounded-full bg-neutral-300"></span>
                        <span className="text-[10px] font-bold text-indigo-600 px-2 py-0.5 bg-indigo-50 rounded-full">{batch.count} elementos</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => exportData(batch)}
                      disabled={isDeleting}
                      className="flex items-center gap-2 px-3 py-2 bg-white border border-neutral-100 rounded-xl text-neutral-500 hover:text-indigo-600 hover:border-indigo-200 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Descargar Archivo"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold hidden sm:inline">Descargar</span>
                    </button>
                    <button 
                      onClick={() => deleteBatch(batch.ids, batch.name)}
                      disabled={isDeleting}
                      className="flex items-center gap-2 px-3 py-2 bg-white border border-neutral-100 rounded-xl text-neutral-500 hover:text-red-600 hover:border-red-200 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Eliminar del Sistema"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold hidden sm:inline">Borrar</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="p-6 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between">
          <p className="text-[10px] text-neutral-400 font-medium">TOTAL DE ARCHIVOS: {batches.length}</p>
          <button 
            onClick={onClose}
            className="px-6 py-2.5 bg-neutral-900 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-neutral-800 transition-all shadow-lg"
          >
            Cerrar Panel
          </button>
        </div>
      </div>
    </div>
  );
}

function LayerStyleEditor({ 
  selectedLayer, 
  onClose, 
  onStyleChange 
}: { 
  selectedLayer: any, 
  onClose: () => void, 
  onStyleChange: (style: any) => void 
}) {
  const [localStyle, setLocalStyle] = useState({
    color: selectedLayer.options.color || '#4f46e5',
    fillColor: selectedLayer.options.fillColor || '#4f46e5',
    weight: selectedLayer.options.weight || 2,
    opacity: selectedLayer.options.opacity !== undefined ? selectedLayer.options.opacity : 0.8,
    fillOpacity: selectedLayer.options.fillOpacity !== undefined ? selectedLayer.options.fillOpacity : 0.4
  });

  const handleChange = (patch: any, finalize = false) => {
    const newStyle = { ...localStyle, ...patch };
    setLocalStyle(newStyle);
    selectedLayer.setStyle(newStyle);
    if (finalize) {
      onStyleChange(newStyle);
    }
  };

  return (
    <div className="w-80 bg-white/95 backdrop-blur-md border-l border-neutral-200 shadow-2xl p-0 absolute right-0 top-0 bottom-0 z-[1000] animate-in slide-in-from-right duration-300 flex flex-col">
      <div className="p-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-100 rounded-lg">
            <Palette className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <h5 className="font-bold text-neutral-900 text-[11px] uppercase tracking-tight">Personalización</h5>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-neutral-200 rounded-full transition-colors">
          <X className="w-3.5 h-3.5 text-neutral-400" />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-5 space-y-8">
        {/* Color de Línea (Contorno) */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Contorno</label>
            <div className="w-4 h-4 rounded-full border border-neutral-200" style={{ backgroundColor: localStyle.color }}></div>
          </div>
          
          <div className="grid grid-cols-6 gap-2">
            {PRESET_COLORS.map(c => (
              <button 
                key={c}
                onClick={() => {
                  const s = { color: c };
                  setLocalStyle(prev => ({ ...prev, ...s }));
                  selectedLayer.setStyle({ ...localStyle, ...s });
                  onStyleChange({ ...localStyle, ...s });
                }}
                className={`w-full aspect-square rounded-full border-2 transition-transform hover:scale-110 ${localStyle.color === c ? 'border-neutral-900 scale-110 shadow-sm' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-8 rounded-lg border border-neutral-100 overflow-hidden relative">
              <input 
                type="color" 
                className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
                value={localStyle.color}
                onChange={(e) => handleChange({ color: e.target.value })}
                onBlur={() => onStyleChange(localStyle)}
              />
              <div className="w-full h-full flex items-center justify-center text-[9px] font-bold text-neutral-400 pointer-events-none uppercase">
                Personalizado
              </div>
            </div>
            <div className="text-[10px] font-mono text-neutral-400 uppercase">{localStyle.color}</div>
          </div>
        </div>

        {/* Color de Relleno */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Relleno</label>
            <div className="w-4 h-4 rounded-full border border-neutral-200" style={{ backgroundColor: localStyle.fillColor }}></div>
          </div>
          
          <div className="grid grid-cols-6 gap-2">
            {PRESET_COLORS.map(c => (
              <button 
                key={c}
                onClick={() => {
                  const s = { fillColor: c };
                  setLocalStyle(prev => ({ ...prev, ...s }));
                  selectedLayer.setStyle({ ...localStyle, ...s });
                  onStyleChange({ ...localStyle, ...s });
                }}
                className={`w-full aspect-square rounded-full border-2 transition-transform hover:scale-110 ${localStyle.fillColor === c ? 'border-neutral-900 scale-110 shadow-sm' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-8 rounded-lg border border-neutral-100 overflow-hidden relative">
              <input 
                type="color" 
                className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
                value={localStyle.fillColor}
                onChange={(e) => handleChange({ fillColor: e.target.value })}
                onBlur={() => onStyleChange(localStyle)}
              />
              <div className="w-full h-full flex items-center justify-center text-[9px] font-bold text-neutral-400 pointer-events-none uppercase">
                Personalizado
              </div>
            </div>
            <div className="text-[10px] font-mono text-neutral-400 uppercase">{localStyle.fillColor}</div>
          </div>
        </div>

        <div className="space-y-6 pt-4 border-t border-neutral-50">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Grosor de línea</label>
              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{localStyle.weight}px</span>
            </div>
            <input 
              type="range" min="1" max="15" 
              className="w-full h-1 bg-neutral-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              value={localStyle.weight}
              onChange={(e) => handleChange({ weight: parseInt(e.target.value) })}
              onMouseUp={() => onStyleChange(localStyle)}
            />
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Transparencia</label>
              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{Math.round((1 - localStyle.fillOpacity) * 100)}%</span>
            </div>
            <input 
              type="range" min="0" max="1" step="0.05"
              className="w-full h-1 bg-neutral-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              value={localStyle.fillOpacity}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                handleChange({ fillOpacity: v, opacity: Math.min(1, v + 0.3) });
              }}
              onMouseUp={() => onStyleChange(localStyle)}
            />
          </div>
        </div>
      </div>

      <div className="p-5 border-t border-neutral-100 bg-neutral-50/30">
        <button 
          onClick={() => {
            selectedLayer.remove();
            onClose();
            toast.info('Elemento ocultado (temporalmente)');
          }}
          className="w-full py-2.5 bg-white border border-red-100 text-red-500 rounded-xl font-bold text-[9px] uppercase tracking-widest hover:bg-red-50 transition-all flex items-center justify-center gap-2"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Ocultar de vista
        </button>
      </div>
    </div>
  );
}

function GeomanControls({ onShapeCreated }: { onShapeCreated: (layer: any) => void }) {
  const map = useMap();
  const onShapeCreatedRef = useRef(onShapeCreated);

  useEffect(() => {
    onShapeCreatedRef.current = onShapeCreated;
  }, [onShapeCreated]);

  useEffect(() => {
    if (!map || !map.pm) return;
    // @ts-ignore
    if (map._geomanInitialized) return;
    // @ts-ignore
    map._geomanInitialized = true;

    map.pm.setLang('es');
    map.pm.setGlobalOptions({
      allowSelfIntersection: false,
      snappable: true,
      snapDistance: 20,
      hintlineStyle: { color: '#4f46e5', dashArray: '5, 5' },
      templineStyle: { color: '#4f46e5' }
    });

    map.pm.addControls({
      position: 'topleft',
      drawCircle: false,
      drawCircleMarker: false,
      drawMarker: true,
      drawPolyline: true,
      drawRectangle: true,
      drawPolygon: true,
      drawText: false,
      cutPolygon: false,
      dragMode: false,
      editMode: false,
      removalMode: false,
      rotateMode: false,
      oneBlock: true,
    });

    const handleCreate = (e: any) => {
      const { layer } = e;
      layer.on('click', (ev: any) => {
        L.DomEvent.stopPropagation(ev);
      });
      onShapeCreatedRef.current(layer);
    };

    map.on('pm:create', handleCreate);

    return () => {
      map.off('pm:create', handleCreate);
      // @ts-ignore
      map._geomanInitialized = false;
      if (map.pm) {
        map.pm.removeControls();
        map.pm.disableDraw();
        map.pm.disableGlobalEditMode();
      }
    };
  }, [map]);

  return null;
}

interface GeoJSONLayerProps {
  layer: any;
  isAdminView: boolean;
  onSelect: (layer: any) => void;
}

const MemoizedGeoJSONLayer = React.memo(({ layer, isAdminView, onSelect }: GeoJSONLayerProps) => {
  return (
    <GeoJSON 
      data={layer.data} 
      onEachFeature={(feature, leafletLayer: any) => {
        // Attach firestoreId so we can update it later
        leafletLayer.firestoreId = layer.id;
        leafletLayer.featureProperties = feature.properties;
        
        if (feature.properties) {
          const style = {
            color: feature.properties.color || feature.properties.stroke || feature.properties['stroke'] || '#4f46e5',
            fillColor: feature.properties.fillColor || feature.properties.fill || feature.properties['fill'] || '#4f46e5',
            weight: feature.properties.weight || feature.properties['stroke-width'] || feature.properties['weight'] || 2,
            opacity: feature.properties.opacity !== undefined ? feature.properties.opacity : (feature.properties['stroke-opacity'] !== undefined ? feature.properties['stroke-opacity'] : 0.8),
            fillOpacity: feature.properties.fillOpacity !== undefined ? feature.properties.fillOpacity : (feature.properties['fill-opacity'] !== undefined ? feature.properties['fill-opacity'] : 0.4)
          };
          leafletLayer.setStyle(style);
        }

        if (feature.properties && feature.properties.name) {
          leafletLayer.bindPopup(`<strong>${feature.properties.name}</strong><br/>${feature.properties.description || ''}`);
        }

        leafletLayer.options.pmIgnore = false;
        
        leafletLayer.on('click', (e: any) => {
          L.DomEvent.stopPropagation(e);
          if (isAdminView) {
            onSelect(leafletLayer);
          }
        });
      }}
    />
  );
}, (prev, next) => prev.layer.id === next.layer.id && prev.layer.data === next.layer.data && prev.isAdminView === next.isAdminView);

const MapRegistrations = React.memo(({ registrations }: { registrations: any[] }) => {
  return (
    <>
      {registrations.map(reg => (
        <Marker key={reg.id} position={[reg.latitude, reg.longitude] as any}>
          <Popup minWidth={200}>
            <div className="p-1 flex flex-col gap-1">
              <h4 className="font-bold text-sm text-red-600 m-0 uppercase tracking-tight">{reg.personName}</h4>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-neutral-500">
                <MapPin className="w-3 h-3 text-neutral-400" />
                <span>Sección {reg.sectionName} - Casilla {reg.casilla}</span>
              </div>
              <div className="text-[9px] text-neutral-400 font-medium">
                Captado por: <span className="text-neutral-600">{reg.responsibleEmail}</span>
              </div>
              {reg.ineFrontUrl && (
                <div className="mt-2 rounded-lg overflow-hidden border border-neutral-100 shadow-sm aspect-video">
                  <img src={reg.ineFrontUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}, (prev, next) => prev.registrations === next.registrations);

function MapFlyTo({ center }: { center: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, 16);
    }
  }, [center, map]);
  return null;
}

export function TerritorialMap({ registrations, isAdminView = false }: { registrations: any[], isAdminView?: boolean }) {
  const [mapLayers, setMapLayers] = useState<any[]>([]);
  const [mapCenter, setMapCenter] = useState<[number, number]>([19.4326, -99.1332]);
  const [mapZoom, setMapZoom] = useState(5);
  const [selectedMapLayer, setSelectedMapLayer] = useState<any>(null);
  const [layerStyle, setLayerStyle] = useState({
    color: '#4f46e5',
    fillColor: '#4f46e5',
    weight: 4,
    opacity: 0.6,
    fillOpacity: 0.3
  });
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const [searchSeccion, setSearchSeccion] = useState('');
  const [searchCasilla, setSearchCasilla] = useState('');
  const [flyToTarget, setFlyToTarget] = useState<[number, number] | null>(null);
  const [showBatchManager, setShowBatchManager] = useState(false);

  const isFullView = window.location.pathname.startsWith('/mapa-completo');

  const geoRegistrations = useMemo(() => 
    registrations.filter(reg => reg.latitude && reg.longitude),
    [registrations]
  );

  const availableCasillas = useMemo(() => {
    if (!searchSeccion) return [];
    
    // Get unique casillas from map layers of type 'casilla' for the current section
    const fromLayers = mapLayers
      .filter(l => l.type === 'casilla' && String(l.seccion).toLowerCase() === searchSeccion.toLowerCase())
      .map(l => l.name);
      
    // Also from registrations
    const fromRegistrations = geoRegistrations
      .filter(r => String(r.sectionName).toLowerCase() === searchSeccion.toLowerCase())
      .map(r => r.casilla);
      
    return Array.from(new Set([...fromLayers, ...fromRegistrations]))
      .filter(Boolean)
      .sort((a, b) => String(a).localeCompare(String(b)));
  }, [mapLayers, geoRegistrations, searchSeccion]);

  useEffect(() => {
    const queryLimit = isAdminView ? 10000 : 5000;
    const q = query(collection(db, 'map_layers'), orderBy('createdAt', 'desc'), limit(queryLimit));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const layers = snapshot.docs.map(doc => {
        const d = doc.data() as any;
        // Parse stringified data if present
        if (d.data && typeof d.data === 'string') {
          try {
            d.data = JSON.parse(d.data);
          } catch (e) {
            console.error("Error parsing layer data:", e);
          }
        }
        return {
          id: doc.id,
          ...d
        };
      });
      setMapLayers(layers);
    });
    return () => unsubscribe();
  }, [isAdminView]);

  const filteredRegistrations = useMemo(() => {
    if (!searchSeccion && !searchCasilla) return geoRegistrations;
    return geoRegistrations.filter(reg => {
      // Precise search as requested
      const matchSeccion = !searchSeccion || String(reg.sectionName).toLowerCase() === searchSeccion.toLowerCase();
      const matchCasilla = !searchCasilla || String(reg.casilla).toLowerCase() === searchCasilla.toLowerCase();
      return matchSeccion && matchCasilla;
    });
  }, [geoRegistrations, searchSeccion, searchCasilla]);

  const filteredLayers = useMemo(() => {
    if (!searchSeccion && !searchCasilla) return mapLayers;
    
    return mapLayers.map(layer => {
      if (layer.type === 'casilla') {
        // Precise search as requested
        const matchSeccion = !searchSeccion || String(layer.seccion).toLowerCase() === searchSeccion.toLowerCase();
        const matchCasilla = !searchCasilla || String(layer.name).toLowerCase() === searchCasilla.toLowerCase();
        return (matchSeccion && matchCasilla) ? layer : null;
      }
      return layer;
    }).filter(Boolean);
  }, [mapLayers, searchSeccion, searchCasilla]);

  const handleSearch = () => {
    if (!searchSeccion && !searchCasilla) {
      toast.error("Ingresa una sección o casilla para buscar");
      return;
    }

    // Prioritize casillas from map layers
    const matchedCasilla = mapLayers.find(l => 
      l.type === 'casilla' && 
      (!searchSeccion || String(l.seccion).toLowerCase() === searchSeccion.toLowerCase()) &&
      (!searchCasilla || String(l.name).toLowerCase() === searchCasilla.toLowerCase())
    );

    if (matchedCasilla) {
      setFlyToTarget(matchedCasilla.coords);
      return;
    }

    // Then check registrations
    const matchedReg = geoRegistrations.find(r => 
      (!searchSeccion || String(r.sectionName).toLowerCase() === searchSeccion.toLowerCase()) &&
      (!searchCasilla || String(r.casilla).toLowerCase() === searchCasilla.toLowerCase())
    );

    if (matchedReg) {
      setFlyToTarget([matchedReg.latitude, matchedReg.longitude]);
      return;
    }

    toast.info("No se encontró una ubicación exacta para esa sección/casilla");
  };

  const saveLayerToFirestore = async (layerData: any) => {
    try {
      // Basic size check for Firestore
      const dataStr = JSON.stringify(layerData);
      
      // If the file is too large and it's a KML with multiple features, split it
      if (dataStr.length > 980000 && layerData.type === 'kml' && layerData.data?.features?.length > 1) {
        const features = layerData.data.features;
        const totalFeatures = features.length;
        
        // Calculate number of chunks needed (aiming for roughly search chunks)
        // A safer way is to split and check size, but 2 chunks is a good start
        const numChunks = Math.ceil(dataStr.length / 800000); 
        const chunkSize = Math.ceil(totalFeatures / numChunks);
        
        const baseName = layerData.name;
        
        for (let i = 0; i < numChunks; i++) {
          const start = i * chunkSize;
          const end = Math.min((i + 1) * chunkSize, totalFeatures);
          const chunkFeatures = features.slice(start, end);
          
          if (chunkFeatures.length === 0) continue;
          
          const chunkData = {
            ...layerData,
            name: numChunks > 1 ? `${baseName} (P${i + 1})` : baseName,
            sourceFile: layerData.sourceFile || 'Manual',
            data: JSON.stringify({
              ...layerData.data,
              features: chunkFeatures
            })
          };

          await fireAddDoc(collection(db, 'map_layers'), {
            ...chunkData,
            createdAt: serverTimestamp()
          });
        }
        return;
      }

      if (dataStr.length > 980000) {
        throw new Error("El archivo es demasiado grande (límite 1MB) y no se puede fragmentar automáticamente. Intenta simplificar el KML.");
      }

      const finalLayerData = {
        ...layerData,
        data: typeof layerData.data === 'object' ? JSON.stringify(layerData.data) : layerData.data
      };

      await fireAddDoc(collection(db, 'map_layers'), {
        ...finalLayerData,
        sourceFile: layerData.sourceFile || 'Manual',
        createdAt: serverTimestamp()
      });
    } catch (error: any) {
      console.error("Error saving layer:", error);
      toast.error(error.message || "Error al guardar capa en el servidor");
    }
  };

  const handleOnShapeCreated = useCallback(async (layer: any) => {
    layer.setStyle(layerStyle);
    if (isAdminView) {
      const geojson = layer.toGeoJSON();
      await saveLayerToFirestore({
        name: 'Nuevo Trazo',
        type: 'kml',
        data: geojson
      });
      layer.on('click', (e: any) => {
        L.DomEvent.stopPropagation(e);
        setSelectedMapLayer(layer);
      });
      toast.success('Trazo guardado en tiempo real');
    }
  }, [layerStyle, isAdminView]);

  const handleCoordinateFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const loadingToast = toast.loading(`Procesando Excel: ${file.name}...`);
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        const batchId = Date.now().toString();
        const batchName = file.name.replace(/\.[^/.]+$/, "");
        
        // Firestore limits batches to 500 operations
        // We'll split data into chunks of 450
        const chunkSize = 450;
        let totalCount = 0;

        for (let i = 0; i < data.length; i += chunkSize) {
          const chunk = data.slice(i, i + chunkSize);
          const fbBatch = writeBatch(db);
          let chunkCount = 0;

          chunk.forEach((row) => {
            // Precise column matching as requested
            const seccion = row.SECCION || row.Sección || row.seccion || row['-SECCION'] || 'N/A';
            const casilla = row.CASILLAS || row.Casillas || row.casilla || row['CASILLA'] || 'N/A';
            const coordsStr = row.COORDENADAS || row.Coordenadas || row.coordenadas || row['COORDENADA'];

            if (coordsStr) {
              const parts = String(coordsStr).split(',').map((s: string) => s.trim());
              if (parts.length === 2) {
                const lat = parseFloat(parts[0]);
                const lng = parseFloat(parts[1]);
                
                if (!isNaN(lat) && !isNaN(lng)) {
                  const newDocRef = doc(collection(db, 'map_layers'));
                  fbBatch.set(newDocRef, {
                    name: String(casilla),
                    seccion: String(seccion),
                    type: 'casilla',
                    coords: [lat, lng],
                    batchId,
                    sourceFile: file.name,
                    createdAt: serverTimestamp()
                  });
                  chunkCount++;
                }
              }
            }
          });

          if (chunkCount > 0) {
            await fbBatch.commit();
            totalCount += chunkCount;
          }
        }

        toast.dismiss(loadingToast);
        if (totalCount > 0) {
          toast.success(`${totalCount} casillas sincronizadas correctamente desde "${file.name}"`);
        } else {
          toast.error('No se encontraron coordenadas válidas en el archivo');
        }
        e.target.value = '';
      } catch (err) {
        console.error("Excel Error:", err);
        toast.dismiss(loadingToast);
        toast.error('Error al procesar el archivo');
        e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const removeLayer = async (layerId: string) => {
    if (!isAdminView) return;
    try {
      await deleteDoc(doc(db, 'map_layers', layerId));
      toast.success('Capa eliminada del servidor');
    } catch (e) {
      toast.error('Error al eliminar');
    }
  };

  const updatePersistedLayerStyle = (leafletLayer: any, newStyle: any) => {
    if (!isAdminView || !leafletLayer.firestoreId) return;
    
    // UI update is immediate, database update is debounced
    setLayerStyle(newStyle);

    // Clear any existing timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Debounce the update to prevent stream exhaustion
    debounceTimer.current = setTimeout(async () => {
      try {
        const layerId = leafletLayer.firestoreId;
        const layer = mapLayers.find(l => l.id === layerId);
        if (!layer || layer.type !== 'kml') return;

        const updatedData = { ...layer.data };
        
        if (updatedData.type === 'FeatureCollection') {
          const layerGeoJSON = leafletLayer.toGeoJSON();
          const index = updatedData.features.findIndex((f: any) => 
            JSON.stringify(f.geometry.coordinates) === JSON.stringify(layerGeoJSON.geometry.coordinates)
          );

          if (index !== -1) {
            updatedData.features[index].properties = {
              ...updatedData.features[index].properties,
              ...newStyle,
              stroke: newStyle.color,
              fill: newStyle.fillColor,
              'stroke-width': newStyle.weight,
              'stroke-opacity': newStyle.opacity,
              'fill-opacity': newStyle.fillOpacity
            };
          }
        } else if (updatedData.type === 'Feature') {
          updatedData.properties = {
            ...updatedData.properties,
            ...newStyle,
            stroke: newStyle.color,
            fill: newStyle.fillColor,
            'stroke-width': newStyle.weight,
            'stroke-opacity': newStyle.opacity,
            'fill-opacity': newStyle.fillOpacity
          };
        }

        const layerRef = doc(db, 'map_layers', layerId);
        const dataStr = JSON.stringify(updatedData);
        
        // Log if payload is getting close to 1MB limit
        if (dataStr.length > 800000) {
          console.warn("Layer data size is getting large:", dataStr.length);
        }

        await updateDoc(layerRef, { 
          data: dataStr 
        });
        
        console.log("Persisted layer style updated successfully");
      } catch (e) {
        console.error("Error updating style:", e);
      }
    }, 1000); // 1 second debounce
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-white group/map relative">
      {!isFullView && (
        <div className="p-3 md:p-4 border-b border-neutral-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white shrink-0">
          <div className="flex items-center justify-between w-full lg:w-auto gap-3">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="p-2 bg-red-600 text-white rounded-lg shadow-md shrink-0">
                <MapIcon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-neutral-900 text-sm md:text-base truncate leading-tight">Mapa Territorial</h4>
                <p className="text-[10px] md:text-xs text-neutral-500 font-medium truncate">
                  {isAdminView ? 'Administración' : 'Vista de Consulta'}
                </p>
              </div>
            </div>
            
            <button 
              onClick={() => window.open('/mapa-completo', '_blank')}
              className="lg:hidden flex items-center gap-1.5 bg-red-600 px-3 py-2 rounded-lg text-white font-bold text-[10px] uppercase tracking-wider hover:bg-neutral-800 transition-all shadow-sm shrink-0 animate-pulse"
              title="Abrir mapa completo"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Expandir</span>
            </button>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <button 
              onClick={() => window.open('/mapa-completo', '_blank')}
              className="hidden lg:flex items-center gap-2 bg-neutral-900 px-4 py-2.5 rounded-xl text-white font-bold text-[11px] uppercase tracking-widest hover:bg-neutral-800 transition-all shadow-md shrink-0"
              title="Ver en pantalla completa"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Ver Pantalla Completa</span>
            </button>

            {isAdminView && (
              <div className="flex items-center gap-2 flex-wrap">
                <label className="flex items-center gap-2 bg-indigo-600 px-3 py-2 rounded-xl text-white font-bold text-[10px] cursor-pointer hover:bg-indigo-700 transition-all shadow-md shrink-0 ring-4 ring-indigo-50">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Importar KML / KMZ</span>
                  <input 
                    type="file" 
                    accept=".kml,.kmz"
                    className="hidden" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      const processKml = async (kmlText: string, fileName: string) => {
                        const loadingToast = toast.loading(`Procesando capa: ${fileName}...`);
                        try {
                          const parser = new DOMParser();
                          const kmlDoc = parser.parseFromString(kmlText, "text/xml");
                          
                          // Check for parse errors
                          const parseError = kmlDoc.getElementsByTagName('parsererror')[0];
                          if (parseError) {
                            throw new Error("El archivo KML no tiene un formato XML válido.");
                          }

                          const styles = extractKmlStyles(kmlDoc);
                          const converted = toGeoJSON.kml(kmlDoc);
                          
                          if (!converted || !converted.features || converted.features.length === 0) {
                            throw new Error("No se encontraron elementos geográficos (polígonos o líneas) válidos en el archivo.");
                          }

                          converted.features.forEach((f: any) => {
                            let styleUrl = f.properties?.styleUrl;
                            if (styleUrl) {
                              styleUrl = styleUrl.startsWith('#') ? styleUrl.substring(1) : styleUrl;
                              
                              if (styles[styleUrl]) {
                                const s = styles[styleUrl];
                                // Merge properties carefully
                                f.properties = { 
                                  ...f.properties,
                                  color: s.color,
                                  fillColor: s.fillColor,
                                  weight: s.weight,
                                  opacity: s.opacity,
                                  fillOpacity: s.fillOpacity,
                                  stroke: s.color,
                                  fill: s.fillColor,
                                  'stroke-width': s.weight,
                                  'stroke-opacity': s.opacity,
                                  'fill-opacity': s.fillOpacity
                                };
                              }
                            }
                            
                            // Optimization: strip unnecessary features properties to stay under Firestore 1MB limits
                            if (f.properties) {
                              // We keep basic info + our specialized style keys
                              const allowed = ['name', 'description', 'color', 'fillColor', 'weight', 'opacity', 'fillOpacity', 'stroke', 'fill', 'stroke-width', 'stroke-opacity', 'fill-opacity'];
                              Object.keys(f.properties).forEach(key => {
                                if (!allowed.includes(key)) delete f.properties[key];
                              });
                            }
                          });

                          await saveLayerToFirestore({
                            name: fileName.replace(/\.[^/.]+$/, ""),
                            type: 'kml',
                            data: converted,
                            sourceFile: fileName
                          });
                          
                          toast.dismiss(loadingToast);
                          toast.success(`Capa "${fileName}" importada correctamente`);
                          e.target.value = ''; // Reset input
                        } catch (err: any) {
                          console.error("KML/KMZ Import Error:", err);
                          toast.dismiss(loadingToast);
                          toast.error(`Fallo al importar: ${err.message || 'Error desconocido'}`);
                          e.target.value = ''; // Reset input
                        }
                      };

                      if (file.name.toLowerCase().endsWith('.kmz')) {
                        const zip = new JSZip();
                        const extractingToast = toast.loading("Extrayendo archivo KMZ...");
                        zip.loadAsync(file).then(content => {
                          const kmlFile = Object.values(content.files).find(f => f.name.toLowerCase().endsWith('.kml'));
                          if (kmlFile) {
                            toast.dismiss(extractingToast);
                            kmlFile.async('string').then(text => processKml(text, file.name));
                          } else {
                            toast.dismiss(extractingToast);
                            toast.error('No se encontró archivo KML válido dentro del paquete KMZ');
                          }
                        }).catch(err => {
                          console.error("KMZ Extraction Error:", err);
                          toast.dismiss(extractingToast);
                          toast.error('Error al descomprimir el archivo KMZ');
                        });
                      } else {
                        const reader = new FileReader();
                        reader.onload = (evt) => {
                          const kmlText = evt.target?.result as string;
                          processKml(kmlText, file.name);
                        };
                        reader.onerror = () => toast.error("Error al leer el archivo KML");
                        reader.readAsText(file);
                      }
                    }}
                  />
                </label>
              <label className="flex items-center gap-2 bg-indigo-50 px-3 py-2 rounded-xl text-indigo-700 font-bold text-[10px] cursor-pointer hover:bg-indigo-100 transition-all border border-indigo-100 shrink-0">
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Excel</span>
                <input 
                  type="file" 
                  accept=".xlsx,.xls,.csv"
                  className="hidden" 
                  onChange={handleCoordinateFileUpload}
                />
              </label>
                <button 
                  onClick={() => setShowBatchManager(true)}
                  className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl text-indigo-600 font-bold text-[10px] transition-all border border-indigo-100 hover:border-indigo-600 shrink-0 shadow-sm"
                  title="Gestionar archivos cargados"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>Gestionar Archivos</span>
                </button>
              <button 
                onClick={async () => {
                  const lat = window.prompt("Latitud:", mapCenter[0].toString());
                  const lng = window.prompt("Longitud:", mapCenter[1].toString());
                  const name = window.prompt("Nombre del Marcador:", "Nuevo Punto");
                  if (lat && lng && name) {
                    await saveLayerToFirestore({
                      name,
                      type: 'marker',
                      coords: [parseFloat(lat), parseFloat(lng)]
                    });
                  }
                }}
                className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl text-neutral-700 font-bold text-[10px] transition-all border border-neutral-200 hover:border-indigo-600 shrink-0"
              >
                <MapPin className="w-3.5 h-3.5 text-red-500" />
                <span>Marcador</span>
              </button>
              <button 
                onClick={async () => {
                  if (window.confirm("¿Estás seguro de que deseas limpiar todas las capas del servidor?")) {
                    const batch = writeBatch(db);
                    mapLayers.forEach(l => {
                      batch.delete(doc(db, 'map_layers', l.id));
                    });
                    await batch.commit();
                    toast.success('Todas las capas han sido eliminadas');
                  }
                }}
                className="p-2 text-neutral-400 hover:text-red-500 transition-all shrink-0"
                title="Limpiar Capas"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden relative min-h-0 bg-neutral-100">
        {!isAdminView && !window.location.pathname.startsWith('/mapa-completo') && (
          <div className="absolute inset-0 z-[1002] flex items-center justify-center opacity-0 group-hover/map:opacity-100 transition-all duration-300 pointer-events-none">
            <div className="bg-neutral-900/90 backdrop-blur-md px-6 py-4 rounded-3xl shadow-2xl border border-white/20 transform translate-y-4 group-hover/map:translate-y-0 transition-all duration-300 pointer-events-auto">
              <button 
                onClick={() => window.open('/mapa-completo', '_blank')}
                className="flex flex-col items-center gap-3 text-white"
              >
                <div className="p-3 bg-red-600 rounded-2xl shadow-lg ring-4 ring-white/10 animate-bounce">
                  <ExternalLink className="w-6 h-6" />
                </div>
                <div className="text-center">
                  <span className="block font-black text-sm uppercase tracking-[0.2em]">Mapa Interactivo</span>
                  <span className="text-[10px] text-neutral-400 font-medium">Click para ver en pantalla completa</span>
                </div>
              </button>
            </div>
          </div>
        )}

        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[500] w-full max-w-xl px-4 hidden sm:block">
          <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-white p-2 flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 px-3 border-r border-neutral-200">
              <SearchIcon className="w-4 h-4 text-neutral-400" />
              <input 
                type="text" 
                placeholder="Sección (Exacta)..." 
                className="bg-transparent border-none focus:ring-0 text-xs font-bold text-neutral-800 placeholder:text-neutral-400 w-full"
                value={searchSeccion}
                onChange={(e) => {
                  setSearchSeccion(e.target.value);
                  setSearchCasilla(''); // Clear casilla when seccion changes
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <div className="flex-1 flex items-center gap-2 px-3 border-r border-neutral-200">
              {availableCasillas.length > 0 ? (
                <select 
                  className="bg-transparent border-none focus:ring-0 text-xs font-bold text-neutral-800 w-full cursor-pointer appearance-none"
                  value={searchCasilla}
                  onChange={(e) => setSearchCasilla(e.target.value)}
                >
                  <option value="">Seleccionar Casilla...</option>
                  {availableCasillas.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              ) : (
                <input 
                  type="text" 
                  placeholder="Casilla (Exacta)..." 
                  className="bg-transparent border-none focus:ring-0 text-xs font-bold text-neutral-800 placeholder:text-neutral-400 w-full"
                  value={searchCasilla}
                  onChange={(e) => setSearchCasilla(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  disabled={!searchSeccion}
                />
              )}
            </div>
            {(searchSeccion || searchCasilla) && (
              <button 
                onClick={() => {
                  setSearchSeccion('');
                  setSearchCasilla('');
                  setFlyToTarget(null);
                }}
                className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-red-500 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button 
              onClick={handleSearch}
              className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-xl text-white flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-red-100"
            >
              <Search className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">Buscar</span>
            </button>
          </div>
        </div>

        {!isFullView && isAdminView && (
          <div className="w-64 bg-neutral-50 border-r border-neutral-100 overflow-y-auto p-4 space-y-4 hidden lg:block">
            <h5 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Capas Activas</h5>
            <div className="space-y-2">
              {mapLayers.length === 0 && (
                <p className="text-[10px] text-neutral-400 italic">No hay capas sincronizadas</p>
              )}
              {mapLayers.map((layer: any) => (
                <div key={layer.id} className="bg-white p-3 rounded-xl border border-neutral-200 shadow-sm flex items-center justify-between group">
                  <div className="flex items-center gap-2 min-w-0">
                    {layer.type === 'kml' ? (
                      <Box className="w-3 h-3 text-indigo-500" />
                    ) : layer.type === 'casilla' ? (
                      <FileSpreadsheet className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <MapPin className="w-3 h-3 text-red-500" />
                    )}
                    <span className="text-[11px] font-bold text-neutral-700 truncate">{layer.name}</span>
                  </div>
                  {isAdminView && (
                    <button 
                      onClick={() => removeLayer(layer.id)}
                      className="p-1 text-neutral-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-neutral-200">
              <h5 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-3">Estadística Territorial</h5>
              <div className="bg-white p-3 rounded-xl border border-neutral-200 text-center">
                <p className="text-xl font-black text-neutral-900">{geoRegistrations.length}</p>
                <p className="text-[9px] text-neutral-500 font-bold uppercase">Georreferenciados</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 relative z-10 bg-neutral-200">
          <MapContainer 
            center={mapCenter as any} 
            zoom={mapZoom} 
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            
            {isAdminView && (
              <GeomanControls 
                onShapeCreated={handleOnShapeCreated} 
              />
            )}

            {flyToTarget && (
              <MapFlyTo center={flyToTarget} />
            )}

            {filteredLayers.filter((l: any) => l.type === 'kml').map((layer: any) => (
              <MemoizedGeoJSONLayer 
                key={layer.id} 
                layer={layer} 
                isAdminView={isAdminView}
                onSelect={(leafletLayer) => {
                  setSelectedMapLayer(leafletLayer);
                }}
              />
            ))}

            {filteredLayers.filter((l: any) => l.type === 'marker').map((layer: any) => (
              <Marker key={layer.id} position={layer.coords as any}>
                <Popup>
                  <div className="p-1">
                    <p className="font-bold text-neutral-900">{layer.name}</p>
                  </div>
                </Popup>
              </Marker>
            ))}

            {filteredLayers.filter((l: any) => l.type === 'casilla').map((layer: any) => (
              <Marker 
                key={layer.id} 
                position={layer.coords as any}
                icon={L.divIcon({
                  className: 'bg-transparent',
                  html: `<div class="bg-white border-2 border-red-500 rounded-md px-2 py-1 shadow-lg flex items-center justify-center min-w-[40px]">
                          <span class="text-[9px] font-black text-red-600 whitespace-nowrap">${layer.name}</span>
                         </div>`,
                  iconSize: [0, 0],
                  iconAnchor: [20, 10]
                })}
              >
                <Popup>
                  <div className="p-2 min-w-[150px]">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                        <Box className="w-4 h-4 text-red-600" />
                      </div>
                      <h4 className="font-black text-xs text-neutral-900 m-0 uppercase tracking-tight">CASILLA: {layer.name}</h4>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-black">Sección Territorial</p>
                      <div className="bg-neutral-50 p-2 rounded-lg border border-neutral-100">
                        <span className="text-xs font-bold text-neutral-700">{layer.seccion}</span>
                      </div>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

            <MapRegistrations registrations={filteredRegistrations} />
          </MapContainer>

          {selectedMapLayer && isAdminView && (
            <LayerStyleEditor 
              selectedLayer={selectedMapLayer}
              onClose={() => setSelectedMapLayer(null)}
              onStyleChange={(newStyle) => {
                updatePersistedLayerStyle(selectedMapLayer, newStyle);
              }}
            />
          )}

          {showBatchManager && (
            <BatchDataManager 
              layers={mapLayers} 
              onClose={() => setShowBatchManager(false)} 
            />
          )}
        </div>
      </div>
    </div>
  );
}
