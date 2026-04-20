import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, FileText, Download, FileSpreadsheet, ExternalLink, User, Calendar, Image as ImageIcon, Video, Link as LinkIcon, X, Maximize2, Phone, CreditCard } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, getDocs, limit, doc, onSnapshot } from 'firebase/firestore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';

export default function SectionDetail() {
  const { sectionId } = useParams();
  const [section, setSection] = useState<any>(null);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    if (!sectionId) return;

    // Fetch Section Data
    const unsubSection = onSnapshot(doc(db, 'sections', sectionId), (snap) => {
      if (snap.exists()) {
        setSection({ id: snap.id, ...snap.data() });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `sections/${sectionId}`);
    });

    // Fetch All Registrations for this section
    const q = query(
      collection(db, 'registrations'),
      where('sectionId', '==', sectionId)
    );
    
    const unsubRegs = onSnapshot(q, (snap) => {
      setRegistrations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'registrations');
      setLoading(false);
    });

    return () => {
      unsubSection();
      unsubRegs();
    };
  }, [sectionId]);

  if (!section) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-neutral-900">Sección no encontrada</h2>
        <Link to="/sections" className="text-indigo-600 hover:underline mt-4 inline-block">Volver al listado</Link>
      </div>
    );
  }

  // Group registrations by casilla
  const regsByCasilla = registrations.reduce((acc: any, reg) => {
    acc[reg.casilla] = reg;
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <Link to="/sections" className="inline-flex items-center gap-2 text-neutral-500 hover:text-indigo-600 transition-colors font-medium">
        <ArrowLeft className="w-4 h-4" />
        Volver a Secciones
      </Link>

      <div className="bg-white p-8 rounded-3xl border border-neutral-200 shadow-sm">
        <div className="mb-10 flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full mb-3 inline-block">
              Detalle de Territorio
            </span>
            <h2 className="text-4xl font-black text-neutral-900 mb-3">Sección {section.name}</h2>
            <p className="text-neutral-500 max-w-xl">{section.description || 'Esta sección agrupa múltiples casillas electorales para la coordinación de responsables.'}</p>
          </div>

          <div className="flex items-center gap-6 bg-neutral-50 p-6 rounded-[2rem] border border-neutral-100">
            <div className="text-center px-4 border-r border-neutral-200">
              <span className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">Total Casillas</span>
              <span className="text-2xl font-black text-neutral-900">{section.casillas?.length || 1}</span>
            </div>
            <div className="text-center px-4">
              <span className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">Responsables</span>
              <span className="text-2xl font-black text-emerald-600">
                {new Set(registrations.map(r => r.casilla)).size}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* Casillas Status List */}
          <section className="space-y-4">
            <h3 className="text-sm font-black text-neutral-900 uppercase tracking-widest flex items-center gap-2 mb-6">
              <div className="w-1.5 h-6 bg-indigo-600 rounded-full" />
              Estado de Casillas en Sección {section.name}
            </h3>
            
            <div className="grid grid-cols-1 gap-4">
              {(section.casillas || ['Única']).map((casillaName: string, idx: number) => {
                const reg = regsByCasilla[casillaName];
                const isCovered = !!reg;

                return (
                  <motion.div 
                    key={`${casillaName}-${idx}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`relative p-6 rounded-[2rem] border-2 transition-all overflow-hidden ${
                      isCovered 
                        ? 'bg-emerald-50/30 border-emerald-100 hover:border-emerald-200 shadow-sm shadow-emerald-50' 
                        : 'bg-red-50/30 border-red-100 hover:border-red-200 shadow-sm shadow-red-50'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                      <div className="flex items-center gap-5">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm ${
                          isCovered ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
                        }`}>
                          <User className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Casilla</span>
                            <span className="font-black text-neutral-900 text-lg uppercase">{casillaName}</span>
                          </div>
                          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest w-fit ${
                            isCovered ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {isCovered ? 'Cubierta / Asignada' : 'Pendiente / Sin Responsable'}
                          </div>
                        </div>
                      </div>

                      {isCovered ? (
                        <div className="flex-1 lg:max-w-md grid grid-cols-1 sm:grid-cols-2 gap-6 bg-white/60 backdrop-blur p-4 rounded-2xl border border-emerald-100/50">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">Nombre Responsable</p>
                            <p className="font-bold text-neutral-900 truncate">{reg.personName}</p>
                            <div className="flex items-center gap-2 mt-2 text-xs text-neutral-500">
                              <Phone className="w-3 h-3" />
                              <span>{reg.phoneNumber}</span>
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">Fecha Registro</p>
                            <div className="flex items-center gap-2 text-xs text-neutral-600 font-medium">
                              <Calendar className="w-3 h-3" />
                              <span>{reg.createdAt?.toDate ? format(reg.createdAt.toDate(), "dd 'de' MMM, yyyy", { locale: es }) : 'Recientemente'}</span>
                            </div>
                            <p className="text-[9px] text-indigo-400 font-bold uppercase mt-2">Por: {reg.responsibleEmail}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center justify-center lg:justify-end">
                          <p className="text-sm font-bold text-red-300 italic">No se ha registrado información todavía.</p>
                        </div>
                      )}
                    </div>

                    {isCovered && (reg.ineFrontUrl || reg.ineBackUrl) && (
                      <div className="mt-6 pt-6 border-t border-emerald-100/50 flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                        {reg.ineFrontUrl && (
                          <button 
                            onClick={() => setSelectedImage(reg.ineFrontUrl)}
                            className="relative flex-shrink-0 w-32 aspect-video rounded-xl overflow-hidden border border-emerald-200 group/img"
                          >
                            <img src={reg.ineFrontUrl} alt="" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-emerald-900/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                              <Maximize2 className="w-4 h-4 text-white" />
                            </div>
                            <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-white/90 text-[8px] font-black uppercase rounded">Frontal</span>
                          </button>
                        )}
                        {reg.ineBackUrl && (
                          <button 
                            onClick={() => setSelectedImage(reg.ineBackUrl)}
                            className="relative flex-shrink-0 w-32 aspect-video rounded-xl overflow-hidden border border-emerald-200 group/img"
                          >
                            <img src={reg.ineBackUrl} alt="" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-emerald-900/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                              <Maximize2 className="w-4 h-4 text-white" />
                            </div>
                            <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-white/90 text-[8px] font-black uppercase rounded">Reversa</span>
                          </button>
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </section>

          {/* Library Section */}
          <div className="space-y-4 pt-10 border-t border-neutral-100">
            <h3 className="text-sm font-black text-neutral-400 uppercase tracking-widest flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              Biblioteca de Archivos Compartidos
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(section.files || []).map((file: any, index: number) => (
                <div 
                  key={index}
                  className="flex items-center justify-between p-5 rounded-2xl bg-neutral-50 border border-neutral-100 group hover:bg-white hover:border-indigo-200 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 ${
                      file.type === 'pdf' ? 'bg-red-50 text-red-600' : 
                      file.type === 'excel' ? 'bg-emerald-50 text-emerald-600' :
                      file.type === 'image' ? 'bg-blue-50 text-blue-600' :
                      file.type === 'video' ? 'bg-purple-50 text-purple-600' :
                      'bg-neutral-100 text-neutral-600'
                    }`}>
                      {file.type === 'image' && file.url ? (
                        <img src={file.url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <>
                          {file.type === 'pdf' && <FileText className="w-7 h-7" />}
                          {file.type === 'excel' && <FileSpreadsheet className="w-7 h-7" />}
                          {file.type === 'image' && <ImageIcon className="w-7 h-7" />}
                          {file.type === 'video' && <Video className="w-7 h-7" />}
                          {file.type === 'link' && <LinkIcon className="w-7 h-7" />}
                        </>
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-neutral-800">{file.name}</p>
                      <p className="text-xs text-neutral-500 uppercase font-bold tracking-wider">{file.type}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {file.type === 'image' && file.url ? (
                      <button 
                        onClick={() => setSelectedImage(file.url)}
                        className="p-2 text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        title="Ver Imagen"
                      >
                        <Maximize2 className="w-5 h-5" />
                      </button>
                    ) : (
                      <a 
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        title="Abrir"
                      >
                        <ExternalLink className="w-5 h-5" />
                      </a>
                    )}
                    <a 
                      href={file.url}
                      download={file.name}
                      className="p-2 text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                      title="Descargar"
                    >
                      <Download className="w-5 h-5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10 bg-neutral-900/90 backdrop-blur-sm"
            onClick={() => setSelectedImage(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-full max-h-full flex items-center justify-center"
              onClick={e => e.stopPropagation()}
            >
              <button 
                onClick={() => setSelectedImage(null)}
                className="absolute -top-12 right-0 p-2 text-white hover:text-indigo-400 transition-colors bg-white/10 rounded-full backdrop-blur-md"
              >
                <X className="w-6 h-6" />
              </button>
              <img 
                src={selectedImage} 
                alt="Vista Previa" 
                className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl object-contain border-4 border-white/10"
                referrerPolicy="no-referrer"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-indigo-900 rounded-3xl p-10 text-white relative overflow-hidden">
        <div className="relative z-10 max-w-lg">
          <h3 className="text-2xl font-bold mb-4">¿Necesitas ayuda con esta sección?</h3>
          <p className="text-indigo-100 mb-6">Si no encuentras el archivo que buscas o necesitas reportar un error en la información, contacta al administrador.</p>
          <a 
            href={`https://wa.me/524434008893?text=${encodeURIComponent('Hola Hugo César, necesito ayuda...')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-white text-indigo-900 font-bold py-3 px-8 rounded-xl hover:bg-indigo-50 transition-all"
          >
            Contactar Soporte
          </a>
        </div>
        <div className="absolute right-0 bottom-0 opacity-10 translate-x-1/4 translate-y-1/4">
          <FileText className="w-64 h-64" />
        </div>
      </div>
    </div>
  );
}
