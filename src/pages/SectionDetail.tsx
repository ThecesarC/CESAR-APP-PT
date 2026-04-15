import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, FileText, Download, FileSpreadsheet, ExternalLink, User, Calendar, Image as ImageIcon, Video, Link as LinkIcon, X, Maximize2, Phone, CreditCard } from 'lucide-react';
import { db, handleFirestoreError, OperationType, isQuotaError } from '../firebase';
import { collection, query, where, getDocs, limit, doc, onSnapshot } from 'firebase/firestore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';

export default function SectionDetail() {
  const { sectionId } = useParams();
  const [responsible, setResponsible] = useState<any>(null);
  const [section, setSection] = useState<any>(null);
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
      if (!isQuotaError(error)) {
        handleFirestoreError(error, OperationType.GET, `sections/${sectionId}`);
      }
    });

    async function fetchResponsible() {
      try {
        const q = query(
          collection(db, 'registrations'),
          where('sectionId', '==', sectionId),
          limit(1)
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          setResponsible(querySnapshot.docs[0].data());
        }
      } catch (error: any) {
        if (!isQuotaError(error)) {
          handleFirestoreError(error, OperationType.GET, 'registrations');
        }
      } finally {
        setLoading(false);
      }
    }

    fetchResponsible();
    return () => unsubSection();
  }, [sectionId]);

  if (!section) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-neutral-900">Sección no encontrada</h2>
        <Link to="/sections" className="text-indigo-600 hover:underline mt-4 inline-block">Volver al listado</Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Link to="/sections" className="inline-flex items-center gap-2 text-neutral-500 hover:text-indigo-600 transition-colors font-medium">
        <ArrowLeft className="w-4 h-4" />
        Volver a Secciones
      </Link>

      <div className="bg-white p-8 rounded-3xl border border-neutral-200 shadow-sm">
        <div className="mb-8 flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div>
            <h2 className="text-3xl font-bold text-neutral-900 mb-2">{section.name}</h2>
            <p className="text-neutral-500">{section.description}</p>
          </div>

          {responsible ? (
            <div className="bg-indigo-50 border border-indigo-100 p-5 rounded-2xl flex items-center gap-4 w-full md:min-w-[300px] md:w-auto">
              <div className="bg-indigo-600 p-3 rounded-xl text-white flex-shrink-0">
                <User className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase font-bold text-indigo-400 tracking-widest mb-1">Responsable Asignado</p>
                <p className="font-bold text-neutral-900 text-lg leading-tight truncate">{responsible.personName}</p>
                <div className="flex flex-col gap-1 mt-2">
                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                    <Calendar className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">Registrado el {responsible.createdAt?.toDate ? format(responsible.createdAt.toDate(), 'dd MMM yyyy', { locale: es }) : 'Recientemente'}</span>
                  </div>
                  {responsible.phoneNumber && (
                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                      <Phone className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{responsible.phoneNumber}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-[10px] text-indigo-600 font-medium">
                    <span className="truncate">Asignado por: {responsible.responsibleEmail}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : !loading && (
            <div className="bg-amber-50 border border-amber-100 p-5 rounded-2xl flex items-center gap-4 w-full md:min-w-[300px] md:w-auto">
              <div className="bg-amber-500 p-3 rounded-xl text-white flex-shrink-0">
                <User className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase font-bold text-amber-600 tracking-widest mb-1">Estado</p>
                <p className="font-bold text-neutral-900 truncate">Sin responsable asignado</p>
                <p className="text-xs text-neutral-500 mt-1">Pendiente de registro en el panel.</p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {responsible && (responsible.ineFrontUrl || responsible.ineBackUrl) && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Documentación INE
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {responsible.ineFrontUrl && (
                  <div className="relative group aspect-video rounded-2xl overflow-hidden border border-neutral-200 bg-neutral-50">
                    <img 
                      src={responsible.ineFrontUrl} 
                      alt="INE Frontal" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button 
                        onClick={() => setSelectedImage(responsible.ineFrontUrl)}
                        className="p-3 bg-white text-indigo-600 rounded-xl shadow-xl transform scale-90 group-hover:scale-100 transition-transform"
                      >
                        <Maximize2 className="w-6 h-6" />
                      </button>
                    </div>
                    <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur px-3 py-1 rounded-lg text-[10px] font-bold text-neutral-900 uppercase tracking-wider shadow-sm">
                      INE Frontal
                    </div>
                  </div>
                )}
                {responsible.ineBackUrl && (
                  <div className="relative group aspect-video rounded-2xl overflow-hidden border border-neutral-200 bg-neutral-50">
                    <img 
                      src={responsible.ineBackUrl} 
                      alt="INE Reverso" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button 
                        onClick={() => setSelectedImage(responsible.ineBackUrl)}
                        className="p-3 bg-white text-indigo-600 rounded-xl shadow-xl transform scale-90 group-hover:scale-100 transition-transform"
                      >
                        <Maximize2 className="w-6 h-6" />
                      </button>
                    </div>
                    <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur px-3 py-1 rounded-lg text-[10px] font-bold text-neutral-900 uppercase tracking-wider shadow-sm">
                      INE Reverso
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest">Biblioteca de Archivos</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {section.files.map((file: any, index: number) => (
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
