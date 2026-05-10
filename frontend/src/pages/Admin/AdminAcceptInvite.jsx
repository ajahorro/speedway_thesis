import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const AdminAcceptInvite = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [inviteData, setInviteData] = useState(null);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: ''
  });

  useEffect(() => {
    if (!token) {
      setError('Missing invitation token.');
      setLoading(false);
      return;
    }

    const validateToken = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/invite/validate?token=${token}`);
        const data = await response.json();
        if (data.success) {
          setInviteData(data);
        } else {
          setError(data.error || 'Invalid or expired invitation.');
        }
      } catch (err) {
        setError('Connection failed. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      return toast.error('Passwords do not match');
    }
    if (formData.password.length < 6) {
      return toast.error('Password must be at least 6 characters');
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/invite/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password: formData.password,
          first_name: formData.firstName,
          last_name: formData.lastName
        })
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Account activated! You can now log in.');
        navigate('/login');
      } else {
        throw new Error(data.error || 'Activation failed');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100 screen', background: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 style={{ width: '2rem', height: '2rem', color: '#A91B18' }} className="animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <div style={{ maxWidth: '400px', width: '100%', background: '#111', border: '1px solid #222', borderRadius: '1rem', padding: '2rem', textAlign: 'center' }}>
          <AlertCircle style={{ width: '4rem', height: '4rem', color: '#ef4444', margin: '0 auto 1rem' }} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'white', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Invitation Error</h2>
          <p style={{ color: '#888', marginBottom: '1.5rem', fontSize: '0.9rem' }}>{error}</p>
          <button 
            onClick={() => navigate('/login')}
            style={{ width: '100%', background: '#A91B18', color: 'white', padding: '1rem', borderRadius: '0.75rem', fontWeight: '900', border: 'none', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px' }}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  const inputStyle = {
    width: '100%',
    background: '#1A1A1A',
    border: '1px solid #262626',
    borderRadius: '0.75rem',
    padding: '0.75rem 1rem 0.75rem 2.75rem',
    color: 'white',
    outline: 'none',
    fontSize: '0.9rem',
    fontWeight: '600'
  };

  const labelStyle = {
    display: 'block',
    fontSize: '0.65rem',
    fontWeight: '900',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '0.5rem'
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: '450px', width: '100%' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: '950', color: 'white', margin: 0, tracking: '-0.05em', fontStyle: 'italic', textTransform: 'uppercase' }}>
            SPEEDWAY<span style={{ color: '#A91B18' }}>AUTOXMOTO</span>
          </h1>
          <p style={{ color: '#555', marginTop: '0.5rem', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '2px' }}>
            Account Activation
          </p>
        </div>

        <div style={{ background: '#111', border: '1px solid #222', borderRadius: '1.5rem', padding: '2.5rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'white', margin: '0 0 0.5rem' }}>Welcome aboard!</h2>
            <p style={{ fontSize: '0.85rem', color: '#666', margin: 0 }}>
              You're joining as <strong style={{ color: 'white' }}>{inviteData?.role}</strong> for <br/>
              <span style={{ color: '#A91B18', fontWeight: '700' }}>{inviteData?.email}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>First Name</label>
                <div style={{ position: 'relative' }}>
                  <User style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', height: '1rem', color: '#444' }} />
                  <input
                    type="text"
                    required
                    style={{ ...inputStyle, paddingLeft: '2.75rem' }}
                    placeholder="e.g. John"
                    value={formData.firstName}
                    onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Last Name</label>
                <div style={{ position: 'relative' }}>
                  <User style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', height: '1rem', color: '#444' }} />
                  <input
                    type="text"
                    required
                    style={{ ...inputStyle, paddingLeft: '2.75rem' }}
                    placeholder="e.g. Doe"
                    value={formData.lastName}
                    onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Set Password</label>
              <div style={{ position: 'relative' }}>
                <Lock style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', height: '1rem', color: '#444' }} />
                <input
                  type="password"
                  required
                  style={inputStyle}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Confirm Password</label>
              <div style={{ position: 'relative' }}>
                <Lock style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', height: '1rem', color: '#444' }} />
                <input
                  type="password"
                  required
                  style={inputStyle}
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{ 
                width: '100%', 
                background: '#A91B18', 
                color: 'white', 
                padding: '1.25rem', 
                borderRadius: '1rem', 
                fontWeight: '900', 
                fontSize: '0.8rem',
                textTransform: 'uppercase', 
                letterSpacing: '2px', 
                border: 'none', 
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1,
                boxShadow: '0 10px 15px -3px rgba(169, 27, 24, 0.3)',
                marginTop: '1rem',
                transition: 'transform 0.2s'
              }}
            >
              {submitting ? 'Activating...' : 'Activate Account'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: '#444', fontSize: '0.65rem', marginTop: '2rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Secure Administrative Activation System &bull; Speedway Thesis 2024
        </p>
      </div>
    </div>
  );

};

export default AdminAcceptInvite;
