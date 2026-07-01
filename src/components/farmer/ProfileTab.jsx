// ProfileTab.jsx — FR-F01, FR-F04, FR-F05
// Register farmer account, reset password, update profile
import React, { useState, useEffect } from 'react';
import { User, Save, Mail, Phone, Key, CheckCircle2, AlertTriangle, Home, UserPlus, Plus, Check } from 'lucide-react';
import {
  updateProfile, sendPasswordResetEmail, updateEmail
} from 'firebase/auth';
import { doc, updateDoc, Timestamp, getDoc, setDoc, addDoc, collection } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut as authSignOut } from 'firebase/auth';
import { auth, db, firebaseConfig } from '../../firebase';

export default function ProfileTab({ userEmail, userId }) {
  const [profile, setProfile] = useState({
    name: '', phone: '', farmName: '', email: userEmail || ''
  });
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState({ text: '', type: '' });
  const [resetSent, setResetSent] = useState(false);

  // Co-farmer registration states (FR-F01)
  const [coFarmerName, setCoFarmerName]   = useState('');
  const [coFarmerEmail, setCoFarmerEmail] = useState('');
  const [coFarmerPhone, setCoFarmerPhone] = useState('');
  const [coFarmerFarm, setCoFarmerFarm]   = useState('');

  const [isProvisioning, setIsProvisioning]       = useState(false);
  const [provisionError, setProvisionError]       = useState('');
  const [tempPasswordInfo, setTempPasswordInfo]   = useState(null);

  // Load current profile from Firestore
  useEffect(() => {
    if (!userId) return;
    getDoc(doc(db, 'users', userId)).then(snap => {
      if (snap.exists()) {
        const d = snap.data();
        setProfile({
          name:     d.name     || '',
          phone:    d.phone    || '',
          farmName: d.farmName || '',
          email:    d.email    || userEmail || ''
        });
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [userId]);

  const showMsg = (text, type = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 4000);
  };

  // FR-F05: Update profile information
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Update Firestore user document
      await setDoc(doc(db, 'users', userId || 'farmer-uid-001'), {
        name:      profile.name,
        phone:     profile.phone,
        farmName:  profile.farmName,
        email:     profile.email,
        updatedAt: Timestamp.now()
      }, { merge: true });

      // Update Firebase Auth display name
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: profile.name });
      }
      showMsg('Profile updated successfully!', 'success');
    } catch (err) {
      showMsg('Error updating profile: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // FR-F04: Reset password via email
  const handleResetPassword = async () => {
    try {
      await sendPasswordResetEmail(auth, userEmail);
      setResetSent(true);
      showMsg(`Password reset email sent to ${userEmail}`, 'success');
    } catch (err) {
      showMsg('Error sending reset email: ' + err.message, 'error');
    }
  };

  // FR-F01: Register Co-Farmer Account (locked to 'farmer' role only)
  const handleRegisterFarmer = async (e) => {
    e.preventDefault();
    if (!coFarmerName || !coFarmerEmail) return;
    setIsProvisioning(true);
    setProvisionError('');
    setTempPasswordInfo(null);

    // Generate random mixed temporary password
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
    let tempPassword = 'Farmer@';
    for (let i = 0; i < 4; i++) {
      tempPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    let secondaryApp = null;
    try {
      // Create co-farmer auth account without logging current farmer out
      const secondaryAppName = `FarmerApp-${Date.now()}`;
      secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
      const secondaryAuth = getAuth(secondaryApp);

      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, coFarmerEmail, tempPassword);
      const uid = userCredential.user.uid;

      await authSignOut(secondaryAuth);

      // Save user to Firestore with Farmer role explicitly forced
      const data = {
        uid: uid,
        name: coFarmerName,
        email: coFarmerEmail,
        role: 'farmer',
        phone: coFarmerPhone,
        profileImageUrl: '',
        farmName: coFarmerFarm || profile.farmName || '',
        licenseNumber: '',
        assignedAnimals: [],
        isActive: true,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        lastLoginAt: null
      };

      await setDoc(doc(db, 'users', uid), data);

      // Write to audit log
      await addDoc(collection(db, 'audit_logs'), {
        actorId: userId || 'farmer-uid-001',
        actorRole: 'farmer',
        actorEmail: userEmail,
        action: 'user.created',
        targetId: uid,
        targetType: 'user',
        details: `Farmer ${userEmail} registered co-farmer account: ${coFarmerEmail}`,
        ipAddress: '—',
        timestamp: Timestamp.now()
      });

      setTempPasswordInfo({
        email: coFarmerEmail,
        password: tempPassword
      });

      // Clear input fields
      setCoFarmerName('');
      setCoFarmerEmail('');
      setCoFarmerPhone('');
      setCoFarmerFarm('');
    } catch (err) {
      console.error('Co-farmer registration failed: ', err);
      let errorMsg = err.message;
      if (err.code === 'auth/email-already-in-use') {
        errorMsg = 'This email address is already registered in the system.';
      } else if (err.code === 'auth/invalid-email') {
        errorMsg = 'Please enter a valid email address.';
      }
      setProvisionError(errorMsg);
    } finally {
      setIsProvisioning(false);
      if (secondaryApp) {
        try {
          await deleteApp(secondaryApp);
        } catch (e) {
          console.error('Error deleting secondary app: ', e);
        }
      }
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>Loading profile...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '700px', margin: '0 auto', width: '100%' }}>

      {/* Profile Header */}
      <div className="map-card-wrapper" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(16,185,129,0.1)', border: '2px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <User size={28} color="var(--primary)" />
        </div>
        <div>
          <h3 style={{ color: '#fff', fontFamily: 'var(--font-heading)', fontSize: '1.25rem', margin: 0 }}>
            {profile.name || 'Farmer Account'}
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '0.25rem 0 0 0' }}>{userEmail}</p>
          <span style={{ fontSize: '0.68rem', color: 'var(--primary)', background: 'rgba(16,185,129,0.08)', padding: '0.15rem 0.6rem', borderRadius: '20px', marginTop: '0.4rem', display: 'inline-block' }}>FARMER ROLE</span>
        </div>
      </div>

      {msg.text && (
        <div className={`feedback-message ${msg.type === 'success' ? 'feedback-success' : 'feedback-error'}`}>
          {msg.type === 'success' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* FR-F05: Update Profile Form */}
      <div className="map-card-wrapper" style={{ padding: '1.5rem' }}>
        <h4 style={{ color: '#fff', fontFamily: 'var(--font-heading)', fontSize: '1.1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <User size={18} color="var(--primary)" /> FR-F05 — Update Profile Information
        </h4>
        <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            {[
              { key: 'name',     label: 'Full Name',       icon: User, type: 'text' },
              { key: 'phone',    label: 'Phone Number',     icon: Phone, type: 'tel' },
              { key: 'farmName', label: 'Farm Name',        icon: Home, type: 'text' },
              { key: 'email',    label: 'Email Address',    icon: Mail, type: 'email' },
            ].map(({ key, label, icon: Icon, type }) => (
              <div key={key} className="form-group" style={{ marginBottom: 0 }}>
                <div className="input-container">
                  <input
                    type={type}
                    className="form-input"
                    style={{ paddingLeft: '1rem' }}
                    placeholder=" "
                    value={profile[key]}
                    onChange={e => setProfile({ ...profile, [key]: e.target.value })}
                    readOnly={key === 'email'}
                    style={{ paddingLeft: '1rem', opacity: key === 'email' ? 0.6 : 1 }}
                  />
                  <label className="floating-label" style={{ left: '1rem' }}>{label}</label>
                </div>
              </div>
            ))}
          </div>
          <button type="submit" className="btn-primary" disabled={saving} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Save size={16} /> {saving ? 'Saving...' : 'Update Profile'}
          </button>
        </form>
      </div>

      {/* FR-F01: Provision Co-Farmer Account */}
      <div className="map-card-wrapper" style={{ padding: '1.5rem' }}>
        <h4 style={{ color: '#fff', fontFamily: 'var(--font-heading)', fontSize: '1.1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <UserPlus size={18} color="var(--primary)" /> FR-F01 — Provision Co-Farmer Account
        </h4>

        {/* Temporary password notification */}
        {tempPasswordInfo && (
          <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid var(--primary)', borderRadius: '12px', padding: '1rem', marginBottom: '1.25rem' }}>
            <h5 style={{ color: 'var(--primary)', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}>
              <Check size={16} /> Co-Farmer Registered!
            </h5>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 0.5rem 0' }}>
              An account has been created for <strong style={{ color: '#fff' }}>{tempPasswordInfo.email}</strong> with the role <strong>Farmer</strong>.
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 0.75rem 0' }}>
              Temporary Password: <strong style={{ color: 'var(--primary)', fontSize: '0.95rem', background: 'rgba(16, 185, 129, 0.15)', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>{tempPasswordInfo.password}</strong>
            </p>
            <button type="button" className="btn-logout" onClick={() => setTempPasswordInfo(null)} style={{ padding: '0.35rem 0.75rem', fontSize: '0.72rem' }}>
              Dismiss
            </button>
          </div>
        )}

        {/* Error notification */}
        {provisionError && (
          <div className="feedback-message feedback-error" style={{ marginBottom: '1.25rem', marginTop: 0 }}>
            <span style={{ fontWeight: 'bold' }}>Error:</span> {provisionError}
          </div>
        )}

        <form onSubmit={handleRegisterFarmer} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <div className="input-container">
                <input type="text" className="form-input" style={{ paddingLeft: '1rem' }} placeholder=" " value={coFarmerName} onChange={e => setCoFarmerName(e.target.value)} required disabled={isProvisioning} />
                <label className="floating-label" style={{ left: '1rem' }}>Co-Farmer Name</label>
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <div className="input-container">
                <input type="email" className="form-input" style={{ paddingLeft: '1rem' }} placeholder=" " value={coFarmerEmail} onChange={e => setCoFarmerEmail(e.target.value)} required disabled={isProvisioning} />
                <label className="floating-label" style={{ left: '1rem' }}>Email Address</label>
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <div className="input-container">
                <input type="tel" className="form-input" style={{ paddingLeft: '1rem' }} placeholder=" " value={coFarmerPhone} onChange={e => setCoFarmerPhone(e.target.value)} disabled={isProvisioning} />
                <label className="floating-label" style={{ left: '1rem' }}>Phone Number (Optional)</label>
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <div className="input-container">
                <input type="text" className="form-input" style={{ paddingLeft: '1rem' }} placeholder=" " value={coFarmerFarm} onChange={e => setCoFarmerFarm(e.target.value)} disabled={isProvisioning} />
                <label className="floating-label" style={{ left: '1rem' }}>Farm Name (Optional)</label>
              </div>
            </div>
          </div>
          
          <button type="submit" className="btn-primary" disabled={isProvisioning} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {isProvisioning ? (
              <>
                <span className="spinner" style={{ borderTopColor: '#060913' }}></span>
                <span>Registering...</span>
              </>
            ) : (
              <>
                <Plus size={16} /> Register Farmer Account
              </>
            )}
          </button>
        </form>
      </div>

      {/* FR-F04: Password Reset */}
      <div className="map-card-wrapper" style={{ padding: '1.5rem' }}>
        <h4 style={{ color: '#fff', fontFamily: 'var(--font-heading)', fontSize: '1.1rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Key size={18} color="var(--warning)" /> FR-F04 — Reset Password
        </h4>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '0 0 1.25rem 0' }}>
          A secure password reset link will be sent to <strong style={{ color: '#fff' }}>{userEmail}</strong>. Click the link in the email to set a new password.
        </p>
        <button
          className="btn-logout"
          onClick={handleResetPassword}
          disabled={resetSent}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderColor: resetSent ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)', color: resetSent ? 'var(--primary)' : 'var(--warning)' }}
        >
          {resetSent ? <><CheckCircle2 size={16} /> Reset Email Sent!</> : <><Mail size={16} /> Send Password Reset Email</>}
        </button>
      </div>

      {/* Account Info */}
      <div className="map-card-wrapper" style={{ padding: '1.5rem' }}>
        <h4 style={{ color: '#fff', fontFamily: 'var(--font-heading)', fontSize: '1.1rem', marginBottom: '1rem' }}>Account Details</h4>
        {[
          ['Account Email', userEmail],
          ['User ID', userId || '—'],
          ['Account Type', 'Farmer — Primary System User'],
          ['System Access', 'Animal Management, Live Monitoring, GPS Tracking, Alerts, Reports'],
        ].map(([label, value]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', padding: '0.6rem 0', fontSize: '0.8rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>{label}</span>
            <span style={{ color: '#fff', maxWidth: '55%', textAlign: 'right', wordBreak: 'break-all' }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
