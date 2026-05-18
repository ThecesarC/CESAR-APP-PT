import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  doc, 
  onSnapshot, 
  collection, 
  query, 
  orderBy,
  getCountFromServer,
  getDocs,
  limit
} from 'firebase/firestore';

interface GlobalState {
  settings: any;
  sections: any[];
  registrations: any[];
  evidence: any[];
  users: any[];
  userProfile: any;
  registrationCount: number;
  totalCasillasCount: number;
  loading: boolean;
  refreshCount: () => Promise<void>;
}

const GlobalStateContext = createContext<GlobalState | undefined>(undefined);

export function GlobalStateProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<any>(null);
  const [sections, setSections] = useState<any[]>([]);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [evidence, setEvidence] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [registrationCount, setRegistrationCount] = useState(0);
  const [totalCasillasCount, setTotalCasillasCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUid, setCurrentUid] = useState<string | null>(null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user);
      setCurrentUid(user?.uid || null);
    });
    return () => unsubAuth();
  }, []);

  const refreshCount = async () => {
    try {
      const coll = collection(db, 'registrations');
      const snapshot = await getCountFromServer(coll);
      setRegistrationCount(snapshot.data().count);
      
      const sectionsColl = collection(db, 'sections');
      const sectionsSnap = await getDocs(query(sectionsColl, limit(500)));
      let total = 0;
      sectionsSnap.forEach(doc => {
        const data = doc.data();
        total += (data.casillas?.length || 1);
      });
      setTotalCasillasCount(total);

      // If we are restricted, also fetch a small sample of registrations to keep UI moving
      const qRegs = query(collection(db, 'registrations'), orderBy('createdAt', 'desc'), limit(100));
      const regsSnap = await getDocs(qRegs);
      setRegistrations(regsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error("Error refreshing count:", e);
    }
  };

  useEffect(() => {
    // 1. Settings Listener (Public read in rules) - No list, just one doc, low impact
    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (d) => {
      if (d.exists()) {
        setSettings(d.data());
      }
    }, (error) => {
      console.error("Settings listener error:", error);
    });

    if (!isAuthenticated || !currentUid) {
      setSections([]);
      setRegistrations([]);
      setEvidence([]);
      setUsers([]);
      setUserProfile(null);
      setLoading(false);
      setTotalCasillasCount(0);
      return () => unsubSettings();
    }

    // 1.5 User Profile Listener - One doc, low impact
    const unsubProfile = onSnapshot(doc(db, 'users', currentUid), (snap) => {
      setUserProfile(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    }, (err) => console.error("Profile listener quota or error:", err));

    // 2. Sections Listener - Usually small set (e.g. 50-100 sections)
    const qSections = query(collection(db, 'sections'), orderBy('order', 'asc'), limit(500));
    const unsubSections = onSnapshot(qSections, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setSections(docs);
      const total = docs.reduce((acc, s: any) => acc + (s.casillas?.length || 1), 0);
      setTotalCasillasCount(total);
    }, (error) => {
      console.error("Sections listener error:", error);
    });

    // 3. Registrations Listener - CRITICAL: ADD LIMIT
    // We only fetch the last 150 registrations in real-time to save quota
    const qRegs = query(collection(db, 'registrations'), orderBy('createdAt', 'desc'), limit(150));
    const unsubRegs = onSnapshot(qRegs, (snap) => {
      setRegistrations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      // Note: registrationCount might be inaccurate if limited, but we use it for activity mostly
      // We can use a separate count or refresh it
      if (snap.size < 150) {
        setRegistrationCount(snap.size);
      }
      setLoading(false);
    }, (error) => {
      console.error("Registrations listener quota error:", error);
      setLoading(false);
    });
    
    // 3.5 Evidence Listener - CRITICAL: ADD LIMIT
    const qEvidence = query(collection(db, 'evidence'), orderBy('timestamp', 'desc'), limit(100));
    const unsubEvidence = onSnapshot(qEvidence, (snap) => {
      setEvidence(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error("Evidence listener error:", error);
    });

    // 4. Users Listener - CRITICAL: ADD LIMIT
    let unsubUsers = () => {};
    const qUsers = query(collection(db, 'users'), limit(200));
    unsubUsers = onSnapshot(qUsers, (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.log("Users list restricted or quota hit");
    });

    return () => {
      unsubSettings();
      unsubProfile();
      unsubUsers();
      unsubSections();
      unsubEvidence();
      unsubRegs();
    };
  }, [isAuthenticated, currentUid]);

  return (
    <GlobalStateContext.Provider value={{ 
      settings, 
      sections, 
      registrations, 
      evidence,
      users,
      userProfile,
      registrationCount, 
      totalCasillasCount,
      loading,
      refreshCount
    }}>
      {children}
    </GlobalStateContext.Provider>
  );
}

export function useGlobalState() {
  const context = useContext(GlobalStateContext);
  if (context === undefined) {
    throw new Error('useGlobalState must be used within a GlobalStateProvider');
  }
  return context;
}
