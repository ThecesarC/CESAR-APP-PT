import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, handleFirestoreError, OperationType, isQuotaError } from '../firebase';
import { 
  collection, doc, getDocs, updateDoc, setDoc, deleteDoc, 
  query, orderBy, onSnapshot, writeBatch, addDoc as fireAddDoc
} from 'firebase/firestore';
import { AnimatePresence, motion, Reorder } from 'framer-motion';
import { 
  Settings, Users, LayoutGrid, FileUp, Palette, 
  Plus, Trash2, Save, ChevronRight, X, GripVertical,
  FileText, FileSpreadsheet, Image as ImageIcon, Video, Link as LinkIcon,
  Upload, Check, Heart, Star, Zap, Shield, Target, Rocket, Box, Activity,
  Move, ArrowLeft, LayoutDashboard, List, Download, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = "Eliminar", type = "danger" }: any) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl"
        >
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 ${type === 'danger' ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-600'}`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
          
          <h3 className="text-xl font-bold text-neutral-900 mb-2">{title}</h3>
          <p className="text-neutral-500 mb-8 leading-relaxed">{message}</p>

          <div className="flex flex-col sm:flex-row gap-3">
            <button 
              onClick={onClose}
              className="flex-1 py-3.5 rounded-xl font-bold text-neutral-500 hover:bg-neutral-50 transition-all order-2 sm:order-1"
            >
              Cancelar
            </button>
            <button 
              onClick={() => { onConfirm(); onClose(); }}
              className={`flex-1 py-3.5 rounded-xl font-bold text-white transition-all shadow-lg order-1 sm:order-2 ${
                type === 'danger' 
                ? 'bg-red-600 hover:bg-red-700 shadow-red-100' 
                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function SectionEditor({ section, isSelected, onToggle }: { section: any, isSelected: boolean, onToggle: (id: string) => void, key?: any }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [data, setData] = useState(section);
  const [isDragging, setIsDragging] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    
    const newFiles: any[] = [];
    Array.from(files).forEach(file => {
      const name = file.name;
      const type = file.type;
      let resourceType = 'link';
      
      if (type.includes('pdf')) resourceType = 'pdf';
      else if (type.includes('excel') || type.includes('spreadsheet') || name.endsWith('.csv')) resourceType = 'excel';
      else if (type.includes('image')) resourceType = 'image';
      else if (type.includes('video')) resourceType = 'video';

      // En un entorno real aquí subiríamos a Storage. 
      // Como es un prototipo, usaremos FileReader para crear un DataURL
      const reader = new FileReader();
      reader.onload = (e) => {
        const url = e.target?.result as string;
        setData((prev: any) => ({
          ...prev,
          files: [...prev.files, { name, url, type: resourceType }]
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const save = async () => {
    try {
      await updateDoc(doc(db, 'sections', section.id), data);
      toast.success('Sección actualizada');
    } catch (e) {
      toast.error('Error al guardar');
    }
  };

  const deleteSection = async () => {
    try {
      await deleteDoc(doc(db, 'sections', section.id));
      toast.success('Sección eliminada');
    } catch (e) {
      toast.error('Error al eliminar');
    }
  };

  const addFile = () => {
    // Para prototipo rápido, mantenemos prompt pero mejoramos el botón de guardado.
    // Si el usuario reporta que prompt falla, implementaremos un modal.
    const name = window.prompt('Nombre del recurso:');
    const url = window.prompt('URL del recurso:');
    if (!name || !url) return;
    
    let type = 'link';
    const lowUrl = url.toLowerCase();
    if (lowUrl.endsWith('.pdf')) type = 'pdf';
    else if (lowUrl.endsWith('.xlsx') || lowUrl.endsWith('.xls') || lowUrl.endsWith('.csv')) type = 'excel';
    else if (lowUrl.match(/\.(jpg|jpeg|png|gif|webp)$/)) type = 'image';
    else if (lowUrl.match(/\.(mp4|webm|ogg)$/) || lowUrl.includes('youtube.com') || lowUrl.includes('youtu.be')) type = 'video';
    
    setData({ ...data, files: [...data.files, { name, url, type }] });
  };

  const removeFile = (idx: number) => {
    const newFiles = [...data.files];
    newFiles.splice(idx, 1);
    setData({ ...data, files: newFiles });
  };

  return (
    <div className={`border rounded-2xl overflow-hidden transition-all ${isSelected ? 'border-indigo-600 ring-1 ring-indigo-600 shadow-md' : 'border-neutral-200'}`}>
      <div 
        className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50/50' : 'bg-neutral-50 hover:bg-neutral-100'}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-4 min-w-0">
          <div 
            onClick={(e) => { e.stopPropagation(); onToggle(section.id); }}
            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-neutral-300 hover:border-indigo-400'}`}
          >
            {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
          </div>
          <GripVertical className="w-4 h-4 text-neutral-300 flex-shrink-0" />
          <span className="font-bold text-neutral-900 truncate">{section.name}</span>
          <span className="text-xs text-neutral-400 flex-shrink-0">({section.files?.length || 0} archivos)</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); }} className="p-2 text-neutral-400 hover:text-red-600">
            <Trash2 className="w-4 h-4" />
          </button>
          <ChevronRight className={`w-5 h-5 text-neutral-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
        </div>
      </div>

      <ConfirmModal 
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={deleteSection}
        title="¿Eliminar sección?"
        message={`¿Estás seguro de que deseas eliminar la sección "${section.name}"? Esta acción no se puede deshacer.`}
      />

      {isExpanded && (
        <div className="p-6 space-y-6 bg-white border-t border-neutral-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-500 uppercase">Nombre</label>
              <input 
                value={data.name}
                onChange={e => setData({...data, name: e.target.value})}
                className="w-full px-4 py-2 rounded-xl border border-neutral-200 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-500 uppercase">Orden</label>
              <input 
                type="number"
                value={data.order}
                onChange={e => setData({...data, order: parseInt(e.target.value)})}
                className="w-full px-4 py-2 rounded-xl border border-neutral-200 text-sm"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-neutral-500 uppercase">Archivos y Recursos</label>
              <button onClick={addFile} className="text-xs font-bold text-indigo-600 hover:underline">
                + Añadir por URL
              </button>
            </div>

            <div 
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={`relative border-2 border-dashed rounded-2xl p-8 transition-all flex flex-col items-center justify-center gap-3 group cursor-pointer ${
                isDragging 
                ? 'border-indigo-600 bg-indigo-50' 
                : 'border-neutral-100 bg-neutral-50 hover:border-neutral-200'
              }`}
            >
              <input 
                type="file" 
                multiple 
                className="absolute inset-0 opacity-0 cursor-pointer" 
                onChange={(e) => handleFiles(e.target.files)}
              />
              <div className={`p-3 rounded-xl transition-colors ${isDragging ? 'bg-indigo-600 text-white' : 'bg-white text-neutral-400 group-hover:text-indigo-600 shadow-sm'}`}>
                <Upload className="w-6 h-6" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-neutral-900">Suelta tus archivos aquí</p>
                <p className="text-xs text-neutral-500">o haz clic para seleccionar (PDF, Excel, Imágenes, Video)</p>
              </div>
            </div>

            <div className="space-y-3">
              {data.files.map((f: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-100 group">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-white border border-neutral-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {f.type === 'image' && f.url ? (
                        <img src={f.url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="text-neutral-400">
                          {f.type === 'pdf' && <FileText className="w-5 h-5" />}
                          {f.type === 'excel' && <FileSpreadsheet className="w-5 h-5" />}
                          {f.type === 'video' && <Video className="w-5 h-5" />}
                          {f.type === 'link' && <LinkIcon className="w-5 h-5" />}
                          {f.type === 'image' && !f.url && <ImageIcon className="w-5 h-5" />}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-bold text-neutral-900 truncate pr-2">{f.name}</span>
                      <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">{f.type}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => removeFile(i)} 
                    className="p-2.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all flex-shrink-0"
                    title="Eliminar archivo"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row justify-end gap-3 border-t border-neutral-100">
            <button 
              onClick={save}
              className="w-full sm:w-auto bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              Guardar Sección
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Admin() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('ui');
  const [sections, setSections] = useState<any[]>([]);
  const [layoutSections, setLayoutSections] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [selectedRegistrations, setSelectedRegistrations] = useState<string[]>([]);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showBulkRegDeleteConfirm, setShowBulkRegDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [regToDelete, setRegToDelete] = useState<string | null>(null);
  const [uiSettings, setUiSettings] = useState({
    primaryColor: '#4f46e5',
    backgroundColor: '#f9fafb',
    fontFamily: 'Inter, sans-serif',
    appIcon: 'Shield',
    logoUrl: 'https://i.postimg.cc/wB2pwRgz/LOGO-ACTUAL-HUGO.jpg',
    dashboardOrder: ['welcome', 'form', 'activity'],
    sidebarOrder: ['dashboard', 'sections', 'admin'],
    headerLayout: ['logo', 'title', 'user'],
    loginOrder: ['icon', 'title', 'description', 'button', 'footer']
  });

  const colorPalette = [
    '#4f46e5', // Indigo
    '#0ea5e9', // Sky
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#ec4899', // Pink
    '#8b5cf6', // Violet
    '#6366f1', // Indigo 2
    '#14b8a6', // Teal
    '#22c55e', // Green
    '#f97316', // Orange
    '#06b6d4', // Cyan
  ];

  const appIcons = [
    { name: 'Shield', icon: Shield },
    { name: 'Heart', icon: Heart },
    { name: 'Star', icon: Star },
    { name: 'Zap', icon: Zap },
    { name: 'Target', icon: Target },
    { name: 'Rocket', icon: Rocket },
    { name: 'Box', icon: Box },
    { name: 'Activity', icon: Activity },
    { name: 'LayoutGrid', icon: LayoutGrid },
    { name: 'Palette', icon: Palette },
  ];

  useEffect(() => {
    // Fetch Sections
    const qSections = query(collection(db, 'sections'), orderBy('order', 'asc'));
    const unsubSections = onSnapshot(qSections, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setSections(docs);
      setLayoutSections(docs);
    }, (error) => {
      if (!isQuotaError(error)) {
        handleFirestoreError(error, OperationType.LIST, 'sections');
      }
    });

    // Fetch Users
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      if (!isQuotaError(error)) {
        handleFirestoreError(error, OperationType.LIST, 'users');
      }
    });

    // Fetch UI Settings
    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (d) => {
      if (d.exists()) {
        const data = d.data();
        setUiSettings(prev => ({ 
          ...prev, 
          ...data,
          dashboardOrder: data.dashboardOrder || prev.dashboardOrder,
          sidebarOrder: data.sidebarOrder || prev.sidebarOrder,
          headerLayout: data.headerLayout || prev.headerLayout,
          loginOrder: data.loginOrder || prev.loginOrder
        }));
      }
    }, (error) => {
      if (!isQuotaError(error)) {
        handleFirestoreError(error, OperationType.GET, 'settings/global');
      }
    });

    // Fetch All Registrations for Excel Export
    const qRegs = query(collection(db, 'registrations'), orderBy('createdAt', 'desc'));
    const unsubRegs = onSnapshot(qRegs, (snap) => {
      setRegistrations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      if (!isQuotaError(error)) {
        handleFirestoreError(error, OperationType.LIST, 'registrations');
      }
    });

    return () => {
      unsubSections();
      unsubUsers();
      unsubSettings();
      unsubRegs();
    };
  }, []);

  const saveSettings = async () => {
    try {
      await setDoc(doc(db, 'settings', 'global'), uiSettings);
      toast.success('Configuración guardada');
    } catch (e) {
      toast.error('Error al guardar');
    }
  };

  const updateUserRole = async (userId: string, role: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role });
      toast.success('Rol actualizado');
    } catch (e) {
      toast.error('Error al actualizar');
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      await deleteDoc(doc(db, 'users', userId));
      toast.success('Usuario eliminado');
    } catch (e) {
      toast.error('Error al eliminar');
    }
  };

  const exportToExcel = async () => {
    if (registrations.length === 0) {
      toast.error('No hay registros para exportar');
      return;
    }

    try {
      // Prepare data for Excel with extra safety
      const excelData = registrations.map(reg => {
        let dateStr = 'N/A';
        let timeStr = 'N/A';

        try {
          const date = reg.createdAt && typeof reg.createdAt.toDate === 'function' 
            ? reg.createdAt.toDate() 
            : (reg.createdAt instanceof Date ? reg.createdAt : null);

          if (date && !isNaN(date.getTime())) {
            dateStr = format(date, 'dd/MM/yyyy');
            timeStr = format(date, 'HH:mm:ss');
          }
        } catch (e) {
          console.error('Error formatting date for record:', reg.id, e);
        }

        return {
          'Fecha': dateStr,
          'Hora': timeStr,
          'Registrado por (Email)': reg.responsibleEmail || 'N/A',
          'Persona Registrada': reg.personName || 'N/A',
          'Teléfono': reg.phoneNumber || 'N/A',
          'Sección': reg.sectionName || 'N/A',
          'INE Frontal (URL/Base64)': reg.ineFrontUrl && reg.ineFrontUrl.length > 32000 
            ? 'Imagen demasiado grande para Excel (Ver en sistema)' 
            : (reg.ineFrontUrl || 'N/A'),
          'INE Reverso (URL/Base64)': reg.ineBackUrl && reg.ineBackUrl.length > 32000 
            ? 'Imagen demasiado grande para Excel (Ver en sistema)' 
            : (reg.ineBackUrl || 'N/A')
        };
      });

      // Create worksheet
      const ws = XLSX.utils.json_to_sheet(excelData);
      
      // Create workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Registros');

      // Generate file and download using a more direct method for iframes
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Registros_Actividad_${format(new Date(), 'yyyy-MM-dd_HHmm')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Archivo Excel generado correctamente');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast.error('Error al generar el archivo Excel. Por favor intenta de nuevo.');
    }
  };

  const downloadImagesZip = async () => {
    if (registrations.length === 0) {
      toast.error('No hay registros con imágenes');
      return;
    }

    const toastId = toast.loading('Generando paquete de imágenes...');
    
    try {
      const zip = new JSZip();
      const imgFolder = zip.folder("INE_Imagenes");
      
      let count = 0;
      registrations.forEach((reg) => {
        const safeName = reg.personName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        
        if (reg.ineFrontUrl && reg.ineFrontUrl.startsWith('data:image')) {
          const base64Data = reg.ineFrontUrl.split(',')[1];
          imgFolder?.file(`${safeName}_frontal.jpg`, base64Data, {base64: true});
          count++;
        }
        
        if (reg.ineBackUrl && reg.ineBackUrl.startsWith('data:image')) {
          const base64Data = reg.ineBackUrl.split(',')[1];
          imgFolder?.file(`${safeName}_reverso.jpg`, base64Data, {base64: true});
          count++;
        }
      });

      if (count === 0) {
        toast.error('No se encontraron imágenes para descargar', { id: toastId });
        return;
      }

      const content = await zip.generateAsync({type: "blob"});
      saveAs(content, `INE_Imagenes_${format(new Date(), 'yyyy-MM-dd')}.zip`);
      
      toast.success(`Paquete generado con ${count} imágenes`, { id: toastId });
    } catch (error) {
      console.error('Error generating ZIP:', error);
      toast.error('Error al generar el paquete de imágenes', { id: toastId });
    }
  };

  const toggleSectionSelection = (id: string) => {
    setSelectedSections(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const toggleRegSelection = (id: string) => {
    setSelectedRegistrations(prev => 
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  const toggleSelectAllRegs = () => {
    if (selectedRegistrations.length === registrations.length) {
      setSelectedRegistrations([]);
    } else {
      setSelectedRegistrations(registrations.map(r => r.id));
    }
  };

  const deleteRegistration = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'registrations', id));
      toast.success('Registro eliminado');
    } catch (error) {
      console.error('Error deleting registration:', error);
      toast.error('Error al eliminar el registro');
    }
  };

  const deleteSelectedRegistrations = async () => {
    const toastId = toast.loading('Eliminando registros seleccionados...');
    try {
      const batch = writeBatch(db);
      selectedRegistrations.forEach(id => {
        batch.delete(doc(db, 'registrations', id));
      });
      await batch.commit();
      setSelectedRegistrations([]);
      toast.success(`${selectedRegistrations.length} registros eliminados`, { id: toastId });
    } catch (error) {
      console.error('Error deleting registrations:', error);
      toast.error('Error al eliminar los registros', { id: toastId });
    }
  };

  const toggleSelectAll = () => {
    if (selectedSections.length === sections.length && sections.length > 0) {
      setSelectedSections([]);
    } else {
      setSelectedSections(sections.map(s => s.id));
    }
  };

  const deleteSelectedSections = async () => {
    try {
      const batch = writeBatch(db);
      selectedSections.forEach(id => {
        batch.delete(doc(db, 'sections', id));
      });
      await batch.commit();
      setSelectedSections([]);
      toast.success('Secciones eliminadas correctamente');
    } catch (e) {
      toast.error('Error al eliminar secciones');
    }
  };

  const [isAddingSection, setIsAddingSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');

  const handleAddSection = async () => {
    if (!newSectionName) return;
    try {
      await fireAddDoc(collection(db, 'sections'), {
        name: newSectionName,
        description: '',
        order: sections.length,
        files: []
      });
      toast.success('Sección añadida');
      setNewSectionName('');
      setIsAddingSection(false);
    } catch (e) {
      toast.error('Error al añadir');
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 200; // Max size for the logo icon
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        const base64 = canvas.toDataURL('image/png');
        setUiSettings({ ...uiSettings, logoUrl: base64 });
        toast.success('Logo cargado y ajustado');
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const saveLayout = async () => {
    try {
      const batch = writeBatch(db);
      layoutSections.forEach((s, idx) => {
        batch.update(doc(db, 'sections', s.id), { order: idx });
      });
      // Also save UI settings which now includes dashboardOrder, sidebarOrder, headerLayout
      batch.set(doc(db, 'settings', 'global'), uiSettings, { merge: true });
      await batch.commit();
      toast.success('Diseño guardado correctamente');
    } catch (e) {
      toast.error('Error al guardar el diseño');
    }
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const XLSX = await import('xlsx');
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        if (data.length === 0) {
          toast.error('El archivo está vacío');
          return;
        }

        const batch = writeBatch(db);
        data.forEach((row, index) => {
          const sectionRef = doc(collection(db, 'sections'));
          batch.set(sectionRef, {
            name: String(row.seccion || row.Seccion || row.SECCION || `Sección ${sections.length + index + 1}`),
            description: '',
            order: sections.length + index,
            files: []
          });
        });

        await batch.commit();
        toast.success(`${data.length} secciones importadas correctamente`);
      } catch (err) {
        console.error(err);
        toast.error('Error al procesar el archivo Excel. Asegúrate de que tenga una columna "seccion"');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; // Reset input
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/')}
            className="p-3 bg-white border border-neutral-200 rounded-2xl text-neutral-500 hover:text-indigo-600 hover:border-indigo-600 transition-all shadow-sm group"
            title="Volver al Panel"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <h2 className="text-3xl font-bold text-neutral-900">Panel de Administración</h2>
            <p className="text-sm text-neutral-500">Configura la apariencia y contenido de tu plataforma.</p>
          </div>
        </div>
        <div className="flex bg-white p-1 rounded-xl border border-neutral-200 shadow-sm self-start md:self-auto overflow-x-auto max-w-full no-scrollbar">
          {[
            { id: 'ui', icon: Palette, label: 'Diseño' },
            { id: 'layout', icon: Move, label: 'Vista Previa' },
            { id: 'sections', icon: LayoutGrid, label: 'Secciones' },
            { id: 'users', icon: Users, label: 'Usuarios' },
            { id: 'history', icon: FileSpreadsheet, label: 'Registros' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                activeTab === tab.id 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'text-neutral-500 hover:bg-neutral-50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="text-sm font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm overflow-hidden">
        {activeTab === 'layout' && (
          <div className="p-8 space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div>
                <h3 className="text-xl font-bold text-neutral-900">Editor de Diseño Visual</h3>
                <p className="text-sm text-neutral-500">Organiza las secciones y visualiza cómo quedará la página completa.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button 
                  onClick={() => setIsPreviewMode(!isPreviewMode)}
                  className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-all border-2 text-sm ${
                    isPreviewMode 
                    ? 'bg-neutral-900 text-white border-neutral-900' 
                    : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  {isPreviewMode ? <LayoutGrid className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                  {isPreviewMode ? 'Modo Edición' : 'Vista Previa Real'}
                </button>
                <button 
                  onClick={saveLayout}
                  className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 text-sm"
                >
                  <Save className="w-4 h-4" />
                  Guardar Diseño
                </button>
              </div>
            </div>

            {isPreviewMode ? (
              <div className="bg-neutral-100 rounded-[2rem] md:rounded-[3rem] p-4 md:p-8 border-4 md:border-8 border-neutral-900 shadow-2xl max-w-5xl mx-auto overflow-hidden relative">
                <button 
                  onClick={() => setIsPreviewMode(false)}
                  className="absolute top-6 left-6 md:top-12 md:left-12 z-20 bg-white/90 backdrop-blur shadow-xl p-2 md:p-3 rounded-xl md:rounded-2xl text-neutral-900 hover:text-indigo-600 transition-all border border-neutral-200 group"
                  title="Cerrar Vista Previa"
                >
                  <ArrowLeft className="w-5 h-5 md:w-6 md:h-6 group-hover:-translate-x-1 transition-transform" />
                </button>
                <div className="bg-white rounded-[1.5rem] md:rounded-[2rem] min-h-[500px] md:min-h-[600px] shadow-inner overflow-y-auto max-h-[70vh] custom-scrollbar">
                  {/* Mock Header */}
                  <header className="px-4 md:px-8 py-4 md:py-6 border-b border-neutral-100 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-10">
                    <div className="flex items-center gap-3 md:gap-6">
                      {uiSettings.headerLayout.map(item => (
                        <React.Fragment key={item}>
                          {item === 'logo' && (
                            uiSettings.logoUrl ? (
                              <img src={uiSettings.logoUrl} alt="Logo" className="h-6 md:h-8 w-auto object-contain" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="p-1.5 md:p-2 rounded-lg text-white" style={{ backgroundColor: uiSettings.primaryColor }}>
                                {(() => {
                                  const Icon = appIcons.find(i => i.name === uiSettings.appIcon)?.icon || Shield;
                                  return <Icon className="w-4 h-4 md:w-5 md:h-5" />;
                                })()}
                              </div>
                            )
                          )}
                          {item === 'title' && <span className="font-bold text-neutral-900 text-xs md:text-base truncate max-w-[80px] md:max-w-none">Gestor de Secciones</span>}
                        </React.Fragment>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 md:gap-4">
                      {uiSettings.headerLayout.includes('user') && (
                        <>
                          <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-neutral-200" />
                          <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-neutral-100" />
                        </>
                      )}
                    </div>
                  </header>

                  <div className="flex min-h-full">
                    {/* Mock Sidebar */}
                    <aside className="w-16 md:w-48 border-r border-neutral-100 p-2 md:p-4 space-y-2">
                      {uiSettings.sidebarOrder.map(item => (
                        <div key={item} className={`p-2 rounded-lg text-[10px] md:text-xs font-bold flex flex-col md:flex-row items-center gap-1 md:gap-2 ${item === 'dashboard' ? 'bg-indigo-50 text-indigo-600' : 'text-neutral-400'}`}>
                          {item === 'dashboard' && <LayoutDashboard className="w-4 h-4" />}
                          {item === 'sections' && <List className="w-4 h-4" />}
                          {item === 'admin' && <Shield className="w-4 h-4" />}
                          <span className="hidden md:inline">
                            {item === 'dashboard' && 'Panel'}
                            {item === 'sections' && 'Secciones'}
                            {item === 'admin' && 'Admin'}
                          </span>
                        </div>
                      ))}
                    </aside>

                    {/* Mock Content */}
                    <div className="flex-1 p-4 md:p-10 space-y-6 md:space-y-10" style={{ backgroundColor: uiSettings.backgroundColor, fontFamily: uiSettings.fontFamily }}>
                      {uiSettings.dashboardOrder.map(item => (
                        <React.Fragment key={item}>
                          {item === 'welcome' && (
                            <div className="max-w-2xl">
                              <h2 className="text-xl md:text-3xl font-bold text-neutral-900 mb-2 md:mb-4">Bienvenido de nuevo</h2>
                              <p className="text-xs md:text-base text-neutral-500">Aquí tienes un resumen de tus secciones y recursos disponibles.</p>
                            </div>
                          )}
                          {item === 'form' && (
                            <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl border border-neutral-200 shadow-sm">
                              <div className="h-3 md:h-4 w-1/3 bg-neutral-100 rounded mb-4" />
                              <div className="h-8 md:h-10 w-full bg-neutral-50 rounded-xl" />
                            </div>
                          )}
                          {item === 'activity' && (
                            <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl border border-neutral-200 shadow-sm">
                              <div className="h-3 md:h-4 w-1/4 bg-neutral-100 rounded mb-4" />
                              <div className="space-y-2">
                                <div className="h-10 md:h-12 w-full bg-neutral-50 rounded-xl" />
                                <div className="h-10 md:h-12 w-full bg-neutral-50 rounded-xl" />
                              </div>
                            </div>
                          )}
                        </React.Fragment>
                      ))}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        {layoutSections.map((section) => (
                          <div key={section.id} className="bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl border border-neutral-200 shadow-sm hover:shadow-md transition-all">
                            <div className="w-10 h-10 md:w-12 md:h-12 bg-neutral-50 rounded-xl md:rounded-2xl flex items-center justify-center mb-3 md:mb-4 text-indigo-600">
                              <LayoutGrid className="w-5 h-5 md:w-6 md:h-6" />
                            </div>
                            <h4 className="font-bold text-neutral-900 mb-1 md:mb-2 text-sm md:text-base">{section.name}</h4>
                            <div className="flex items-center gap-2 text-[10px] text-neutral-400 font-bold uppercase tracking-wider">
                              <FileText className="w-3 h-3" />
                              {section.files?.length || 0} Recursos
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                <div className="space-y-8">
                  <div>
                    <h4 className="text-sm font-bold text-neutral-400 uppercase tracking-widest mb-4">Estructura del Menú</h4>
                    <Reorder.Group 
                      axis="y" 
                      values={uiSettings.sidebarOrder} 
                      onReorder={(val) => setUiSettings({...uiSettings, sidebarOrder: val})}
                      className="space-y-2"
                    >
                      {uiSettings.sidebarOrder.map((item) => (
                        <Reorder.Item key={item} value={item} className="cursor-grab active:cursor-grabbing">
                          <div className="bg-white border border-neutral-200 p-3 rounded-xl flex items-center gap-3 text-sm font-bold text-neutral-700 hover:border-indigo-600 transition-all">
                            <GripVertical className="w-4 h-4 text-neutral-300" />
                            {item === 'dashboard' && 'Panel Principal'}
                            {item === 'sections' && 'Catálogo de Secciones'}
                            {item === 'admin' && 'Administración'}
                          </div>
                        </Reorder.Item>
                      ))}
                    </Reorder.Group>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-neutral-400 uppercase tracking-widest mb-4">Elementos de Cabecera</h4>
                    <Reorder.Group 
                      axis="x" 
                      values={uiSettings.headerLayout} 
                      onReorder={(val) => setUiSettings({...uiSettings, headerLayout: val})}
                      className="flex gap-2 mb-8"
                    >
                      {uiSettings.headerLayout.map((item) => (
                        <Reorder.Item key={item} value={item} className="cursor-grab active:cursor-grabbing flex-1">
                          <div className="bg-white border border-neutral-200 p-3 rounded-xl flex flex-col items-center gap-2 text-[10px] font-bold text-neutral-700 hover:border-indigo-600 transition-all text-center">
                            <GripVertical className="w-3 h-3 text-neutral-300 rotate-90" />
                            {item === 'logo' && 'Logo/Icono'}
                            {item === 'title' && 'Título App'}
                            {item === 'user' && 'Info Usuario'}
                          </div>
                        </Reorder.Item>
                      ))}
                    </Reorder.Group>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-neutral-400 uppercase tracking-widest mb-4">Orden Página de Login</h4>
                    <Reorder.Group 
                      axis="y" 
                      values={uiSettings.loginOrder} 
                      onReorder={(val) => setUiSettings({...uiSettings, loginOrder: val})}
                      className="space-y-2"
                    >
                      {uiSettings.loginOrder.map((item) => (
                        <Reorder.Item key={item} value={item} className="cursor-grab active:cursor-grabbing">
                          <div className="bg-white border border-neutral-200 p-3 rounded-xl flex items-center gap-3 text-sm font-bold text-neutral-700 hover:border-indigo-600 transition-all">
                            <GripVertical className="w-4 h-4 text-neutral-300" />
                            {item === 'icon' && 'Icono de Seguridad'}
                            {item === 'title' && 'Título de Bienvenida'}
                            {item === 'description' && 'Descripción/Instrucciones'}
                            {item === 'button' && 'Botón de Google'}
                            {item === 'footer' && 'Pie de Página'}
                          </div>
                        </Reorder.Item>
                      ))}
                    </Reorder.Group>
                  </div>
                </div>

                <div className="lg:col-span-2 space-y-8">
                  <div>
                    <h4 className="text-sm font-bold text-neutral-400 uppercase tracking-widest mb-4">Orden de la Página Principal</h4>
                    <Reorder.Group 
                      axis="y" 
                      values={uiSettings.dashboardOrder} 
                      onReorder={(val) => setUiSettings({...uiSettings, dashboardOrder: val})}
                      className="space-y-3"
                    >
                      {uiSettings.dashboardOrder.map((item) => (
                        <Reorder.Item key={item} value={item} className="cursor-grab active:cursor-grabbing">
                          <div className="bg-white border-2 border-neutral-100 p-4 rounded-2xl flex items-center gap-4 hover:border-indigo-600 transition-all group">
                            <div className="bg-neutral-50 p-2 rounded-lg">
                              <GripVertical className="w-5 h-5 text-neutral-400 group-hover:text-indigo-600" />
                            </div>
                            <div className="flex-1">
                              <h5 className="font-bold text-neutral-900">
                                {item === 'welcome' && 'Mensaje de Bienvenida'}
                                {item === 'form' && 'Formulario de Registro'}
                                {item === 'activity' && 'Historial de Actividad'}
                              </h5>
                              <p className="text-xs text-neutral-500">
                                {item === 'welcome' && 'Título y descripción principal de la página.'}
                                {item === 'form' && 'Campo para registrar responsables de sección.'}
                                {item === 'activity' && 'Lista de los últimos registros realizados.'}
                              </p>
                            </div>
                          </div>
                        </Reorder.Item>
                      ))}
                    </Reorder.Group>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-neutral-400 uppercase tracking-widest mb-4">Orden de Secciones (Contenido)</h4>
                    <Reorder.Group 
                      axis="y" 
                      values={layoutSections} 
                      onReorder={setLayoutSections}
                      className="space-y-3"
                    >
                      {layoutSections.map((section) => (
                        <Reorder.Item 
                          key={section.id} 
                          value={section}
                          className="cursor-grab active:cursor-grabbing"
                        >
                          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 flex items-center gap-4 hover:border-indigo-600 transition-all">
                            <GripVertical className="w-4 h-4 text-neutral-300" />
                            <span className="text-sm font-bold text-neutral-700">{section.name}</span>
                          </div>
                        </Reorder.Item>
                      ))}
                    </Reorder.Group>
                  </div>
                </div>
              </div>
            )}

            {sections.length === 0 && (
              <div className="text-center py-20 bg-neutral-50 rounded-3xl border-2 border-dashed border-neutral-200">
                <LayoutGrid className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                <p className="text-neutral-500 font-medium">No hay secciones para organizar.</p>
              </div>
            )}
          </div>
        )}
        {activeTab === 'ui' && (
          <div className="p-8 space-y-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-neutral-700 mb-4">Color Primario</label>
                  <div className="grid grid-cols-6 gap-3 mb-6">
                    {colorPalette.map(color => (
                      <button
                        key={color}
                        onClick={() => setUiSettings({...uiSettings, primaryColor: color})}
                        className={`w-full aspect-square rounded-xl border-4 transition-all ${
                          uiSettings.primaryColor === color ? 'border-white ring-2 ring-indigo-600' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-4">
                    <input 
                      type="color" 
                      value={uiSettings.primaryColor}
                      onChange={e => setUiSettings({...uiSettings, primaryColor: e.target.value})}
                      className="w-12 h-12 rounded-lg cursor-pointer border-none"
                    />
                    <input 
                      type="text" 
                      value={uiSettings.primaryColor}
                      onChange={e => setUiSettings({...uiSettings, primaryColor: e.target.value})}
                      className="flex-1 px-4 py-2 rounded-xl border border-neutral-200 text-sm font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-neutral-700 mb-4">Logo de la Aplicación</label>
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <label className="flex-1 flex items-center justify-center gap-2 bg-white border-2 border-dashed border-neutral-200 rounded-xl py-3 px-4 hover:border-indigo-600 hover:bg-indigo-50 transition-all cursor-pointer group">
                        <Upload className="w-5 h-5 text-neutral-400 group-hover:text-indigo-600" />
                        <span className="text-sm font-bold text-neutral-600 group-hover:text-indigo-600">Subir desde dispositivo</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={handleLogoUpload}
                        />
                      </label>
                      <div className="flex-1">
                        <input 
                          type="text" 
                          placeholder="O pega una URL de imagen..."
                          value={(uiSettings.logoUrl || '').startsWith('data:') ? '' : (uiSettings.logoUrl || '')}
                          onChange={e => setUiSettings({...uiSettings, logoUrl: e.target.value})}
                          className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm"
                        />
                      </div>
                      {uiSettings.logoUrl && (
                        <button 
                          onClick={() => setUiSettings({...uiSettings, logoUrl: ''})}
                          className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-all"
                          title="Eliminar logo"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-[10px] text-neutral-400 mt-2 italic">El sistema ajustará automáticamente el tamaño de la imagen para que encaje perfectamente.</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-neutral-700 mb-4">Icono de la Aplicación (Si no hay logo)</label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {appIcons.map(({ name, icon: Icon }) => (
                      <button
                        key={name}
                        onClick={() => setUiSettings({...uiSettings, appIcon: name})}
                        className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${
                          uiSettings.appIcon === name 
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-600' 
                          : 'border-neutral-100 text-neutral-400 hover:border-neutral-200'
                        }`}
                      >
                        <Icon className="w-8 h-8" />
                        <span className="text-[10px] font-bold uppercase tracking-tighter">{name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-neutral-700 mb-4">Color de Fondo</label>
                  <div className="flex items-center gap-4">
                    <input 
                      type="color" 
                      value={uiSettings.backgroundColor}
                      onChange={e => setUiSettings({...uiSettings, backgroundColor: e.target.value})}
                      className="w-12 h-12 rounded-lg cursor-pointer border-none"
                    />
                    <input 
                      type="text" 
                      value={uiSettings.backgroundColor}
                      onChange={e => setUiSettings({...uiSettings, backgroundColor: e.target.value})}
                      className="flex-1 px-4 py-2 rounded-xl border border-neutral-200 text-sm font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-neutral-700 mb-4">Tipografía</label>
                  <select 
                    value={uiSettings.fontFamily}
                    onChange={e => setUiSettings({...uiSettings, fontFamily: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm bg-white font-medium"
                  >
                    <option value="Inter, sans-serif">Inter (Moderno)</option>
                    <option value="'Playfair Display', serif">Playfair (Elegante)</option>
                    <option value="'JetBrains Mono', monospace">JetBrains (Técnico)</option>
                    <option value="system-ui, sans-serif">Sistema</option>
                  </select>
                </div>

                <div className="p-6 bg-neutral-50 rounded-2xl border border-neutral-100">
                  <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-4">Vista Previa</p>
                  <div className="flex items-center gap-4">
                    {uiSettings.logoUrl ? (
                      <img 
                        src={uiSettings.logoUrl} 
                        alt="Logo" 
                        className="h-10 w-auto object-contain"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div 
                        className="p-3 rounded-xl text-white shadow-lg"
                        style={{ backgroundColor: uiSettings.primaryColor }}
                      >
                        {(() => {
                          const Icon = appIcons.find(i => i.name === uiSettings.appIcon)?.icon || Shield;
                          return <Icon className="w-6 h-6" />;
                        })()}
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-neutral-900">Nombre de la App</p>
                      <p className="text-xs text-neutral-500">Eslogan de ejemplo</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-neutral-100 flex justify-end">
              <button 
                onClick={saveSettings}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
              >
                <Save className="w-4 h-4" />
                Guardar Cambios
              </button>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200">
                  <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Usuario</th>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Rol</th>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-6 py-4 flex items-center gap-3">
                      <img src={u.photoURL} alt="" className="w-8 h-8 rounded-full border border-neutral-200" />
                      <span className="font-medium text-neutral-900">{u.displayName}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-600">{u.email}</td>
                    <td className="px-6 py-4">
                      <select 
                        value={u.role || 'user'}
                        onChange={e => updateUserRole(u.id, e.target.value)}
                        className="text-sm border-none bg-transparent font-medium text-indigo-600 focus:ring-0 cursor-pointer"
                      >
                        <option value="user">Usuario</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setUserToDelete(u.id)}
                        className="p-2 text-neutral-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ConfirmModal 
              isOpen={!!userToDelete}
              onClose={() => setUserToDelete(null)}
              onConfirm={() => userToDelete && deleteUser(userToDelete)}
              title="¿Eliminar usuario?"
              message="¿Estás seguro de que deseas eliminar a este usuario? Perderá el acceso a la plataforma inmediatamente."
            />
          </div>
        )}

        {activeTab === 'sections' && (
          <div className="p-4 md:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <h3 className="text-lg font-bold text-neutral-900">Gestión de Secciones</h3>
              <div className="flex flex-wrap gap-2">
                <label className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-50 text-emerald-600 px-4 py-3 rounded-xl font-bold hover:bg-emerald-100 transition-all cursor-pointer text-sm">
                  <Upload className="w-4 h-4" />
                  Importar Excel
                  <input 
                    type="file" 
                    accept=".xlsx, .xls, .csv" 
                    className="hidden" 
                    onChange={handleExcelImport}
                  />
                </label>
                <button 
                  onClick={() => setIsAddingSection(true)}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-3 rounded-xl font-bold hover:bg-indigo-100 transition-all text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Nueva Sección
                </button>
              </div>
            </div>

            {sections.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-neutral-50 p-4 rounded-2xl border border-neutral-100 gap-4">
                <div className="flex flex-wrap items-center gap-3 md:gap-4">
                  <button 
                    onClick={toggleSelectAll}
                    className="flex items-center gap-2 text-sm font-bold text-neutral-600 hover:text-indigo-600 transition-colors whitespace-nowrap"
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 ${selectedSections.length === sections.length ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-neutral-300'}`}>
                      {selectedSections.length === sections.length && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
                    </div>
                    Seleccionar Todo
                  </button>
                  {selectedSections.length > 0 && (
                    <span className="text-[10px] md:text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full whitespace-nowrap">
                      {selectedSections.length} seleccionados
                    </span>
                  )}
                </div>
                {selectedSections.length > 0 && (
                  <button 
                    onClick={() => setShowBulkDeleteConfirm(true)}
                    className="flex items-center justify-center gap-2 text-red-600 hover:bg-red-50 px-4 py-2.5 rounded-xl font-bold transition-all text-sm w-full sm:w-auto border border-transparent hover:border-red-100"
                  >
                    <Trash2 className="w-4 h-4" />
                    Eliminar Seleccionados
                  </button>
                )}
              </div>
            )}

            <ConfirmModal 
              isOpen={showBulkDeleteConfirm}
              onClose={() => setShowBulkDeleteConfirm(false)}
              onConfirm={deleteSelectedSections}
              title="¿Seguro que desea eliminar esta selección?"
              message={`Estás a punto de eliminar ${selectedSections.length} secciones. Esta acción es permanente y no se puede deshacer.`}
            />

            {isAddingSection && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
                  <h3 className="text-xl font-bold text-neutral-900 mb-4">Nueva Sección</h3>
                  <p className="text-sm text-neutral-500 mb-6">Ingresa el número o nombre de la nueva sección.</p>
                  
                  <input 
                    type="number"
                    inputMode="numeric"
                    placeholder="Ej. 1234"
                    value={newSectionName}
                    onChange={e => setNewSectionName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddSection()}
                    autoFocus
                    className="w-full px-6 py-4 rounded-2xl border-2 border-neutral-100 focus:border-indigo-600 outline-none text-2xl font-bold text-center transition-all mb-6"
                  />

                  <div className="flex gap-3">
                    <button 
                      onClick={() => setIsAddingSection(false)}
                      className="flex-1 py-4 rounded-2xl font-bold text-neutral-500 hover:bg-neutral-50 transition-all"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={handleAddSection}
                      className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                    >
                      Añadir
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {sections.map((s, idx) => (
                <SectionEditor 
                  key={s.id} 
                  section={s} 
                  isSelected={selectedSections.includes(s.id)}
                  onToggle={toggleSectionSelection}
                />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="p-4 md:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div>
                <h3 className="text-lg font-bold text-neutral-900">Historial de Registros</h3>
                <p className="text-sm text-neutral-500">Consulta y descarga todos los registros realizados en tiempo real.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedRegistrations.length > 0 && (
                  <button 
                    onClick={() => setShowBulkRegDeleteConfirm(true)}
                    className="flex items-center justify-center gap-2 bg-red-50 text-red-600 px-6 py-3 rounded-xl font-bold hover:bg-red-100 transition-all border border-red-100"
                  >
                    <Trash2 className="w-4 h-4" />
                    Eliminar ({selectedRegistrations.length})
                  </button>
                )}
                <button 
                  onClick={downloadImagesZip}
                  className="flex items-center justify-center gap-2 bg-amber-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-amber-700 transition-all shadow-lg shadow-amber-100"
                >
                  <ImageIcon className="w-4 h-4" />
                  Descargar Fotos (ZIP)
                </button>
                <button 
                  onClick={exportToExcel}
                  className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                >
                  <Download className="w-4 h-4" />
                  Descargar Excel
                </button>
              </div>
            </div>

            {registrations.length > 0 && (
              <div className="flex items-center gap-4 bg-neutral-50 p-4 rounded-2xl border border-neutral-100">
                <button 
                  onClick={toggleSelectAllRegs}
                  className="flex items-center gap-2 text-sm font-bold text-neutral-600 hover:text-indigo-600 transition-colors"
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${selectedRegistrations.length === registrations.length ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-neutral-300'}`}>
                    {selectedRegistrations.length === registrations.length && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
                  </div>
                  Seleccionar Todo
                </button>
                {selectedRegistrations.length > 0 && (
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                    {selectedRegistrations.length} seleccionados
                  </span>
                )}
              </div>
            )}

            <div className="overflow-x-auto border border-neutral-100 rounded-2xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200">
                    <th className="px-6 py-4 w-10"></th>
                    <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Fecha / Hora</th>
                    <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Registrado por</th>
                    <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Persona / Teléfono</th>
                    <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Sección</th>
                    <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Documentación</th>
                    <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {registrations.map(reg => (
                    <tr key={reg.id} className={`hover:bg-neutral-50 transition-colors ${selectedRegistrations.includes(reg.id) ? 'bg-indigo-50/30' : ''}`}>
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => toggleRegSelection(reg.id)}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${selectedRegistrations.includes(reg.id) ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-neutral-300'}`}
                        >
                          {selectedRegistrations.includes(reg.id) && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-neutral-900">
                            {reg.createdAt?.toDate ? format(reg.createdAt.toDate(), 'dd/MM/yyyy') : 'N/A'}
                          </span>
                          <span className="text-[10px] text-neutral-400 font-bold">
                            {reg.createdAt?.toDate ? format(reg.createdAt.toDate(), 'HH:mm:ss') : 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-600">{reg.responsibleEmail}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-neutral-900">{reg.personName}</span>
                          <span className="text-xs text-neutral-500">{reg.phoneNumber || 'Sin teléfono'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold">
                          {reg.sectionName}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          {reg.ineFrontUrl && (
                            <a href={reg.ineFrontUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-neutral-100 rounded-lg text-neutral-500 hover:text-indigo-600 transition-colors" title="Ver INE Frontal">
                              <ImageIcon className="w-4 h-4" />
                            </a>
                          )}
                          {reg.ineBackUrl && (
                            <a href={reg.ineBackUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-neutral-100 rounded-lg text-neutral-500 hover:text-indigo-600 transition-colors" title="Ver INE Reverso">
                              <ImageIcon className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => setRegToDelete(reg.id)}
                          className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                          title="Eliminar registro"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {registrations.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-20 text-center text-neutral-400">
                        No hay registros disponibles.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <ConfirmModal 
              isOpen={!!regToDelete}
              onClose={() => setRegToDelete(null)}
              onConfirm={() => regToDelete && deleteRegistration(regToDelete)}
              title="¿Eliminar registro?"
              message="Esta acción no se puede deshacer. Se eliminará permanentemente la información y las fotos de este responsable."
            />

            <ConfirmModal 
              isOpen={showBulkRegDeleteConfirm}
              onClose={() => setShowBulkRegDeleteConfirm(false)}
              onConfirm={deleteSelectedRegistrations}
              title={`¿Eliminar ${selectedRegistrations.length} registros?`}
              message={`Estás a punto de eliminar permanentemente ${selectedRegistrations.length} registros seleccionados. ¿Deseas continuar?`}
            />
          </div>
        )}
      </div>
    </div>
  );
}

