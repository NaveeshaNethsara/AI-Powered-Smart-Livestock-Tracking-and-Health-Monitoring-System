import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, getDocs, query, collection, where, setDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import Login from './components/Login';
import FarmerDashboard from './components/farmer/FarmerDashboard';
import VetDashboard from './components/VetDashboard';
import AdminDashboard from './components/AdminDashboard';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userId, setUserId]       = useState('');
  const [userRole, setUserRole] = useState('farmer'); // 'farmer', 'vet', 'admin'
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Monitor Firebase Authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setIsAuthLoading(true);
      if (user) {
        setUserEmail(user.email);
        setUserId(user.uid);
        
        // Resolve user role from Firestore profile
        try {
          const docRef  = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists() && docSnap.data().isActive !== false && docSnap.data().role) {
            // Normal case — user has an active profile
            setUserRole(docSnap.data().role.toLowerCase());
          } else if (!docSnap.exists()) {
            // No Firestore profile yet — check pendingUsers (admin provisioned but orphaned auth)
            const pendQ  = query(collection(db, 'pendingUsers'), where('email', '==', user.email));
            const pendSnap = await getDocs(pendQ);

            if (!pendSnap.empty) {
              // Found a pending record — migrate it to users/{uid}
              const pd = pendSnap.docs[0].data();
              await setDoc(doc(db, 'users', user.uid), {
                uid:             user.uid,
                name:            pd.name   || user.email.split('@')[0],
                email:           pd.email,
                role:            pd.role   || 'farmer',
                phone:           '',
                profileImageUrl: '',
                farmName:        '',
                licenseNumber:   '',
                assignedAnimals: [],
                isActive:        true,
                createdAt:       Timestamp.now(),
                updatedAt:       Timestamp.now(),
                lastLoginAt:     Timestamp.now()
              });
              // Delete the pending placeholder
              await deleteDoc(pendSnap.docs[0].ref);
              setUserRole((pd.role || 'farmer').toLowerCase());
            } else {
              // Truly unknown user — apply email heuristic
              const emailUsername = user.email.toLowerCase().split('@')[0];
              if (emailUsername === 'admin' || emailUsername.startsWith('admin')) {
                setUserRole('admin');
              } else if (emailUsername === 'vet' || emailUsername === 'veterinarian' || emailUsername.startsWith('vet')) {
                setUserRole('vet');
              } else {
                setUserRole('farmer');
              }
            }
          } else {
            // Doc exists but deactivated — still let them in (profile tab will show status)
            setUserRole((docSnap.data().role || 'farmer').toLowerCase());
          }
        } catch (error) {
          console.error('Error fetching role from Firestore: ', error);
          // Safety fallback on connection or permission error
          const emailUsername = user.email.toLowerCase().split('@')[0];
          if (emailUsername === 'admin' || emailUsername.startsWith('admin')) {
            setUserRole('admin');
          } else if (emailUsername === 'vet' || emailUsername === 'veterinarian' || emailUsername.startsWith('vet')) {
            setUserRole('vet');
          } else {
            setUserRole('farmer');
          }
        }
        setIsLoggedIn(true);
      } else {
        setUserEmail('');
        setUserId('');
        setUserRole('farmer');
        setIsLoggedIn(false);
      }
      setIsAuthLoading(false);
    });

    // Clean up listener subscription on unmount
    return () => unsubscribe();
  }, []);

  const handleLoginSuccess = (email) => {
    setUserEmail(email);
    // Role selection is handled asynchronously by the onAuthStateChanged listener
  };

  const handleLogout = () => {
    signOut(auth)
      .then(() => {
        setIsLoggedIn(false);
        setUserEmail('');
        setUserId('');
        setUserRole('farmer');
      })
      .catch((err) => {
        console.error('Logout error:', err);
      });
  };

  // Render a premium splash screen loader while verifying credentials
  if (isAuthLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        width: '100vw', 
        height: '100vh', 
        backgroundColor: '#060913', 
        color: '#fff' 
      }}>
        <div className="spinner" style={{ 
          width: '36px', 
          height: '36px', 
          borderWidth: '3.5px', 
          borderTopColor: 'var(--primary)', 
          marginBottom: '1.25rem' 
        }}></div>
        <p style={{ 
          fontFamily: 'Outfit, sans-serif', 
          fontWeight: 600,
          color: 'var(--text-muted)', 
          fontSize: '0.8rem', 
          letterSpacing: '0.08em',
          textTransform: 'uppercase'
        }}>
          Establishing telemetry gateway...
        </p>
      </div>
    );
  }

  // Dashboard component router based on user roles
  const renderDashboardByRole = () => {
    switch (userRole) {
      case 'admin':
        return <AdminDashboard onLogout={handleLogout} userEmail={userEmail} />;
      case 'vet':
        return <VetDashboard onLogout={handleLogout} userEmail={userEmail} userId={userId} />;
      case 'farmer':
      default:
        return <FarmerDashboard onLogout={handleLogout} userEmail={userEmail} userId={userId} />;
    }
  };

  return (
    isLoggedIn ? (
      renderDashboardByRole()
    ) : (
      <Login onLoginSuccess={handleLoginSuccess} />
    )
  );
}

export default App;
