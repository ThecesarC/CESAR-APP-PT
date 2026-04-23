import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { useGlobalState } from '../contexts/GlobalStateContext';
import { initializeApp } from 'firebase/app';
import { firebaseConfig } from '../firebase';
import { getAuth as getSecondaryAuth, createUserWithEmailAndPassword as createSecondaryUser, signOut as signSecondaryOut, signInWithEmailAndPassword } from 'firebase/auth';
import { 
  collection, doc, updateDoc, setDoc, deleteDoc, 
  query, orderBy, onSnapshot, writeBatch, addDoc as fireAddDoc, getDoc,
  serverTimestamp
} from 'firebase/firestore';
import { AnimatePresence, motion, Reorder } from 'framer-motion';
import { 
  Settings, Users, LayoutGrid, FileUp, Palette, 
  Plus, Trash2, Save, ChevronRight, X, GripVertical,
  FileText, FileSpreadsheet, Image as ImageIcon, Video, Link as LinkIcon,
  Upload, Check, Heart, Star, Zap, Shield, Target, Rocket, Box, Activity,
  Move, ArrowLeft, LayoutDashboard, List, Download, AlertTriangle, ShieldCheck,
  Eye, Edit, Camera, Clock, CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import Cropper from 'react-easy-crop';
import { Scissors } from 'lucide-react';

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
  const { settings, sections: contextSections, registrations: contextRegistrations } = useGlobalState();
  const [activeTab, setActiveTab] = useState('ui');
  const [sections, setSections] = useState<any[]>([]);
  const [layoutSections, setLayoutSections] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [evidence, setEvidence] = useState<any[]>([]);
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [selectedRegistrations, setSelectedRegistrations] = useState<string[]>([]);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showBulkRegDeleteConfirm, setShowBulkRegDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [regToDelete, setRegToDelete] = useState<string | null>(null);
  const [evidenceToDelete, setEvidenceToDelete] = useState<string | null>(null);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [assigningSectionsUser, setAssigningSectionsUser] = useState<any>(null);
  const [fileManagingSection, setFileManagingSection] = useState<any>(null);
  const [showUserSectionsWipeConfirm, setShowUserSectionsWipeConfirm] = useState(false);
  const [editingRegistration, setEditingRegistration] = useState<any>(null);

  const handleUpdateAssignedSections = async (userId: string, sectionIds: string[]) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        assignedSections: sectionIds
      });
      toast.success('Secciones actualizadas');
    } catch (e) {
      toast.error('Error al actualizar secciones');
    }
  };

  const toggleUserRole = async (userId: string, currentRole: string) => {
    try {
      const nextRole = currentRole === 'admin' ? 'user' : 'admin';
      await updateDoc(doc(db, 'users', userId), { role: nextRole });
      toast.success(`Rol cambiado a ${nextRole === 'admin' ? 'Administrador' : 'Usuario'}`);
    } catch (e) {
      toast.error('Error al cambiar rol');
    }
  };

  const exportUserAssignments = () => {
    if (users.length === 0) {
      toast.error('No hay usuarios para exportar');
      return;
    }

    try {
      const exportData = users.map(u => {
        const assignedNames = (u.assignedSections || [])
          .map((id: string) => sections.find(s => s.id === id)?.name)
          .filter(Boolean)
          .join(', ');

        return {
          'Nombre': u.displayName || 'N/A',
          'Usuario/Email': u.email || 'N/A',
          'Perfil': u.role || 'user',
          'Secciones Asignadas': assignedNames
        };
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Asignaciones');
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
      saveAs(data, `Asignaciones_Usuarios_${format(new Date(), 'dd-MM-yyyy')}.xlsx`);
      toast.success('Exportación completada');
    } catch (e) {
      toast.error('Error al exportar asignaciones');
    }
  };

  const handleConsolidateSections = async () => {
    const toastId = toast.loading('Consolidando catálogo y corrigiendo conflictos...');
    try {
      // 1. Group sections by name (case-insensitive)
      const nameGroups = new Map<string, any[]>();
      sections.forEach(s => {
        const key = s.name.toLowerCase().trim();
        if (!nameGroups.has(key)) nameGroups.set(key, []);
        nameGroups.get(key)?.push(s);
      });

      const batch = writeBatch(db);
      let mergeCount = 0;
      let registrationUpdates = 0;
      let userUpdates = 0;

      for (const [name, dupes] of nameGroups.entries()) {
        if (dupes.length > 1) {
          // Identify the best "Main" section (the one with files or the first one)
          const main = dupes.find(s => (s.files?.length || 0) > 0) || dupes[0];
          const otherIds = dupes.filter(s => s.id !== main.id).map(s => s.id);

          // Merge all casillas into main
          const allCasillas = new Set(main.casillas || []);
          dupes.forEach(s => (s.casillas || []).forEach((c: string) => allCasillas.add(c)));

          batch.update(doc(db, 'sections', main.id), { 
            casillas: Array.from(allCasillas),
            updatedAt: serverTimestamp()
          });

          // Update registrations pointing to discarded sections
          registrations.forEach(reg => {
            if (otherIds.includes(reg.sectionId)) {
              batch.update(doc(db, 'registrations', reg.id), { 
                sectionId: main.id,
                sectionName: main.name,
                updatedAt: serverTimestamp()
              });
              registrationUpdates++;
            }
          });

          // Update users pointing to discarded sections
          users.forEach(u => {
            const current = u.assignedSections || [];
            if (current.some((id: string) => otherIds.includes(id))) {
              const cleaned = Array.from(new Set(
                current.map((id: string) => otherIds.includes(id) ? main.id : id)
              ));
              batch.update(doc(db, 'users', u.id), { assignedSections: cleaned });
              userUpdates++;
            }
          });

          // Delete the extra sections
          otherIds.forEach(id => {
            batch.delete(doc(db, 'sections', id));
            mergeCount++;
          });
        }
      }

      await batch.commit();
      toast.success(`Saneamiento completo. ${mergeCount} duplicados eliminados. ${registrationUpdates} registros y ${userUpdates} usuarios sincronizados.`, { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error('Error durante la consolidación del catálogo', { id: toastId });
    }
  };

  const handleNuclearClean = async () => {
    const liz = users.find(u => 
      u.displayName?.toLowerCase().includes('liz') || 
      u.email?.toLowerCase().includes('liz')
    );

    if (!liz) {
      toast.error('No se encontró al usuario de Liz Betancourt para referenciar el catálogo activo.');
      return;
    }

    const toastId = toast.loading('Realizando purga definitiva de secciones obsoletas...');
    try {
      const allowedSectionIds = new Set(liz.assignedSections || []);
      const batch = writeBatch(db);
      let deletedCount = 0;

      sections.forEach(s => {
        if (!allowedSectionIds.has(s.id)) {
          batch.delete(doc(db, 'sections', s.id));
          deletedCount++;
        }
      });

      await batch.commit();
      toast.success(`Purga completada. Se eliminaron ${deletedCount} secciones que no pertenecían al catálogo de Liz.`, { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error('Error durante la purga atómica', { id: toastId });
    }
  };

  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [showConsolidateConfirm, setShowConsolidateConfirm] = useState(false);
  const [showNuclearConfirm, setShowNuclearConfirm] = useState(false);

  const handleWipeSections = async () => {
    const toastId = toast.loading('Borrando catálogo de secciones...');
    try {
      const batch = writeBatch(db);
      sections.forEach(s => {
        batch.delete(doc(db, 'sections', s.id));
      });
      await batch.commit();
      
      // Also clear assignments from users to maintain consistency
      const userBatch = writeBatch(db);
      users.forEach(u => {
        if (u.assignedSections && u.assignedSections.length > 0) {
          userBatch.update(doc(db, 'users', u.id), { assignedSections: [] });
        }
      });
      await userBatch.commit();
      
      toast.success('Catálogo y asignaciones eliminadas completamente', { id: toastId });
    } catch (e) {
      toast.error('Error al borrar datos', { id: toastId });
    }
  };

  const handleUserSectionsExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const XLSX = await import('xlsx');
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        const batch = writeBatch(db);
        let count = 0;
        
        data.forEach(row => {
          const email = String(row.email || row.Email || row.EMAIL || '').toLowerCase().trim();
          const seccionesRaw = String(row.secciones || row.Secciones || row.SECCIONES || '');
          
          if (email && seccionesRaw) {
            const sectionNames = seccionesRaw.split(',').map(s => s.trim().toLowerCase());
            const matchedIds = sections
              .filter(s => sectionNames.includes(s.name.toLowerCase()))
              .map(s => s.id);
            
            const targetUser = users.find(u => u.email.toLowerCase() === email);
            if (targetUser && matchedIds.length > 0) {
              batch.update(doc(db, 'users', targetUser.id), {
                assignedSections: matchedIds
              });
              count++;
            }
          }
        });

        await batch.commit();
        toast.success(`Secciones asignadas a ${count} usuarios`);
      } catch (e) {
        toast.error('Error al procesar asignaciones');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };
  const [newUserRole, setNewUserRole] = useState('user');
  const [isAddingUserSection, setIsAddingUserSection] = useState(false);
  const [newUSectionName, setNewUSectionName] = useState('');
  const [newUSectionCasillas, setNewUSectionCasillas] = useState('');
  const [selectedUSections, setSelectedUSections] = useState<string[]>([]);

  const handleAddManualSectionToUser = async (uid: string) => {
    if (!newUSectionName) {
      toast.error('Nombre de sección requerido');
      return;
    }
    try {
      const sectionRef = doc(collection(db, 'sections'));
      const casillas = newUSectionCasillas.split(',').map(c => c.trim()).filter(c => c);
      
      const newSection = {
        name: newUSectionName,
        casillas: casillas,
        assignedTo: uid,
        createdAt: new Date(),
        order: sections.length
      };

      await setDoc(sectionRef, newSection);
      
      // Update user's assignedSections array for backward compatibility/quick lookup
      await updateDoc(doc(db, 'users', uid), {
        assignedSections: [...(assigningSectionsUser.assignedSections || []), sectionRef.id]
      });

      // Update local state to show change immediately if needed
      setAssigningSectionsUser((prev: any) => ({
        ...prev,
        assignedSections: [...(prev.assignedSections || []), sectionRef.id]
      }));

      setNewUSectionName('');
      setNewUSectionCasillas('');
      setIsAddingUserSection(false);
      toast.success('Sección añadida');
    } catch (e) {
      toast.error('Error al añadir sección');
    }
  };

  const handleUserImportExcelInsideModal = async (e: React.ChangeEvent<HTMLInputElement>, uid: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const XLSX = await import('xlsx');
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        if (data.length === 0) {
          toast.error('El archivo está vacío');
          return;
        }

        const batch = writeBatch(db);
        const newIds: string[] = [];
        
        data.forEach((row, index) => {
          const sectionRef = doc(collection(db, 'sections'));
          const casillasRaw = row.casillas || row.Casillas || row.CASILLAS || '';
          const casillas = typeof casillasRaw === 'string' 
            ? casillasRaw.split(',').map(c => c.trim()).filter(c => c)
            : (typeof casillasRaw === 'number' ? [String(casillasRaw)] : []);

          batch.set(sectionRef, {
            name: String(row.seccion || row.Seccion || row.SECCION || `Sección ${index + 1}`),
            casillas: casillas,
            assignedTo: uid,
            order: sections.length + index,
            createdAt: new Date()
          });
          newIds.push(sectionRef.id);
        });

        const currentAssigned = assigningSectionsUser.assignedSections || [];
        batch.update(doc(db, 'users', uid), {
          assignedSections: [...currentAssigned, ...newIds]
        });

        await batch.commit();
        setAssigningSectionsUser((prev: any) => ({
          ...prev,
          assignedSections: [...(prev.assignedSections || []), ...newIds]
        }));

        toast.success(`${data.length} secciones añadidas al usuario`);
      } catch (err) {
        toast.error('Error al procesar el Excel');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleExportSpecificUserSections = (user: any) => {
    const userSections = sections.filter(s => (user.assignedSections || []).includes(s.id));
    
    if (userSections.length === 0) {
      toast.error('No hay secciones para este usuario');
      return;
    }

    const exportData = userSections.map(s => ({
      'Sección': s.name,
      'Casillas': (s.casillas || []).join(', ')
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Secciones');
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const dataBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
    saveAs(dataBlob, `Secciones_${user.displayName || 'Usuario'}_${format(new Date(), 'dd-MM-yyyy')}.xlsx`);
  };

  const handleDeleteSection = async (sectionId: string, uid: string) => {
    try {
      await deleteDoc(doc(db, 'sections', sectionId));
      
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const currentAssigned = userSnap.data().assignedSections || [];
        const next = currentAssigned.filter((id: string) => id !== sectionId);
        await updateDoc(userRef, { assignedSections: next });
      }
      
      // Clear selection if deleted
      setSelectedUSections(prev => prev.filter(id => id !== sectionId));
      toast.success('Sección eliminada');
    } catch (e) {
      console.error(e);
      toast.error('Error al eliminar');
    }
  };

  const handleBulkDeleteUserSections = async (uid: string) => {
    if (selectedUSections.length === 0) return;
    const toastId = toast.loading('Eliminando secciones seleccionadas...');
    try {
      const batch = writeBatch(db);
      selectedUSections.forEach(id => {
        batch.delete(doc(db, 'sections', id));
      });
      
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const currentAssigned = userSnap.data().assignedSections || [];
        const next = currentAssigned.filter((id: string) => !selectedUSections.includes(id));
        batch.update(userRef, { assignedSections: next });
      }

      await batch.commit();
      setSelectedUSections([]);
      toast.success('Secciones eliminadas correctamente', { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error('Error al eliminar masivamente', { id: toastId });
    }
  };

  const handleDeleteAllUserSections = async (uid: string) => {
    const userInModal = users.find(u => u.id === uid);
    if (!userInModal) return;

    const userSections = sections.filter(s => (userInModal.assignedSections || []).includes(s.id));
    if (userSections.length === 0) {
      toast.error('No hay secciones para eliminar');
      return;
    }
    
    const toastId = toast.loading('Eliminando todas las secciones del usuario...');
    try {
      const batch = writeBatch(db);
      userSections.forEach(s => {
        batch.delete(doc(db, 'sections', s.id));
      });
      
      batch.update(doc(db, 'users', uid), { assignedSections: [] });
      
      await batch.commit();
      setSelectedUSections([]);
      setShowUserSectionsWipeConfirm(false);
      toast.success('Todas las secciones del usuario han sido eliminadas', { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error('Error al eliminar todas las secciones', { id: toastId });
    }
  };

  const [setupError, setSetupError] = useState<string | null>(null);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail || !newUserPassword || !newUserName) {
      toast.error('Completa todos los campos');
      return;
    }

    setIsCreatingUser(true);
    setSetupError(null);
    const toastId = toast.loading('Creando cuenta de usuario...');

    try {
      // 1. Create a secondary app instance to create the user without affecting current admin session
      const secondaryApp = initializeApp(firebaseConfig, `SecondaryApp_${Date.now()}`);
      const secondaryAuth = getSecondaryAuth(secondaryApp);
      
      // 2. Format identifier (if they didn't provide email format)
      const identifier = newUserEmail.includes('@') ? newUserEmail : `${newUserEmail}@app.local`;
      
      // 3. Create the user in Firebase Auth
      let uid = '';
      try {
        const userCredential = await createSecondaryUser(secondaryAuth, identifier, newUserPassword);
        uid = userCredential.user.uid;
      } catch (authError: any) {
        if (authError.code === 'auth/email-already-in-use') {
          // Attempt to "Log in" to get the UID if the admin provided the correct password
          try {
            const loginCredential = await signInWithEmailAndPassword(secondaryAuth, identifier, newUserPassword);
            uid = loginCredential.user.uid;
            toast.info('El usuario ya existe en Auth. Sincronizando datos...', { id: toastId });
          } catch (loginError: any) {
            // Check for modern invalid-credential too
            if (loginError.code === 'auth/wrong-password' || loginError.code === 'auth/invalid-credential') {
               // Re-throw original "already in use" because password provided by admin was wrong
               throw authError; 
            }
            throw loginError;
          }
        } else {
          throw authError;
        }
      }

      // 4. Create the user document in Firestore
      await setDoc(doc(db, 'users', uid), {
        displayName: newUserName,
        email: identifier,
        role: newUserRole,
        createdAt: new Date(),
        createdBy: settings.adminEmail || 'admin'
      }, { merge: true });

      // 5. Clean up secondary app
      await signSecondaryOut(secondaryAuth);
      
      toast.success('Usuario creado correctamente', { id: toastId });
      setIsAddingUser(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserRole('user');
    } catch (error: any) {
      console.error('Error creating user:', error);
      let msg = 'Error al crear usuario';
      if (error.code === 'auth/operation-not-allowed') {
        setSetupError('email');
        msg = 'Email/Password desactivado en Firebase.';
      } else if (error.code === 'auth/email-already-in-use') {
        msg = 'El nombre de usuario/email ya existe';
      } else if (error.code === 'auth/weak-password') {
        msg = 'La contraseña debe tener al menos 6 caracteres';
      }
      toast.error(msg, { id: toastId });
    } finally {
      setIsCreatingUser(false);
    }
  };

  const [uiSettings, setUiSettings] = useState({
    primaryColor: '#4f46e5',
    backgroundColor: '#f9fafb',
    fontFamily: 'Inter, sans-serif',
    appIcon: 'Shield',
    logoUrl: 'https://i.postimg.cc/wB2pwRgz/LOGO-ACTUAL-HUGO.jpg',
    dashboardOrder: ['welcome', 'form', 'activity'],
    sidebarOrder: ['dashboard', 'sections', 'evidence', 'admin'],
    headerLayout: ['logo', 'title', 'user'],
    loginOrder: ['icon', 'title', 'description', 'form', 'google', 'footer'],
    evidenceEnabled: true,
    evidenceStartDate: '',
    evidenceEndDate: ''
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
    setSections(contextSections);
    setLayoutSections(contextSections);
  }, [contextSections]);

  useEffect(() => {
    if (contextRegistrations.length > 0) {
      setRegistrations(contextRegistrations);
    }
  }, [contextRegistrations]);

  useEffect(() => {
    if (settings) {
      const mergedSidebarOrder = Array.from(new Set([
        ...(settings.sidebarOrder || []),
        'sections',
        'evidence'
      ]));

      setUiSettings(prev => ({ 
        ...prev, 
        ...settings,
        dashboardOrder: settings.dashboardOrder || prev.dashboardOrder,
        sidebarOrder: mergedSidebarOrder,
        headerLayout: settings.headerLayout || prev.headerLayout,
        loginOrder: settings.loginOrder || prev.loginOrder
      }));
    }
  }, [settings]);

  useEffect(() => {
    // Fetch Users (Keep this one here as it's admin-only and specific to this page)
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    const unsubEvidence = onSnapshot(collection(db, 'evidence'), (snap) => {
      setEvidence(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error("Evidence listener error:", error);
      // Don't throw here to avoid crashing the whole admin panel
    });

    return () => {
      unsubUsers();
      unsubEvidence();
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

  const updateEvidenceStatus = async (id: string, status: string) => {
    try {
      await updateDoc(doc(db, 'evidence', id), { status });
      toast.success(status === 'approved' ? 'Evidencia aprobada' : 'Evidencia rechazada');
    } catch (e) {
      toast.error('Error al actualizar estado');
    }
  };

  const updateEvidenceFeedback = async (id: string, feedback: string) => {
    try {
      await updateDoc(doc(db, 'evidence', id), { feedback });
      toast.success('Retroalimentación guardada');
    } catch (e) {
      toast.error('Error al guardar comentario');
    }
  };

  const handleDeleteEvidence = async (id: string) => {
    console.log("Attempting to delete evidence:", id);
    const toastId = toast.loading('Eliminando evidencia...');
    try {
      const docRef = doc(db, 'evidence', id);
      await deleteDoc(docRef);
      toast.success('Evidencia eliminada', { id: toastId });
      setEvidenceToDelete(null);
    } catch (e: any) {
      console.error("Full delete evidence error:", e);
      const errorMessage = e.message || 'Error desconocido';
      toast.error(`Error al eliminar: ${errorMessage}`, { id: toastId });
      
      if (errorMessage.includes('permission')) {
        console.error("Permission denied for deletion. Current user:", auth.currentUser?.email);
      }
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
          'Casilla': reg.casilla || 'N/A',
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
  const [newSectionCasillas, setNewSectionCasillas] = useState('');

  const handleAddSection = async () => {
    if (!newSectionName) return;
    const casillas = newSectionCasillas.split(',').map(c => c.trim()).filter(c => c);
    try {
      await fireAddDoc(collection(db, 'sections'), {
        name: newSectionName,
        description: '',
        order: sections.length,
        files: [],
        casillas: casillas
      });
      toast.success('Sección añadida');
      setNewSectionName('');
      setNewSectionCasillas('');
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
          const name = String(row.seccion || row.Seccion || row.SECCION || `Sección ${sections.length + index + 1}`);
          const existingSection = sections.find(s => s.name.toLowerCase() === name.toLowerCase());
          
          const casillasRaw = row.casillas || row.Casillas || row.CASILLAS || '';
          const casillas = typeof casillasRaw === 'string' 
            ? casillasRaw.split(',').map(c => c.trim()).filter(c => c)
            : (typeof casillasRaw === 'number' ? [String(casillasRaw)] : []);

          if (existingSection) {
            // Update existing section instead of duplicating
            const combinedCasillas = Array.from(new Set([...(existingSection.casillas || []), ...casillas]));
            batch.update(doc(db, 'sections', existingSection.id), { 
              casillas: combinedCasillas,
              updatedAt: serverTimestamp()
            });
          } else {
            const sectionRef = doc(collection(db, 'sections'));
            batch.set(sectionRef, {
              name,
              description: '',
              order: sections.length + index,
              files: [],
              casillas: casillas,
              createdAt: serverTimestamp()
            });
          }
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
            { id: 'users', icon: Users, label: 'Usuarios' },
            { id: 'history', icon: FileSpreadsheet, label: 'Registros' },
            { id: 'evidence', icon: Camera, label: 'Evidencia' }
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
                      {(uiSettings.headerLayout || []).map(item => (
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
                      {(uiSettings.sidebarOrder || []).map(item => (
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
                      {(uiSettings.dashboardOrder || []).map(item => (
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
                        {(layoutSections || []).map((section) => (
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
                      values={uiSettings.sidebarOrder || []} 
                      onReorder={(val) => setUiSettings({...uiSettings, sidebarOrder: val})}
                      className="space-y-2"
                    >
                      {(uiSettings.sidebarOrder || []).map((item) => (
                        <Reorder.Item key={item} value={item} className="cursor-grab active:cursor-grabbing">
                          <div className="bg-white border border-neutral-200 p-3 rounded-xl flex items-center gap-3 text-sm font-bold text-neutral-700 hover:border-indigo-600 transition-all">
                            <GripVertical className="w-4 h-4 text-neutral-300" />
                            {item === 'dashboard' && 'Panel Principal'}
                            {item === 'sections' && 'Catálogo de Secciones'}
                            {item === 'evidence' && 'Subir Evidencia'}
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
                      values={Array.from(new Set(uiSettings.headerLayout || []))} 
                      onReorder={(val) => setUiSettings({...uiSettings, headerLayout: val})}
                      className="flex gap-2 mb-8"
                    >
                      {Array.from(new Set(uiSettings.headerLayout || [])).map((item) => (
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
                      values={Array.from(new Set(uiSettings.loginOrder || []))} 
                      onReorder={(val) => setUiSettings({...uiSettings, loginOrder: val})}
                      className="space-y-2"
                    >
                      {Array.from(new Set(uiSettings.loginOrder || [])).map((item) => (
                        <Reorder.Item key={item} value={item} className="cursor-grab active:cursor-grabbing">
                          <div className="bg-white border border-neutral-200 p-3 rounded-xl flex items-center gap-3 text-sm font-bold text-neutral-700 hover:border-indigo-600 transition-all">
                            <GripVertical className="w-4 h-4 text-neutral-300" />
                            {item === 'icon' && 'Icono de Seguridad'}
                            {item === 'title' && 'Título de Bienvenida'}
                            {item === 'description' && 'Descripción/Instrucciones'}
                            {item === 'form' && 'Formulario de Email'}
                            {item === 'google' && 'Acceso Google (Admin)'}
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
                      values={Array.from(new Set(uiSettings.dashboardOrder || []))} 
                      onReorder={(val) => setUiSettings({...uiSettings, dashboardOrder: val})}
                      className="space-y-3"
                    >
                      {Array.from(new Set(uiSettings.dashboardOrder || [])).map((item) => (
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
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-8 space-y-6"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm">
              <div>
                <h2 className="text-2xl font-bold text-neutral-900">Gestión de Usuarios</h2>
                <p className="text-neutral-500 text-sm">Controla el personal y haz clic en un usuario para administrar sus secciones.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button 
                  onClick={exportUserAssignments}
                  className="bg-neutral-100 text-neutral-600 px-4 py-3 rounded-xl font-bold hover:bg-neutral-200 transition-all text-[10px] uppercase tracking-widest flex items-center gap-2 border border-neutral-200"
                >
                  <Download className="w-4 h-4" />
                  Reporte General
                </button>
                <button 
                  onClick={() => setIsAddingUser(true)}
                  className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Nuevo Usuario
                </button>
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 text-[10px] font-black uppercase tracking-widest text-neutral-500">
                  <LayoutGrid className="w-4 h-4 text-neutral-400" />
                  Catálogo: {sections.length} Secciones
                </div>
                <button 
                  onClick={() => setShowConsolidateConfirm(true)}
                  className="bg-amber-100 text-amber-700 px-4 py-3 rounded-xl font-bold hover:bg-amber-200 transition-all text-[10px] uppercase tracking-widest flex items-center gap-2 border border-amber-200"
                  title="Eliminar duplicados y consolidar catálogo"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Depurar Catálogo
                </button>
                <button 
                  onClick={() => setShowNuclearConfirm(true)}
                  className="bg-red-100 text-red-700 px-4 py-3 rounded-xl font-bold hover:bg-red-200 transition-all text-[10px] uppercase tracking-widest flex items-center gap-2 border border-red-200"
                  title="BORRAR DEFINITIVAMENTE todo excepto lo de Liz Betancourt"
                >
                  <Target className="w-4 h-4" />
                  Purga Nuclear
                </button>
                <button 
                  onClick={() => setShowWipeConfirm(true)}
                  className="p-3 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all ml-2"
                  title="Borrar todas las secciones y asignaciones"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            <ConfirmModal 
              isOpen={showConsolidateConfirm}
              onClose={() => setShowConsolidateConfirm(false)}
              onConfirm={handleConsolidateSections}
              title="¿Depurar y Consolidar Catálogo?"
              message="Esta acción buscará secciones con nombres idénticos, fusionará sus casillas y eliminará los duplicados. También actualizará automáticamente todos los registros y asignaciones de usuarios vinculados. ¿Deseas continuar?"
              type="warning"
            />

            <ConfirmModal 
              isOpen={showNuclearConfirm}
              onClose={() => setShowNuclearConfirm(false)}
              onConfirm={handleNuclearClean}
              title="¿EJECUTAR PURGA ATÓMICA?"
              message="ATENCIÓN: Se eliminarán DEFINITIVAMENTE todas las secciones que no estén asignadas al usuario de Liz Betancourt. Esta es la limpieza final para dejar solo las 72 casillas reales. ¿Estás absolutamente seguro?"
              type="danger"
              confirmText="EJECUTAR LIMPIEZA TOTAL"
            />

            <ConfirmModal 
              isOpen={showWipeConfirm}
              onClose={() => setShowWipeConfirm(false)}
              onConfirm={handleWipeSections}
              title="¿Borrar TODO el catálogo?"
              message="Esta acción es irreversible. Se eliminarán todas las secciones actuales y se quitarán las asignaciones de todos los usuarios. ¿Estás seguro?"
            />

            {/* Add User Modal */}
            <AnimatePresence>
              {isAddingUser && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl overflow-hidden"
                  >
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold text-neutral-900">Configurar Nuevo Acceso</h3>
                      <button onClick={() => setIsAddingUser(false)} className="p-2 text-neutral-400 hover:text-neutral-600 rounded-full hover:bg-neutral-50">
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {setupError === 'email' && (
                      <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                        <div className="flex items-center gap-2 mb-2 text-amber-700">
                          <ShieldCheck className="w-4 h-4" />
                          <h4 className="font-bold text-[10px] uppercase tracking-widest">Configuración Necesaria</h4>
                        </div>
                        <p className="text-[10px] text-amber-800 leading-relaxed mb-3">
                          Para crear usuarios manuales, debes habilitar el proveedor <b>Email/Password</b> en tu consola.
                        </p>
                        <a 
                          href="https://console.firebase.google.com/project/gen-lang-client-0108077873/authentication/providers"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block px-4 py-2 bg-amber-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-amber-700 transition-all"
                        >
                          Ir a la Consola
                        </a>
                      </div>
                    )}

                    <form onSubmit={handleCreateUser} className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Nombre Completo</label>
                        <input 
                          required
                          placeholder="Ej. Juan Pérez"
                          value={newUserName}
                          onChange={e => setNewUserName(e.target.value)}
                          className="w-full px-5 py-3 rounded-xl border border-neutral-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all font-medium"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Usuario (o Email)</label>
                        <input 
                          required
                          placeholder="nombre_usuario"
                          value={newUserEmail}
                          onChange={e => setNewUserEmail(e.target.value)}
                          className="w-full px-5 py-3 rounded-xl border border-neutral-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all font-medium"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Contraseña Asignada</label>
                        <input 
                          required
                          type="password"
                          placeholder="Mínimo 6 caracteres"
                          value={newUserPassword}
                          onChange={e => setNewUserPassword(e.target.value)}
                          className="w-full px-5 py-3 rounded-xl border border-neutral-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all font-medium"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Nivel de Acceso (Perfil)</label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setNewUserRole('user')}
                            className={`py-3 px-4 rounded-xl border-2 font-bold transition-all ${
                              newUserRole === 'user' 
                              ? 'border-indigo-600 bg-indigo-50 text-indigo-600' 
                              : 'border-neutral-100 bg-neutral-50 text-neutral-400 hover:border-neutral-200'
                            }`}
                          >
                            Usuario
                          </button>
                          <button
                            type="button"
                            onClick={() => setNewUserRole('admin')}
                            className={`py-3 px-4 rounded-xl border-2 font-bold transition-all ${
                              newUserRole === 'admin' 
                              ? 'border-red-600 bg-red-50 text-red-600' 
                              : 'border-neutral-100 bg-neutral-50 text-neutral-400 hover:border-neutral-200'
                            }`}
                          >
                            Administrador
                          </button>
                        </div>
                      </div>

                      <div className="pt-6">
                        <button 
                          type="submit"
                          disabled={isCreatingUser}
                          className="w-full py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all shadow-xl active:scale-[0.98] disabled:opacity-50"
                        >
                          {isCreatingUser ? 'Procesando...' : 'Crear y Guardar Credenciales'}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            <div className="bg-white rounded-[2rem] border border-neutral-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-neutral-50 border-b border-neutral-100">
                      <th className="px-6 py-4 text-[10px] uppercase font-black text-neutral-400 tracking-widest">Información de Usuario</th>
                      <th className="px-6 py-4 text-[10px] uppercase font-black text-neutral-400 tracking-widest">Usuario / Identificador</th>
                      <th className="px-6 py-4 text-[10px] uppercase font-black text-neutral-400 tracking-widest">Secciones Asignadas</th>
                      <th className="px-6 py-4 text-[10px] uppercase font-black text-neutral-400 tracking-widest text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-neutral-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div 
                            className="flex items-center gap-3 cursor-pointer group"
                            onClick={() => setAssigningSectionsUser(user)}
                          >
                            {user.photoURL ? (
                              <img src={user.photoURL} className="w-10 h-10 rounded-full" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                {user.displayName?.[0] || 'U'}
                              </div>
                            )}
                            <div className="flex flex-col">
                              <span className="font-bold text-neutral-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{user.displayName || 'Sin nombre'}</span>
                              <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Gestionar Secciones</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-medium text-neutral-600">
                          <div className="flex flex-col">
                            <span className="text-sm">{user.email || 'N/A'}</span>
                            <button 
                              onClick={() => toggleUserRole(user.id, user.role)}
                              className={`text-[9px] font-black uppercase tracking-widest mt-1 w-fit px-2 py-0.5 rounded-md border ${
                                user.role === 'admin' 
                                ? 'bg-red-50 border-red-100 text-red-600' 
                                : 'bg-blue-50 border-blue-100 text-blue-600'
                              }`}
                            >
                              {user.role === 'admin' ? 'Administrador' : 'Usuario Estándar'}
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <button 
                            onClick={() => setAssigningSectionsUser(user)}
                            className="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-neutral-900 hover:text-white transition-all flex items-center gap-1.5"
                          >
                            <Box className="w-3.5 h-3.5" />
                            {(() => {
                              // Filter to only count sections that actually exist in the DB
                              const actualSectionsCount = (user.assignedSections || []).filter((id: string) => 
                                sections.some(s => s.id === id)
                              ).length;
                              return actualSectionsCount;
                            })()} SECCIONES
                          </button>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => setUserToDelete(user.id)}
                            className="p-2.5 text-neutral-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <ConfirmModal 
              isOpen={!!userToDelete}
              onClose={() => setUserToDelete(null)}
              onConfirm={() => userToDelete && deleteUser(userToDelete)}
              title="¿Eliminar perfil de usuario?"
              message="¿Estás seguro de que deseas eliminar el registro de este usuario? (Nota: Su cuenta de acceso seguirá existiendo en Firebase Auth si fue creado manualmente, pero no tendrá acceso a este sistema)."
            />
          </motion.div>
        )}

        {activeTab === 'history' && (
          <div className="p-4 md:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div>
                <h3 className="text-lg font-bold text-neutral-900">Historial de Registros</h3>
                <p className="text-sm text-neutral-500">Consulta y descarga todos los registros realizados en tiempo real.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-2 px-4 py-2 bg-neutral-100 rounded-xl border border-neutral-200">
                  <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Resumen de Avance</span>
                  <div className="h-4 w-[1px] bg-neutral-300" />
                  <span className="text-xs font-bold text-neutral-600">
                    {registrations.length} Registros Totales
                  </span>
                  <span className="text-xs font-bold text-indigo-600">
                    ({new Set(registrations.map(r => `${r.sectionId}-${r.casilla}`)).size} Casillas Únicas)
                  </span>
                </div>
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
                    <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Casilla</th>
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
                        <span className="text-sm font-medium text-neutral-600">
                          {reg.casilla || '-'}
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
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => setEditingRegistration(reg)}
                            className="p-2 text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                            title="Editar registro"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setRegToDelete(reg.id)}
                            className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                            title="Eliminar registro"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
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

            {editingRegistration && (
              <EditRegistrationModal 
                registration={editingRegistration} 
                onClose={() => setEditingRegistration(null)} 
              />
            )}
          </div>
        )}

        {activeTab === 'evidence' && (
          <div className="p-4 md:p-8 space-y-6">
            {/* Control Panel */}
            <div className="bg-white border border-neutral-200 rounded-[2rem] p-6 shadow-sm space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg">
                    <Camera className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-neutral-900">Control de Evidencia</h4>
                    <p className="text-xs text-neutral-500">Configura la disponibilidad de carga para el equipo.</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-4 bg-neutral-50 px-4 py-2 rounded-2xl border border-neutral-100">
                    <div className="flex flex-col">
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Desde</label>
                      <input 
                        type="date"
                        value={uiSettings.evidenceStartDate || ''}
                        onChange={e => setUiSettings({...uiSettings, evidenceStartDate: e.target.value})}
                        className="bg-transparent text-xs font-bold text-neutral-700 focus:outline-none"
                      />
                    </div>
                    <div className="w-[1px] h-8 bg-neutral-200" />
                    <div className="flex flex-col">
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Hasta</label>
                      <input 
                        type="date"
                        value={uiSettings.evidenceEndDate || ''}
                        onChange={e => setUiSettings({...uiSettings, evidenceEndDate: e.target.value})}
                        className="bg-transparent text-xs font-bold text-neutral-700 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 bg-neutral-50 px-4 py-2.5 rounded-2xl border border-neutral-100">
                    <span className={`text-xs font-bold ${uiSettings.evidenceEnabled ? 'text-emerald-600' : 'text-neutral-500'}`}>
                      {uiSettings.evidenceEnabled ? 'Activo' : 'Inactivo'}
                    </span>
                    <button 
                      onClick={() => setUiSettings({...uiSettings, evidenceEnabled: !uiSettings.evidenceEnabled})}
                      className={`relative w-12 h-7 rounded-full transition-all duration-300 ${uiSettings.evidenceEnabled ? 'bg-emerald-500' : 'bg-neutral-300'}`}
                    >
                      <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all shadow-sm ${uiSettings.evidenceEnabled ? 'left-6' : 'left-1'}`} />
                    </button>
                  </div>

                  <button 
                    onClick={saveSettings}
                    className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 text-sm flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Guardar
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div>
                <h3 className="text-xl font-black text-neutral-900 tracking-tight">Capturas de Evidencia</h3>
                <p className="text-sm text-neutral-500 font-medium italic">Programas Sociales Compartidos por el equipo territorial.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                 <div className="flex items-center gap-2 px-4 py-2 bg-neutral-100 rounded-xl border border-neutral-200">
                  <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Total Evidencia</span>
                  <div className="h-4 w-[1px] bg-neutral-300" />
                  <span className="text-xs font-bold text-neutral-600">
                    {evidence.length} Registros
                  </span>
                </div>
                <button 
                  onClick={async () => {
                    const XLSX = await import('xlsx');
                    const data = evidence.map(e => ({
                      'Fecha': e.timestamp?.toDate ? format(e.timestamp.toDate(), 'dd/MM/yyyy HH:mm:ss') : 'N/A',
                      'Usuario': e.userName,
                      'Email': e.userEmail,
                      'Estado': e.status === 'pending' ? 'Pendiente' : 'Aprobado',
                      'URL Imagen': e.imageUrl.length > 32000 ? 'Base64 Largo' : e.imageUrl
                    }));
                    const ws = XLSX.utils.json_to_sheet(data);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, 'Evidencia');
                    XLSX.writeFile(wb, `Reporte_Evidencia_${format(new Date(), 'dd-MM-yyyy')}.xlsx`);
                  }}
                  className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 text-sm"
                >
                  <Download className="w-4 h-4" />
                  Exportar CSV/Excel
                </button>
                <button 
                  onClick={async () => {
                    const zip = new JSZip();
                    const folder = zip.folder("evidencias");
                    evidence.forEach((e, idx) => {
                      if (e.imageUrl.startsWith('data:image')) {
                        const base64 = e.imageUrl.split(',')[1];
                        const dateStr = e.timestamp?.toDate ? format(e.timestamp.toDate(), 'yyyyMMdd_HHmmss') : `file_${idx}`;
                        folder?.file(`evidencia_${e.userName.replace(/\s+/g, '_')}_${dateStr}.jpg`, base64, {base64: true});
                      }
                    });
                    const content = await zip.generateAsync({type: "blob"});
                    saveAs(content, `Imagenes_Evidencia_${format(new Date(), 'dd-MM-yyyy')}.zip`);
                  }}
                  className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 text-sm"
                >
                  <ImageIcon className="w-4 h-4" />
                  Descargar Imágenes (ZIP)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {evidence.map((item) => (
                <div key={item.id} className="bg-white border border-neutral-100 rounded-[2rem] overflow-hidden group hover:shadow-xl hover:shadow-neutral-100 transition-all">
                  <div className="aspect-[4/3] relative bg-neutral-100 overflow-hidden">
                    <img 
                      src={item.imageUrl} 
                      alt="Evidencia" 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-4 right-4 group-hover:opacity-100 transition-opacity z-10">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setEvidenceToDelete(item.id);
                        }}
                        className="p-2 bg-red-500 text-white rounded-xl shadow-lg hover:bg-red-600 active:scale-95 transition-all"
                        title="Eliminar registro"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
                        {item.userName?.[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-neutral-900 truncate tracking-tight">{item.userName}</p>
                        <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Registrador</p>
                      </div>
                    </div>
                    <div className="flex justify-between items-center bg-neutral-50 p-3 rounded-xl">
                      <div className="flex items-center gap-2 text-neutral-500">
                        <Clock className="w-3 h-3" />
                        <span className="text-[10px] font-bold">
                          {item.timestamp?.toDate ? format(item.timestamp.toDate(), 'dd/MM/yy HH:mm') : '...'}
                        </span>
                      </div>
                      <button 
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = item.imageUrl;
                          link.download = `evidencia_${item.userName}_${item.timestamp?.toDate ? format(item.timestamp.toDate(), 'yyyyMMdd') : 'doc'}.jpg`;
                          link.click();
                        }}
                        className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded-lg"
                        title="Descargar Foto"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setEvidenceToDelete(item.id);
                        }}
                        className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg"
                        title="Eliminar de forma permanente"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Evaluation Controls */}
                    <div className="mt-4 pt-4 border-t border-neutral-100 space-y-3">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => updateEvidenceStatus(item.id, 'approved')}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border transition-all ${item.status === 'approved' ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-100' : 'bg-transparent border-neutral-200 text-neutral-400 hover:border-emerald-500 hover:text-emerald-500'}`}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="text-[10px] font-black uppercase tracking-wider">Aprobar</span>
                        </button>
                        <button 
                          onClick={() => updateEvidenceStatus(item.id, 'rejected')}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border transition-all ${item.status === 'rejected' ? 'bg-red-500 border-red-500 text-white shadow-lg shadow-red-100' : 'bg-transparent border-neutral-200 text-neutral-400 hover:border-red-500 hover:text-red-500'}`}
                        >
                          <X className="w-4 h-4" />
                          <span className="text-[10px] font-black uppercase tracking-wider">Rechazar</span>
                        </button>
                      </div>
                      <div className="relative">
                        <textarea 
                          placeholder="Escribe retroalimentación..."
                          defaultValue={item.feedback || ''}
                          onBlur={(e) => {
                            if (e.target.value !== (item.feedback || '')) {
                              updateEvidenceFeedback(item.id, e.target.value);
                            }
                          }}
                          className="w-full text-[10px] p-3 rounded-xl bg-neutral-50 border border-neutral-100 focus:outline-none focus:border-indigo-500 min-h-[60px] resize-none font-medium text-neutral-600 placeholder:text-neutral-300"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {evidence.length === 0 && (
                <div className="col-span-full py-20 text-center space-y-4">
                  <ImageIcon className="w-16 h-16 text-neutral-100 mx-auto" />
                  <p className="text-neutral-400 font-bold">Aún no hay evidencias subidas.</p>
                </div>
              )}
            </div>

            <ConfirmModal 
              isOpen={!!evidenceToDelete}
              onClose={() => setEvidenceToDelete(null)}
              onConfirm={() => evidenceToDelete && handleDeleteEvidence(evidenceToDelete)}
              title="¿Eliminar evidencia?"
              message="¿Estás seguro de que deseas eliminar este registro de evidencia de forma permanente? Esta acción no se puede deshacer."
            />
          </div>
        )}

        <AnimatePresence>
          {assigningSectionsUser && (() => {
            const userInModal = users.find(u => u.id === assigningSectionsUser.id) || assigningSectionsUser;
            return (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-[2.5rem] p-8 w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-2xl font-black text-neutral-900 tracking-tight">Administrar Secciones</h3>
                      <p className="text-xs text-neutral-500 font-medium">Asignaciones para: <span className="text-indigo-600 font-bold">{userInModal.displayName}</span></p>
                    </div>
                    <button onClick={() => setAssigningSectionsUser(null)} className="p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50 rounded-full transition-all">
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-6 p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                    <button 
                      onClick={() => setIsAddingUserSection(true)}
                      className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100"
                    >
                      <Plus className="w-4 h-4" />
                      Agregar Manual
                    </button>
                    <label className="flex items-center gap-2 bg-white text-neutral-700 border border-neutral-200 px-4 py-2.5 rounded-xl font-bold hover:bg-neutral-50 transition-all text-[10px] uppercase tracking-widest cursor-pointer">
                      <Upload className="w-4 h-4" />
                      Importar Excel
                      <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => handleUserImportExcelInsideModal(e, userInModal.id)} />
                    </label>
                    <button 
                      onClick={() => handleExportSpecificUserSections(userInModal)}
                      className="flex items-center gap-2 bg-white text-neutral-700 border border-neutral-200 px-4 py-2.5 rounded-xl font-bold hover:bg-neutral-50 transition-all text-[10px] uppercase tracking-widest"
                    >
                      <Download className="w-4 h-4" />
                      Exportar
                    </button>
                    <button 
                      onClick={() => setShowUserSectionsWipeConfirm(true)}
                      className="flex items-center gap-2 bg-red-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-red-700 transition-all text-[10px] uppercase tracking-widest shadow-lg shadow-red-100 ml-auto"
                    >
                      <Trash2 className="w-4 h-4" />
                      Eliminar Todas
                    </button>
                    {selectedUSections.length > 0 && (
                      <button 
                        onClick={() => handleBulkDeleteUserSections(userInModal.id)}
                        className="flex items-center gap-2 bg-red-50 text-red-600 px-4 py-2.5 rounded-xl font-bold hover:bg-red-100 transition-all text-[10px] uppercase tracking-widest"
                      >
                        <Trash2 className="w-4 h-4" />
                        Borrar Seleccionadas ({selectedUSections.length})
                      </button>
                    )}
                  </div>

                  <ConfirmModal 
                    isOpen={showUserSectionsWipeConfirm}
                    onClose={() => setShowUserSectionsWipeConfirm(false)}
                    onConfirm={() => handleDeleteAllUserSections(userInModal.id)}
                    title="¿Borrar TODAS las secciones?"
                    message={`¿Estás seguro de que deseas eliminar permanentemente todas las secciones asignadas a ${userInModal.displayName}? Esta acción no se puede deshacer.`}
                  />

                  {isAddingUserSection && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className="mb-6 p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-4"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-indigo-600 uppercase">Número de Sección</label>
                          <input 
                            placeholder="Ej. 1234"
                            value={newUSectionName}
                            onChange={e => setNewUSectionName(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-indigo-200 bg-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-indigo-600 uppercase">Casillas (Comas)</label>
                          <input 
                            placeholder="Básica, Contigua 1..."
                            value={newUSectionCasillas}
                            onChange={e => setNewUSectionCasillas(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-indigo-200 bg-white"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setIsAddingUserSection(false)}
                          className="flex-1 py-3 text-neutral-500 font-bold text-xs"
                        >
                          Cancelar
                        </button>
                        <button 
                          onClick={() => handleAddManualSectionToUser(userInModal.id)}
                          className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-md"
                        >
                          Añadir Sección
                        </button>
                      </div>
                    </motion.div>
                  )}

                  <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                    {(() => {
                      const userSections = sections.filter(s => (userInModal.assignedSections || []).includes(s.id));
                      if (userSections.length === 0) {
                        return (
                          <div className="py-20 text-center space-y-3">
                            <Box className="w-12 h-12 text-neutral-200 mx-auto" />
                            <p className="text-neutral-400 font-bold">No hay secciones asignadas</p>
                          </div>
                        );
                      }
                      return userSections.map(section => {
                        const isSelected = selectedUSections.includes(section.id);
                        return (
                          <div
                            key={section.id}
                            className={`p-4 rounded-2xl border-2 flex items-center justify-between transition-all ${
                              isSelected 
                              ? 'border-indigo-600 bg-indigo-50 shadow-sm' 
                              : 'border-neutral-100 bg-white hover:border-neutral-200'
                            }`}
                          >
                            <div className="flex items-center gap-4 min-w-0">
                              <button
                                onClick={() => {
                                  setSelectedUSections(prev => 
                                    isSelected ? prev.filter(id => id !== section.id) : [...prev, section.id]
                                  );
                                }}
                                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-neutral-200 hover:border-indigo-400'}`}
                              >
                                {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
                              </button>
                              <div className="truncate">
                                <p className="font-black text-neutral-900 group-hover:text-indigo-600 transition-colors">Sección {section.name}</p>
                                <p className="text-xs text-neutral-400 font-bold uppercase tracking-widest truncate">Casillas: {section.casillas?.join(', ') || 'Global'}</p>
                              </div>
                            </div>
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={() => setFileManagingSection(section)}
                                  className="p-2 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                  title="Gestionar Archivos"
                                >
                                  <Upload className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => handleDeleteSection(section.id, userInModal.id)}
                                  className="p-2 text-neutral-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                          </div>
                        );
                      });
                    })()}
                  </div>

                  <div className="mt-8 pt-6 border-t border-neutral-100">
                    <button 
                      onClick={() => setAssigningSectionsUser(null)}
                      className="w-full py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all shadow-xl"
                    >
                      Cerrar Administración
                    </button>
                  </div>
                </motion.div>
              </div>
            );
          })()}
          {fileManagingSection && (
            <ManageSectionFilesModal 
              section={fileManagingSection} 
              onClose={() => setFileManagingSection(null)}
              onUpdate={() => {}}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function EditRegistrationModal({ registration, onClose }: any) {
  const { sections } = useGlobalState();
  const [data, setData] = useState({ ...registration });
  const [isSaving, setIsSaving] = useState(false);
  const [croppingImage, setCroppingImage] = useState<any>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor selecciona un archivo de imagen');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setCroppingImage({
        url: event.target?.result as string,
        side
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Exclude ID and original createdAt from update
      const { id, createdAt, ...updateData } = data;
      
      // Add updatedAt timestamp
      const finalUpdate = {
        ...updateData,
        updatedAt: serverTimestamp()
      };

      await updateDoc(doc(db, 'registrations', registration.id), finalUpdate);

      // Auto-assign section to responsible if it was changed and not assigned
      if (updateData.sectionId !== registration.sectionId) {
        const respId = registration.responsibleId;
        const userRef = doc(db, 'users', respId);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const currentAssigned = userSnap.data().assignedSections || [];
          if (!currentAssigned.includes(updateData.sectionId)) {
            await updateDoc(userRef, {
              assignedSections: [...currentAssigned, updateData.sectionId]
            });
            toast.info(`Sección ${updateData.sectionName} asignada automáticamente al responsable.`);
          }
        }
      }

      toast.success('Registro actualizado');
      onClose();
    } catch (e) {
      console.error("Update error:", e);
      toast.error('Error al actualizar registro');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto pt-20 pb-20">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-[2.5rem] p-8 w-full max-w-2xl shadow-2xl my-auto"
      >
        <div className="flex justify-between items-center mb-8">
          <div>
            <h3 className="text-2xl font-black text-neutral-900 leading-tight">Editar Registro</h3>
            <p className="text-xs text-neutral-400 font-bold uppercase tracking-widest mt-1">Sincronización en tiempo real</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-xl transition-all">
            <X className="w-6 h-6 text-neutral-400" />
          </button>
        </div>

        <div className="space-y-6 max-h-[60vh] overflow-y-auto px-1 pr-4 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Nombre Responsable</label>
              <input 
                value={data.personName}
                onChange={e => setData({...data, personName: e.target.value})}
                className="w-full px-5 py-3 rounded-xl border border-neutral-200 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-50 transition-all font-medium"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Teléfono</label>
              <input 
                value={data.phoneNumber}
                onChange={e => setData({...data, phoneNumber: e.target.value})}
                className="w-full px-5 py-3 rounded-xl border border-neutral-200 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-50 transition-all font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
               <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Sección</label>
               <div className="relative">
                 <select 
                   value={data.sectionId}
                   onChange={e => {
                     const selected = sections.find(s => s.id === e.target.value);
                     setData({
                       ...data, 
                       sectionId: e.target.value,
                       sectionName: selected?.name || ''
                     });
                   }}
                   className="w-full px-5 py-3 rounded-xl border border-neutral-200 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-50 transition-all font-medium appearance-none bg-white pr-10"
                 >
                   <option value="">Seleccionar Sección</option>
                   {sections.map(s => (
                     <option key={s.id} value={s.id}>{s.name}</option>
                   ))}
                 </select>
                 <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <List className="w-4 h-4 text-neutral-400" />
                 </div>
               </div>
             </div>
             <div className="space-y-2">
               <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Casilla / Tipo</label>
               <input 
                 value={data.casilla}
                 onChange={e => setData({...data, casilla: e.target.value})}
                 className="w-full px-5 py-3 rounded-xl border border-neutral-200 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-50 transition-all font-medium"
               />
             </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-neutral-100">
            <h4 className="text-xs font-black text-neutral-900 uppercase tracking-[0.2em]">Documentación (INE)</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-3">
                <p className="text-[10px] font-bold text-neutral-400 uppercase">Frente</p>
                <div className="relative group aspect-video rounded-2xl overflow-hidden border-2 border-dashed border-neutral-200 hover:border-indigo-300 transition-all bg-neutral-50 bg-cover bg-center" style={{ backgroundImage: `url(${data.ineFrontUrl})` }}>
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <label className="p-3 bg-white text-indigo-600 rounded-xl cursor-pointer hover:scale-110 transition-transform shadow-lg">
                      <ImageIcon className="w-5 h-5" />
                      <input type="file" className="hidden" accept="image/*" onChange={e => handleFileUpload(e, 'front')} />
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-bold text-neutral-400 uppercase">Reverso</p>
                <div className="relative group aspect-video rounded-2xl overflow-hidden border-2 border-dashed border-neutral-200 hover:border-indigo-300 transition-all bg-neutral-50 bg-cover bg-center" style={{ backgroundImage: `url(${data.ineBackUrl})` }}>
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <label className="p-3 bg-white text-indigo-600 rounded-xl cursor-pointer hover:scale-110 transition-transform shadow-lg">
                      <ImageIcon className="w-5 h-5" />
                      <input type="file" className="hidden" accept="image/*" onChange={e => handleFileUpload(e, 'back')} />
                    </label>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-neutral-400 italic font-medium">Pulsa el icono de imagen sobre la foto para subir una nueva.</p>
          </div>
        </div>

        {croppingImage && (
          <ImageCropperModal 
            image={croppingImage.url} 
            onClose={() => setCroppingImage(null)} 
            onConfirm={(croppedImage: string) => {
              if (croppingImage.side === 'front') setData({ ...data, ineFrontUrl: croppedImage });
              else setData({ ...data, ineBackUrl: croppedImage });
              setCroppingImage(null);
            }} 
          />
        )}

        <div className="mt-10 flex gap-4 pt-6 border-t border-neutral-100">
          <button 
            onClick={onClose} 
            className="flex-1 py-4 text-neutral-500 font-black uppercase tracking-widest hover:bg-neutral-50 rounded-2xl transition-all"
          >
            Cancelar
          </button>
          <button 
            disabled={isSaving} 
            onClick={handleSave} 
            className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Actualizando...
              </span>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Guardar Cambios
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function ImageCropperModal({ image, onClose, onConfirm }: any) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  const onCropComplete = (croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const handleConfirm = async () => {
    try {
      const croppedImage = await getCroppedImg(image, croppedAreaPixels);
      onConfirm(croppedImage);
    } catch (e) {
      console.error(e);
      toast.error('Error al recortar la imagen');
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <div className="bg-neutral-900 rounded-[2.5rem] w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden shadow-2xl border border-white/10">
        <div className="p-6 flex justify-between items-center bg-black/40 border-b border-white/5">
          <div>
            <h3 className="text-xl font-black text-white leading-tight">Recortar INE</h3>
            <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-0.5">Ajusta la imagen al recuadro</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all">
            <X className="w-6 h-6 text-white/40" />
          </button>
        </div>
        
        <div className="flex-1 relative bg-black">
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            aspect={16 / 10}
            onCropChange={setCrop}
            onCropComplete={onCropComplete}
            onZoomChange={setZoom}
          />
        </div>

        <div className="p-8 bg-black/40 border-t border-white/5 space-y-6">
          <div className="flex items-center gap-6">
            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Zoom</span>
            <input 
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>
          
          <div className="flex gap-4">
            <button 
              onClick={onClose} 
              className="flex-1 py-4 text-white/60 font-black uppercase tracking-widest hover:bg-white/5 rounded-2xl transition-all border border-white/10"
            >
              Cancelar
            </button>
            <button 
              onClick={handleConfirm} 
              className="flex-[2] py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest hover:bg-neutral-200 transition-all shadow-xl flex items-center justify-center gap-2"
            >
              <Scissors className="w-4 h-4" />
              Recortar y Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

async function getCroppedImg(imageSrc: string, pixelCrop: any): Promise<string> {
  const image = new Image();
  image.src = imageSrc;
  await new Promise((resolve) => (image.onload = resolve));

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) return;
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
    }, 'image/jpeg', 0.85);
  });
}

function ManageSectionFilesModal({ section, onClose, onUpdate }: any) {
  const [data, setData] = useState({ ...section, files: section.files || [] });
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const url = e.target?.result as string;
        let type = 'link';
        if (file.type === 'application/pdf') type = 'pdf';
        else if (file.type.includes('excel') || file.type.includes('spreadsheetml') || file.name.endsWith('.xlsx')) type = 'excel';
        else if (file.type.startsWith('image/')) type = 'image';
        else if (file.type.startsWith('video/')) type = 'video';
        
        setData((prev: any) => ({ ...prev, files: [...prev.files, { name: file.name, url, type }] }));
      };
      reader.readAsDataURL(file);
    });
  };

  const addFileByUrl = () => {
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

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'sections', section.id), { files: data.files });
      toast.success('Archivos actualizados');
      onUpdate();
      onClose();
    } catch (e) {
      toast.error('Error al guardar archivos');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-[2.5rem] p-8 w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-600 rounded-2xl text-white">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-neutral-900 leading-tight">Gestionar Contenido</h3>
              <p className="text-sm text-neutral-500 font-bold uppercase tracking-widest mt-1">Sección {section.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-xl transition-all">
            <X className="w-6 h-6 text-neutral-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
          <div 
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
            className={`relative border-2 border-dashed rounded-3xl p-10 transition-all flex flex-col items-center justify-center gap-4 group cursor-pointer ${
              isDragging 
              ? 'border-indigo-600 bg-indigo-50' 
              : 'border-neutral-100 bg-neutral-50 hover:border-neutral-200 shadow-inner'
            }`}
          >
            <input 
              type="file" 
              multiple 
              className="absolute inset-0 opacity-0 cursor-pointer" 
              onChange={(e) => handleFiles(e.target.files)}
            />
            <div className={`p-4 rounded-2xl transition-all ${isDragging ? 'bg-indigo-600 text-white scale-110' : 'bg-white text-neutral-400 group-hover:text-indigo-600 shadow-md group-hover:shadow-indigo-100'}`}>
              <FileUp className="w-8 h-8" />
            </div>
            <div className="text-center">
              <p className="text-lg font-black text-neutral-900 mb-1">Suelta tus archivos aquí</p>
              <p className="text-sm text-neutral-500 font-bold uppercase tracking-tighter">Excel, PDF, Documentos e Imágenes</p>
            </div>
          </div>

          <div className="flex justify-between items-center px-2">
            <span className="text-sm font-black text-neutral-400 uppercase tracking-widest">{data.files.length} Archivos en biblioteca</span>
            <button onClick={addFileByUrl} className="text-xs font-black text-indigo-600 hover:underline uppercase tracking-widest">
              + Añadir por URL
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {data.files.map((f: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-4 bg-neutral-50 rounded-2xl border border-neutral-100 group hover:border-indigo-100 transition-all">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-white border border-neutral-200 flex items-center justify-center flex-shrink-0 shadow-sm">
                    {f.type === 'pdf' && <FileText className="w-6 h-6 text-red-500" />}
                    {f.type === 'excel' && <FileSpreadsheet className="w-6 h-6 text-emerald-500" />}
                    {f.type === 'image' && <ImageIcon className="w-6 h-6 text-indigo-500" />}
                    {(f.type === 'video' || f.type === 'link') && <LinkIcon className="w-6 h-6 text-amber-500" />}
                  </div>
                  <div className="truncate">
                    <p className="text-sm font-black text-neutral-900 truncate">{f.name}</p>
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{f.type === 'link' ? 'Vínculo Externo' : f.type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a 
                    href={f.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-2 text-neutral-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all shadow-sm opacity-0 group-hover:opacity-100"
                    title="Previsualizar"
                  >
                    <Eye className="w-4 h-4" />
                  </a>
                  <button 
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = f.url;
                      link.download = f.name;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="p-2 text-neutral-400 hover:text-emerald-600 hover:bg-white rounded-xl transition-all shadow-sm opacity-0 group-hover:opacity-100"
                    title="Descargar"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => removeFile(i)}
                    className="p-2 text-neutral-300 hover:text-red-500 hover:bg-white rounded-xl transition-all shadow-sm opacity-0 group-hover:opacity-100"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 flex gap-4 pt-6 border-t border-neutral-100">
          <button 
            onClick={onClose}
            className="flex-1 py-4 text-neutral-500 font-black uppercase tracking-widest hover:bg-neutral-50 rounded-2xl transition-all"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 disabled:opacity-50"
          >
            {isSaving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

