import React, { useState } from 'react';
import { useGlobalState } from '../contexts/GlobalStateContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Upload, CheckCircle2, AlertCircle, Clock, X, FileText, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Evidence() {
  const { userProfile, settings } = useGlobalState();
  const [image, setImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [lastEvidence, setLastEvidence] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [checkingStatus, setCheckingStatus] = useState(true);

  // Fetch all evidence history
  React.useEffect(() => {
    if (!userProfile?.id) return;

    const fetchHistory = async () => {
      try {
        const q = query(
          collection(db, 'evidence'),
          where('userId', '==', userProfile.id),
          orderBy('timestamp', 'desc')
        );
        const snapshot = await getDocs(q);
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
        setHistory(docs);

        // Also identify if there's one for the current period
        if (settings?.evidenceStartDate && settings?.evidenceEndDate) {
          const current = docs.find(e => 
            e.periodStart === settings.evidenceStartDate && 
            e.periodEnd === settings.evidenceEndDate
          );
          setLastEvidence(current || null);
        } else {
          setLastEvidence(docs[0] || null);
        }
      } catch (error) {
        console.error("Error fetching history:", error);
      } finally {
        setCheckingStatus(false);
      }
    };

    fetchHistory();
  }, [userProfile?.id, settings?.evidenceStartDate, settings?.evidenceEndDate]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor selecciona un archivo de imagen');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        setImage(base64);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!image) {
      toast.error('Selecciona una imagen primero');
      return;
    }

    // Check global toggle
    if (!settings?.evidenceEnabled && userProfile?.role !== 'admin') {
      toast.error('La carga de evidencia está deshabilitada por el administrador.');
      return;
    }

    // Check if they already uploaded for this specific period
    if (lastEvidence && lastEvidence.periodStart === settings.evidenceStartDate && lastEvidence.periodEnd === settings.evidenceEndDate) {
      toast.error('Ya has subido evidencia para este periodo.');
      return;
    }

    setIsUploading(true);
    try {
      const periodStart = settings.evidenceStartDate;
      const periodEnd = settings.evidenceEndDate;

      const docRef = await addDoc(collection(db, 'evidence'), {
        userId: userProfile.id,
        userEmail: userProfile.email,
        userName: userProfile.displayName || userProfile.email,
        imageUrl: image,
        timestamp: serverTimestamp(),
        status: 'pending',
        periodStart,
        periodEnd,
        feedback: ''
      });

      toast.success('Evidencia subida correctamente');
      setImage(null);
      
      // Update local state to show the new submission
      const newEvidence = {
        id: docRef.id,
        userId: userProfile.id,
        userEmail: userProfile.email,
        userName: userProfile.displayName || userProfile.email,
        imageUrl: image,
        status: 'pending',
        periodStart,
        periodEnd,
        feedback: '',
        timestamp: new Date()
      };
      setLastEvidence(newEvidence);
      setHistory(prev => [newEvidence, ...prev]);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'evidence');
      toast.error('Error al subir la evidencia');
    } finally {
      setIsUploading(false);
    }
  };

  const isDateInRange = () => {
    if (!settings?.evidenceStartDate || !settings?.evidenceEndDate) return true;
    const now = new Date();
    // Use local date comparison
    const today = format(now, 'yyyy-MM-dd');
    return today >= settings.evidenceStartDate && today <= settings.evidenceEndDate;
  };

  const canUpload = userProfile?.role === 'admin' || (settings?.evidenceEnabled && isDateInRange());

  if (checkingStatus) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-indigo-600 rounded-[2.5rem] p-8 md:p-12 text-white relative overflow-hidden shadow-2xl shadow-indigo-100">
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-6">
            <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
              <Camera className="w-8 h-8" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight">Carga de Evidencia</h2>
          </div>
          <p className="text-indigo-100 text-lg max-w-2xl font-medium leading-relaxed">
            SUBIR UNA CAPTURA DE LOS PROGRAMAS SOCIALES COMPARTIDOS
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <div className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-2 ${canUpload ? 'bg-emerald-500/20 text-emerald-100 border border-emerald-500/30' : 'bg-red-500/20 text-red-100 border border-red-500/30'}`}>
              {canUpload ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  {userProfile?.role === 'admin' ? 'Habilitado (Admin)' : 'Habilitado para Carga'}
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4" />
                  {!settings?.evidenceEnabled ? 'Carga Deshabilitada' : 'Fuera de Fecha'}
                </>
              )}
            </div>
            {settings?.evidenceStartDate && settings?.evidenceEndDate && (
              <div className="px-4 py-2 bg-white/10 rounded-full text-[10px] font-bold uppercase tracking-widest border border-white/20">
                Periodo: {format(new Date(settings.evidenceStartDate + 'T12:00:00'), 'dd/MM/yy')} - {format(new Date(settings.evidenceEndDate + 'T12:00:00'), 'dd/MM/yy')}
              </div>
            )}
          </div>
        </div>
        <div className="absolute right-0 bottom-0 opacity-10 translate-x-1/4 translate-y-1/4">
          <ImageIcon className="w-64 h-64" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-3xl border border-neutral-200 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-50 p-2 rounded-lg">
              <Upload className="text-indigo-600 w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-neutral-900">Nueva Captura</h3>
          </div>

          {!canUpload ? (
            <div className="p-6 bg-red-50 rounded-2xl border border-red-100 text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
              <p className="text-red-700 font-bold">Carga no disponible en este momento</p>
              <p className="text-red-500 text-sm">El administrador habilitará esta opción periódicamente.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="relative group">
                  {image ? (
                    <div className="relative aspect-square rounded-3xl overflow-hidden border-4 border-indigo-100 bg-neutral-100">
                      <img src={image} alt="Evidencia" className="w-full h-full object-cover" />
                      <button 
                        type="button"
                        onClick={() => setImage(null)}
                        className="absolute top-4 right-4 p-2 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center aspect-square rounded-3xl border-4 border-dashed border-neutral-100 bg-neutral-50 hover:bg-neutral-100 hover:border-indigo-400 transition-all cursor-pointer group">
                      <Camera className="w-12 h-12 text-neutral-300 group-hover:text-indigo-600 mb-4" />
                      <span className="text-lg font-bold text-neutral-500 group-hover:text-indigo-600">Toma una foto o selecciona una imagen</span>
                      <p className="text-sm text-neutral-400 mt-2 px-8 text-center italic">Asegúrate de que la captura sea legible y muestre claramente el programa social compartido.</p>
                      <input type="file" accept="image/*" className="hidden" required onChange={handleImageChange} />
                    </label>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={isUploading || !image}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-5 px-10 rounded-2xl transition-all shadow-xl shadow-indigo-100 disabled:opacity-50 active:scale-[0.98] uppercase tracking-widest text-sm flex items-center justify-center gap-3"
              >
                {isUploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Subiendo...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    Enviar Evidencia
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-neutral-200 shadow-sm flex flex-col h-full">
            <div className="flex items-center gap-3 mb-8">
              <div className="bg-amber-50 p-2 rounded-lg">
                <Clock className="text-amber-600 w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-neutral-900">Estado de Último Envío</h3>
            </div>

            {lastEvidence ? (
              <div className="space-y-6 flex-1">
                <div className="aspect-video rounded-2xl overflow-hidden border border-neutral-100 bg-neutral-50 shadow-inner group relative">
                  <img src={lastEvidence.imageUrl} alt="Última evidencia" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                    <p className="text-[10px] text-white/80 font-medium">Captura del periodo actual</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                    <div>
                      <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Estado de Revisión</p>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full animate-pulse ${
                          lastEvidence.status === 'pending' ? 'bg-amber-500' : 
                          lastEvidence.status === 'approved' ? 'bg-emerald-500' : 'bg-red-500'
                        }`} />
                        <p className={`font-black text-sm uppercase tracking-tight ${
                          lastEvidence.status === 'pending' ? 'text-amber-700' : 
                          lastEvidence.status === 'approved' ? 'text-emerald-700' : 'text-red-700'
                        }`}>
                          {lastEvidence.status === 'pending' && 'Pendiente de Revisión'}
                          {lastEvidence.status === 'approved' && 'Evidencia Aprobada'}
                          {lastEvidence.status === 'rejected' && 'Evidencia Rechazada'}
                        </p>
                      </div>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl shadow-sm">
                      {lastEvidence.status === 'approved' ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      ) : lastEvidence.status === 'rejected' ? (
                        <X className="w-5 h-5 text-red-500" />
                      ) : (
                        <Clock className="w-5 h-5 text-amber-500" />
                      )}
                    </div>
                  </div>

                  {lastEvidence.feedback && (
                    <div className={`p-5 rounded-2xl border ${
                      lastEvidence.status === 'rejected' ? 'bg-red-50 border-red-100' : 'bg-indigo-50 border-indigo-100'
                    }`}>
                      <div className="flex items-start gap-4">
                        <FileText className={`w-5 h-5 mt-1 ${lastEvidence.status === 'rejected' ? 'text-red-500' : 'text-indigo-500'}`} />
                        <div>
                          <p className={`text-sm font-bold mb-1 ${lastEvidence.status === 'rejected' ? 'text-red-900' : 'text-indigo-900'}`}>
                            Retroalimentación del Administrador
                          </p>
                          <p className={`text-xs leading-relaxed ${lastEvidence.status === 'rejected' ? 'text-red-600' : 'text-indigo-600'}`}>
                            "{lastEvidence.feedback}"
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {!lastEvidence.feedback && (
                    <div className="p-5 bg-neutral-50 rounded-2xl border border-neutral-100">
                      <div className="flex items-start gap-4">
                        <FileText className="w-5 h-5 text-neutral-400 mt-1" />
                        <div>
                          <p className="text-sm font-bold text-neutral-700 mb-1">Sin observaciones aún</p>
                          <p className="text-xs text-neutral-500 leading-relaxed">
                            Tu captura ha sido recibida. El administrador aún no ha dejado comentarios de evaluación.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-10 border-2 border-dashed border-neutral-100 rounded-3xl">
                <ImageIcon className="w-16 h-16 text-neutral-100 mb-4" />
                <p className="text-neutral-400 font-medium">Aún no has subido ninguna evidencia de programas compartidos.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Historial Section */}
      <div className="bg-white p-8 rounded-3xl border border-neutral-200 shadow-sm space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-50 p-2 rounded-lg">
              <Clock className="text-indigo-600 w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-neutral-900">Historial de Evidencias</h3>
          </div>
          <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">{history.length} Entregas totales</p>
        </div>

        {history.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {history.map((item) => (
              <div key={item.id} className="group relative bg-neutral-50 rounded-2xl overflow-hidden border border-neutral-100 hover:shadow-xl transition-all duration-300">
                <div className="aspect-[4/3] relative overflow-hidden">
                  <img 
                    src={item.imageUrl} 
                    alt="Evidencia histórica" 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                  />
                  <div className={`absolute top-3 left-3 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border backdrop-blur-md shadow-sm z-10 ${
                    item.status === 'approved' ? 'bg-emerald-500/80 border-emerald-400 text-white' :
                    item.status === 'rejected' ? 'bg-red-500/80 border-red-400 text-white' :
                    'bg-amber-500/80 border-amber-400 text-white'
                  }`}>
                    {item.status === 'approved' ? 'Aprobada' : 
                     item.status === 'rejected' ? 'Rechazada' : 'Pendiente'}
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                      {item.timestamp?.toDate ? format(item.timestamp.toDate(), 'dd MMM yyyy', { locale: es }) : 'Reciente'}
                    </p>
                    {item.feedback && (
                      <div title="Tiene comentarios" className="p-1 bg-indigo-100 rounded-md">
                        <FileText className="w-3 h-3 text-indigo-600" />
                      </div>
                    )}
                  </div>
                  {item.periodStart && item.periodEnd && (
                    <p className="text-[9px] text-neutral-500 font-medium italic">
                      Periodo: {format(new Date(item.periodStart + 'T12:00:00'), 'dd/MM')} - {format(new Date(item.periodEnd + 'T12:00:00'), 'dd/MM')}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 border-2 border-dashed border-neutral-100 rounded-2xl">
            <Clock className="w-12 h-12 text-neutral-100" />
            <div>
              <p className="text-neutral-400 font-bold">No hay entregas registradas anteriormente</p>
              <p className="text-neutral-300 text-xs mt-1">Tus evidencias aparecerán aquí conforme las vayas subiendo.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
