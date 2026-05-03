import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit } from 'firebase/firestore';
import { useGlobalState } from '../contexts/GlobalStateContext';
import { toast } from 'sonner';
import { UserPlus, History, User as UserIcon, MapPin, Phone, Camera, X, Rocket } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion } from 'framer-motion';

export default function Dashboard({ user, isAdmin }: { user: any, isAdmin: boolean }) {
  const { settings, sections, registrations, userProfile, refreshCount } = useGlobalState();
  const [personName, setPersonName] = useState('');
  const [personLastNameP, setPersonLastNameP] = useState('');
  const [personLastNameM, setPersonLastNameM] = useState('');
  const [electorKey, setElectorKey] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [ineFront, setIneFront] = useState<string | null>(null);
  const [ineBack, setIneBack] = useState<string | null>(null);
  const [sectionId, setSectionId] = useState('');
  const [casilla, setCasilla] = useState('');
  const [loading, setLoading] = useState(false);
  const [dashboardOrder, setDashboardOrder] = useState(['welcome', 'form', 'activity']);

  // Filter sections based on assignments - Relying on assignedSections array for strict ownership
  const availableSections = isAdmin 
    ? sections 
    : sections.filter(s => (userProfile?.assignedSections || []).includes(s.id));

  // Calculate progress
  let myTotalCasillasCount = 0;
  let myRegistrationCount = 0;

  if (isAdmin) {
    // Global progress calculation: Any unique casilla covered in the entire catalogue
    myTotalCasillasCount = sections.reduce((acc, s) => acc + (s.casillas?.length || 1), 0);
    
    // Count UNIQUE casillas covered across all registrations in known sections
    const uniqueCovered = new Set(
      registrations
        .filter(r => r.sectionId && sections.some(s => s.id === r.sectionId))
        .map(r => `${r.sectionId}-${r.casilla}`)
    );
    myRegistrationCount = uniqueCovered.size;
  } else {
    // User-specific progress calculation
    const assignedSectionIds = (userProfile?.assignedSections || []);
    const actualAssignedIds = assignedSectionIds.filter(id => sections.some(s => s.id === id));
    const mySections = sections.filter(s => actualAssignedIds.includes(s.id));
    
    myTotalCasillasCount = mySections.reduce((acc, s) => acc + (s.casillas?.length || 1), 0);
    
    // Count UNIQUE casillas covered for this user
    const myUniqueCovered = new Set(
      registrations
        .filter(r => 
          r.sectionId &&
          actualAssignedIds.includes(r.sectionId) && 
          r.responsibleId === (userProfile?.id || user?.uid)
        )
        .map(r => `${r.sectionId}-${r.casilla}`)
    );
    myRegistrationCount = myUniqueCovered.size;
  }

  const progressPercentage = myTotalCasillasCount > 0 
    ? Math.min((myRegistrationCount / myTotalCasillasCount) * 100, 100).toFixed(2)
    : "0.00";

  // Get casillas for selected section
  const selectedSection = sections.find(s => s.id === sectionId);
  const availableCasillas = selectedSection?.casillas || [];

  useEffect(() => {
    if (settings?.dashboardOrder) {
      setDashboardOrder(settings.dashboardOrder);
    }
  }, [settings]);

  const removeAccents = (str: string) => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  };

  const recentRegistrations = registrations.slice(0, 5);

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
        const MAX_WIDTH = 1000; // Reduced from 1200 to stay safely under 1MB base64 limit
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
        
        const base64 = canvas.toDataURL('image/jpeg', 0.7); // Quality reduced slightly for safety
        if (side === 'front') setIneFront(base64);
        else setIneBack(base64);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('Sesión no válida. Por favor recarga la página.');
      return;
    }

    if (!personName || !personLastNameP || !personLastNameM || !electorKey || !sectionId || !phoneNumber || !casilla) {
      toast.error('Por favor completa todos los campos obligatorios');
      return;
    }

    if (electorKey.length !== 18) {
      toast.error('La Clave de Elector debe tener exactamente 18 caracteres');
      return;
    }

    if (!ineFront || !ineBack) {
      toast.error('Por favor carga ambas fotos de la INE');
      return;
    }

    if (phoneNumber.length < 10) {
      toast.error('El número de teléfono debe tener 10 dígitos exactos');
      return;
    }

    if (phoneNumber.length < 10) {
      toast.error('El número de teléfono debe tener 10 dígitos exactos');
      return;
    }

    setLoading(true);
    const section = sections.find(s => s.id === sectionId);
    
    // Format data strictly
    const finalFirstName = removeAccents(personName.trim());
    const finalLastNameP = removeAccents(personLastNameP.trim());
    const finalLastNameM = removeAccents(personLastNameM.trim());
    const finalFullName = `${finalLastNameP} ${finalLastNameM} ${finalFirstName}`.trim();
    const finalElectorKey = removeAccents(electorKey.trim());

    let toastId: string | number | undefined;

    try {
      console.log("Iniciando validación de duplicados...");
      toastId = toast.loading('Verificando disponibilidad...');
      
      // Check if this specific casilla in this section already has a responsible
      const q = query(
        collection(db, 'registrations'),
        where('sectionId', '==', sectionId),
        where('casilla', '==', casilla),
        limit(1)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const existingData = querySnapshot.docs[0].data();
        toast.error(`Esta casilla ya cuenta con un responsable: ${existingData.personName}`, { id: toastId });
        setLoading(false);
        return;
      }

      toast.loading('Enviando registro y fotos...', { id: toastId });
      console.log("Guardando registro en Firestore...");
      
      await addDoc(collection(db, 'registrations'), {
        personName: finalFullName,
        firstName: finalFirstName,
        lastNameP: finalLastNameP,
        lastNameM: finalLastNameM,
        electorKey: finalElectorKey,
        phoneNumber,
        ineFrontUrl: ineFront,
        ineBackUrl: ineBack,
        sectionId,
        sectionName: section?.name || 'Desconocida',
        casilla,
        responsibleId: user.uid,
        responsibleEmail: user.email || 'sin-email@bunker.com',
        createdAt: serverTimestamp()
      });

      console.log("Registro exitoso");
      toast.success('Registro completado con éxito', { id: toastId });
      setPersonName('');
      setPersonLastNameP('');
      setPersonLastNameM('');
      setElectorKey('');
      setPhoneNumber('');
      setIneFront(null);
      setIneBack(null);
      setSectionId('');
      setCasilla('');
    } catch (error: any) {
      console.error("Error completo de registro:", error);
      const errorMsg = error.message || 'Error desconocido';
      
      let finalMsg = `Error al guardar: ${errorMsg}`;
      if (errorMsg.includes('permission')) {
        finalMsg = 'No tienes permisos suficientes para registrar en esta sección.';
      } else if (errorMsg.includes('quota')) {
        finalMsg = 'Límite de almacenamiento alcanzado (Quota).';
      } else if (errorMsg.includes('size')) {
        finalMsg = 'Las imágenes son demasiado pesadas. Intenta con fotos más pequeñas.';
      }
      
      toast.error(finalMsg, { id: toastId });
      
      try {
        handleFirestoreError(error, OperationType.CREATE, 'registrations');
      } catch (err) {
        // Ignorar el re-throw para que el spinner se detenga en finalmente
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {Array.from(new Set(dashboardOrder || [])).map((item) => (
        <React.Fragment key={item}>
          {item === 'welcome' && (
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="max-w-2xl">
                <h2 className="text-3xl font-bold text-neutral-900 mb-2">Bienvenido de nuevo</h2>
                <p className="text-neutral-500">Aquí tienes un resumen de tus secciones y recursos disponibles.</p>
                <p className="text-[10px] text-neutral-400 mt-1">Conectado como: {user?.email}</p>
              </div>
              
              <div className="bg-white p-5 rounded-3xl border border-neutral-200 shadow-sm flex-1 max-w-sm">
                <div className="flex justify-between items-end mb-3">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Avance del Territorio</span>
                      <button 
                        onClick={() => {
                          refreshCount().then(() => toast.success('Avance actualizado'));
                        }}
                        className="p-1 hover:bg-neutral-100 rounded-full transition-colors"
                        title="Recargar avance"
                      >
                        <Rocket className="w-3 h-3 text-neutral-400" />
                      </button>
                    </div>
                    <span className="text-2xl font-black text-red-600">{progressPercentage}%</span>
                    <div className="flex flex-col gap-1 mt-1">
                      {myRegistrationCount === 0 && myTotalCasillasCount > 0 && (
                        <div className="flex items-center gap-1">
                          <div className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
                          <p className="text-[8px] text-red-400 italic">Sincronizando...</p>
                        </div>
                      )}
                      <button 
                        onClick={async () => {
                          const toastId = toast.loading('Sincronización forzada (Chrome Fix)...');
                          try {
                            await refreshCount();
                            toast.success('Sincronización completa', { id: toastId });
                          } catch (e) {
                            console.error("Sync error:", e);
                            toast.error('Error de conexión.', { id: toastId });
                          }
                        }}
                        className="text-[9px] font-bold text-indigo-600 hover:text-indigo-700 underline text-left"
                      >
                        Forzar sincronización ahora (Chrome Fix)
                      </button>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-neutral-900">{myRegistrationCount}</span>
                    <span className="text-xs text-neutral-400"> / {myTotalCasillasCount}</span>
                  </div>
                </div>
                <div className="w-full h-3 bg-red-50 rounded-full overflow-hidden border border-red-50">
                  <motion.div 
                    key={progressPercentage}
                    className="h-full bg-red-600 rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(220,38,38,0.4)]"
                    style={{ width: `${progressPercentage}%` }}
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>
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
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">
                      Apellido Paterno <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={personLastNameP}
                      onChange={(e) => setPersonLastNameP(removeAccents(e.target.value))}
                      placeholder="APELLIDO PATERNO"
                      required
                      className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none font-medium uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">
                      Apellido Materno <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={personLastNameM}
                      onChange={(e) => setPersonLastNameM(removeAccents(e.target.value))}
                      placeholder="APELLIDO MATERNO"
                      required
                      className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none font-medium uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">
                      Nombre(s) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={personName}
                      onChange={(e) => setPersonName(removeAccents(e.target.value))}
                      placeholder="NOMBRE(S)"
                      required
                      className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none font-medium uppercase"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                  <div className="lg:col-span-2">
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">
                      Clave de Elector (18 caracteres) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      maxLength={18}
                      minLength={18}
                      value={electorKey}
                      onChange={(e) => setElectorKey(removeAccents(e.target.value))}
                      placeholder="ABCDEF123456789012"
                      required
                      className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none font-mono font-bold tracking-widest uppercase"
                    />
                    <div className="flex justify-between items-center text-[10px] font-bold mt-1">
                      <span className={electorKey.length === 18 ? 'text-emerald-500' : 'text-neutral-400'}>
                        {electorKey.length} / 18 caracteres
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">
                      Número de Teléfono <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, ''); // Solo números
                        if (val.length <= 10) setPhoneNumber(val);
                      }}
                      placeholder="10 dígitos (Ej. 4431234567)"
                      required
                      className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                    />
                    <p className="text-[9px] text-neutral-400 mt-1 italic">Ingresa los 10 dígitos sin espacios ni guiones.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">
                      Seccion <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={sectionId}
                      onChange={(e) => {
                        setSectionId(e.target.value);
                        setCasilla(''); // Reset casilla when section changes
                      }}
                      required
                      className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none bg-white font-medium"
                    >
                      <option value="">Selecciona sección</option>
                      {availableSections.map((section) => (
                        <option key={section.id} value={section.id}>
                          {section.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">
                      Casilla <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={casilla}
                      onChange={(e) => setCasilla(e.target.value)}
                      required
                      disabled={!sectionId}
                      className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none bg-white font-medium disabled:bg-neutral-50 disabled:text-neutral-400"
                    >
                      <option value="">Selecciona casilla</option>
                      {availableCasillas.map((c: string) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-neutral-700">
                      INE Frontal <span className="text-red-500">*</span>
                    </label>
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
                          <input type="file" accept="image/*" className="hidden" required onChange={(e) => handleFileUpload(e, 'front')} />
                        </label>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-neutral-700">
                      INE Reverso <span className="text-red-500">*</span>
                    </label>
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
                          <input type="file" accept="image/*" className="hidden" required onChange={(e) => handleFileUpload(e, 'back')} />
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
                        <span>Sección {reg.sectionName} - {reg.casilla}</span>
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
