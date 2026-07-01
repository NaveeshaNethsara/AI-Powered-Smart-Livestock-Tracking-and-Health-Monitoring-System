import React, { useState } from 'react';
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  Activity, 
  MapPin, 
  TrendingUp, 
  ShieldCheck, 
  ArrowRight,
  Wifi
} from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  
  // Status states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Client-side validations
    if (!email) {
      setError('Email address is required.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setError('Password is required.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);

    // Call real Firebase Authentication API
    signInWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        setIsLoading(false);
        setSuccess('Authentication successful! Initializing telemetry dashboard...');
        setTimeout(() => {
          if (onLoginSuccess) {
            onLoginSuccess(userCredential.user.email);
          }
        }, 800);
      })
      .catch((err) => {
        setIsLoading(false);
        console.error('Firebase Auth Error:', err.code, err.message);
        
        // Translate error codes to clear user-facing messages
        let message = 'Authentication failed. Please verify credentials.';
        if (
          err.code === 'auth/invalid-credential' || 
          err.code === 'auth/wrong-password' || 
          err.code === 'auth/user-not-found'
        ) {
          message = 'Invalid email or password. Please try again.';
        } else if (err.code === 'auth/too-many-requests') {
          message = 'Account temporarily locked due to consecutive failures. Try again later.';
        } else if (err.code === 'auth/network-request-failed') {
          message = 'Connection error. Check your internet connection.';
        } else if (err.code === 'auth/user-disabled') {
          message = 'This user account has been disabled.';
        }
        
        setError(message);
      });
  };

  return (
    <>
      {/* Background glowing blurred orbs */}
      <div className="glow-orb orb-1"></div>
      <div className="glow-orb orb-2"></div>

      <div className="auth-container">
        <div className="form-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
          <div className="form-wrapper">
            <div className="form-card">
              
              {/* Brand Header */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.75rem' }}>
                <div className="logo-icon" style={{ marginBottom: '0.75rem', padding: '0.6rem' }}>
                  <Activity size={22} color="#060913" strokeWidth={2.5} />
                </div>
                <span className="logo-text" style={{ fontSize: '1.25rem' }}>LIVETRACK AI</span>
              </div>

              <div className="form-header">
                <h2 className="form-title">Login</h2>
                <p className="form-subtitle">Enter credentials to manage livestock health</p>
              </div>

              <form onSubmit={handleLogin} noValidate>
                
                {/* Email Field */}
                <div className="form-group">
                  <div className="input-container">
                    <input
                      id="email"
                      type="email"
                      className="form-input"
                      placeholder=" "
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                      required
                    />
                    <Mail className="input-icon-left" size={18} />
                    <label htmlFor="email" className="floating-label">Email Address</label>
                  </div>
                </div>

                {/* Password Field */}
                <div className="form-group">
                  <div className="input-container">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      className="form-input form-input-password"
                      placeholder=" "
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                      required
                    />
                    <Lock className="input-icon-left" size={18} />
                    <label htmlFor="password" className="floating-label">Password</label>
                    <button
                      type="button"
                      className="input-icon-right"
                      onClick={togglePasswordVisibility}
                      tabIndex="-1"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      disabled={isLoading}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Remember Me & Forgot Password */}
                <div className="form-options">
                  <label className="remember-me">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      disabled={isLoading}
                    />
                    <span>Remember me</span>
                  </label>
                  <a href="#forgot" className="forgot-password" onClick={(e) => e.preventDefault()}>
                    Forgot Password?
                  </a>
                </div>

                {/* Action button */}
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="spinner"></span>
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>

                {/* Dynamic alert logs */}
                {error && (
                  <div className="feedback-message feedback-error">
                    <span style={{ fontWeight: 'bold' }}>Error:</span> {error}
                  </div>
                )}
                {success && (
                  <div className="feedback-message feedback-success">
                    <span style={{ fontWeight: 'bold' }}>Success:</span> {success}
                  </div>
                )}
              </form>

              <div className="signup-prompt">
                Don't have an account?{' '}
                <a href="#signup" className="signup-link" onClick={(e) => e.preventDefault()}>
                  Register herd
                </a>
              </div>

            </div>
          </div>
        </div>
      </div>
    </>
  );
}
