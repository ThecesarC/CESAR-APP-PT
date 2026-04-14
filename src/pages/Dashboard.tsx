import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, limit, where, getDocs, doc } from 'firebase/firestore';
import { toast } from 'sonner';
import { UserPlus, History, User as UserIcon, MapPin, Phone, Camera, X } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Dashboard({ user, isAdmin }: { user: any, isAdmin: boolean }) {
  const [personName, setPersonName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [ineFront, setIneFront] = useState<string | null>(null);
  const [ineBack, setIneBack] = useState<string | null>(null);
  const [sectionId, setSectionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [recentRegistrations, setRecentRegistrations] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [dashboardOrder, setDashboardOrder] = useState(['welcome', 'form', 'activity']);

  useEffect(() => {
    // Fetch Global Settings for dashboard order
    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (d) => {
      if (d.exists() && d.data().dashboardOrder) {
        setDashboardOrder(d.data().dashboardOrder);
      }
    });

    // Fetch Sections for dropdown
    const qSections = query(collection(db, 'sections'), orderBy('order', 'asc'));
    const unsubSections = onSnapshot(qSections, (snap) => {
      setSections(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sections');
    });

    const q = query(
      collection(db, 'registrations'),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const regs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRecentRegistrations(regs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'registrations');
    });

    return () => {
      unsubSettings();
      unsubSections();
      unsubscribe();
    };
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') => {
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
        if (side === 'front') setIneFront(base64);
        else setIneBack(base64);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personName || !sectionId || !phoneNumber) {
      toast.error('Por favor completa los campos obligatorios');
      return;
    }

    if (!ineFront || !ineBack) {
      toast.error('Por favor carga ambas fotos de la INE');
      return;
    }

    setLoading(true);
    const section = sections.find(s => s.id === sectionId);

    try {
      // Check if section already has a responsible
      const q = query(
        collection(db, 'registrations'),
        where('sectionId', '==', sectionId),
        limit(1)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const existingData = querySnapshot.docs[0].data();
        toast.error(`Esta seccion ya cuenta con un responsable: ${existingData.personName}`);
        setLoading(false);
        return;
      }

      await addDoc(collection(db, 'registrations'), {
        personName,
        phoneNumber,
        ineFrontUrl: ineFront,
        ineBackUrl: ineBack,
        sectionId,
        sectionName: section?.name || 'Desconocida',
        responsibleId: user.uid,
        responsibleEmail: user.email,
        createdAt: serverTimestamp()
      });

      toast.success('Registro exitoso');
      setPersonName('');
      setPhoneNumber('');
      setIneFront(null);
      setIneBack(null);
      setSectionId('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'registrations');
      toast.error('Error al guardar el registro');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {dashboardOrder.map((item) => (
        <React.Fragment key={item}>
          {item === 'welcome' && (
            <div className="max-w-2xl">
              <h2 className="text-3xl font-bold text-neutral-900 mb-2">Bienvenido de nuevo</h2>
              <p className="text-neutral-500">Aquí tienes un resumen de tus secciones y recursos disponibles.</p>
            </div>
          )}
          
          {item === 'form' && (
            <div className="bg-white p-8 rounded-3xl border border-neutral-200 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-indigo-100 p-2 rounded-lg">
                  <UserPlus className="text-indigo-600 w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold text-neutral-900">Registrar responsable de sección</h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">Nombre de la Persona</label>
                    <input
                      type="text"
                      value={personName}
                      onChange={(e) => setPersonName(e.target.value)}
                      placeholder="Ej. Juan Pérez"
                      className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">Número de Teléfono</label>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="Ej. 4431234567"
                      className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">Seccion</label>
                    <select
                      value={sectionId}
                      onChange={(e) => setSectionId(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none bg-white"
                    >
                      <option value="">Selecciona una sección</option>
                      {sections.map((section) => (
                        <option key={section.id} value={section.id}>
                          {section.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-neutral-700">INE Frontal</label>
                    <div className="relative group">
                      {ineFront ? (
                        <div className="relative aspect-video rounded-2xl overflow-hidden border-2 border-indigo-500">
                          <img src={ineFront} alt="INE Frontal" className="w-full h-full object-cover" />
                          <button 
                            type="button"
                            onClick={() => setIneFront(null)}
                            className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center aspect-video rounded-2xl border-2 border-dashed border-neutral-200 bg-neutral-50 hover:bg-neutral-100 hover:border-indigo-400 transition-all cursor-pointer group">
                          <Camera className="w-8 h-8 text-neutral-400 group-hover:text-indigo-600 mb-2" />
                          <span className="text-sm font-medium text-neutral-500 group-hover:text-indigo-600">Subir Foto Frontal</span>
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'front')} />
                        </label>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-neutral-700">INE Reverso</label>
                    <div className="relative group">
                      {ineBack ? (
                        <div className="relative aspect-video rounded-2xl overflow-hidden border-2 border-indigo-500">
                          <img src={ineBack} alt="INE Reverso" className="w-full h-full object-cover" />
                          <button 
                            type="button"
                            onClick={() => setIneBack(null)}
                            className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center aspect-video rounded-2xl border-2 border-dashed border-neutral-200 bg-neutral-50 hover:bg-neutral-100 hover:border-indigo-400 transition-all cursor-pointer group">
                          <Camera className="w-8 h-8 text-neutral-400 group-hover:text-indigo-600 mb-2" />
                          <span className="text-sm font-medium text-neutral-500 group-hover:text-indigo-600">Subir Foto Reverso</span>
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'back')} />
                        </label>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-10 rounded-2xl transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 active:scale-[0.98]"
                  >
                    {loading ? 'Guardando...' : 'Registrar responsable'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {item === 'activity' && isAdmin && (
            <div className="bg-white p-8 rounded-3xl border border-neutral-200 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-amber-100 p-2 rounded-lg">
                  <History className="text-amber-600 w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold text-neutral-900">Actividad Reciente</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recentRegistrations.length === 0 ? (
                  <p className="text-neutral-400 text-center py-10 italic col-span-full">No hay registros recientes</p>
                ) : (
                  recentRegistrations.map((reg) => (
                    <div key={reg.id} className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100 space-y-2">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <UserIcon className="w-4 h-4 text-neutral-400" />
                          <span className="font-bold text-neutral-800">{reg.personName}</span>
                        </div>
                        <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                          {reg.createdAt?.toDate ? format(reg.createdAt.toDate(), 'HH:mm', { locale: es }) : 'Recién ahora'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-neutral-600">
                        <MapPin className="w-4 h-4 text-indigo-500" />
                        <span>{reg.sectionName}</span>
                      </div>
                      <div className="pt-2 border-t border-neutral-200 flex items-center justify-between">
                        <span className="text-xs text-neutral-500">Por:</span>
                        <span className="text-xs font-medium text-indigo-600 truncate max-w-[120px]">{reg.responsibleEmail}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
