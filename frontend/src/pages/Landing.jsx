import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronRight, 
  MapPin, 
  Phone, 
  Mail, 
  Clock, 
  Shield, 
  Zap, 
  Star,
  Facebook,
  Instagram,
  Twitter
} from 'lucide-react';
import Login from './Login';
import logo from '../assets/logo.png';
import { useAuth } from '../hooks/useAuth';

const SERVICES_DATA = {
  "Exclusive Packages": [
    { name: "Showroom Shine (Pkg 1)", desc: "The ultimate refresh: VIP wash, engine wash, tire mags detailing, and hand glass watermarks removal.", prices: { Sedan: "2,500", SUV: "3,500" } },
    { name: "Ultimate Protection (Pkg 2)", desc: "Machine polish for swirl removal, paint protection wax, and BTZ interior disinfection.", prices: { Sedan: "3,500", SUV: "4,500" } },
  ],
  "Premium Car Wash": [
    { name: "Regular Wash", desc: "Professional exterior cleaning using high-quality automotive soap and microfiber drying.", prices: { Sedan: "150", SUV: "180", "Van/L300": "300" } },
    { name: "Supreme Wash", desc: "Advanced wash including high-gloss treatment, degreaser, and protective wax.", prices: { Sedan: "500", SUV: "600", "Van/L300": "800" } },
  ],
  "Specialized Exterior Care": [
    { name: "Spot Removal", desc: "Targeted removal of localized stains and blemishes from the paint surface.", prices: { Sedan: "1,000", SUV: "1,500", "Van/L300": "2,000" } },
    { name: "Acid Rain Removal (Hand)", desc: "Manual removal of water spots and acid rain marks to restore surface clarity.", prices: { Sedan: "600", SUV: "800", "Van/L300": "1,000" } },
    { name: "Acid Rain Removal (Machine)", desc: "Machine-buffed treatment for deep water spot and acid rain mark removal.", prices: { Sedan: "1,000", SUV: "1,500", "Van/L300": "2,000" } },
    { name: "Engine Wash", desc: "Safe and thorough cleaning of the engine bay to remove accumulated grease and dirt.", prices: { Sedan: "500", SUV: "800", "Van/L300": "1,000" } },
    { name: "Headlight Polish", desc: "Restores yellowed or hazy headlights to original factory clarity.", prices: { Sedan: "800", SUV: "1,000", "Van/L300": "1,300" } },
    { name: "Asphalt Removal", desc: "Removes road tar and asphalt splatters without affecting the paint finish.", prices: { Sedan: "700", SUV: "900", "Van/L300": "1,200" } },
    { name: "Buff Wax (Machine)", desc: "Machine-applied premium wax for an ultra-smooth and protective finish.", prices: { Sedan: "1,000", SUV: "1,500", "Van/L300": "2,500" } },
    { name: "Mags Detailing", desc: "Deep cleaning and polishing of wheels and rims to remove brake dust and oxidation.", prices: { Sedan: "1,200", SUV: "2,000", "Van/L300": "2,800" } },
  ],
  "Interior & Cabin Care": [
    { name: "Interior Detailing", desc: "Deep extraction, shampooing, and disinfection of all interior cabin surfaces.", prices: { Sedan: "4,500", SUV: "5,500", "Van/L300": "6,500" } },
    { name: "Back to Zero", desc: "Ozone treatment and antibacterial fogging to eliminate odors and germs.", prices: { Sedan: "350", SUV: "400", "Van/L300": "600" } },
    { name: "Seat Cover In/Out", desc: "Professional removal, cleaning, and reinstallation of vehicle seat covers.", prices: { Sedan: "500", SUV: "800", "Van/L300": "1,200" } },
    { name: "Ceiling Cleaning", desc: "Careful removal of stains and dust from the vehicle's interior headliner.", prices: { Sedan: "700", SUV: "1,000", "Van/L300": "1,300" } },
  ],
  "Professional Detailing": [
    { name: "Ceramic Coating", desc: "Premium 3-step exterior detailing followed by long-term ceramic protection.", prices: { Sedan: "10,000", SUV: "13,000", "Van/L300": "16,000" } },
    { name: "Exterior Detailing (3 Step)", desc: "Complete 3-step process: cutting cream, polishing, and high-gloss finishing.", prices: { Sedan: "5,000", SUV: "6,000", "Van/L300": "7,000" } },
    { name: "1st Step Cutting", desc: "Intensive swirl and deep scratch removal process only.", prices: { Sedan: "2,500", SUV: "3,000", "Van/L300": "3,500" } },
    { name: "Glass Detailing", desc: "Machine buffing for the windshield only to ensure perfect optical clarity.", prices: { Sedan: "3,500", SUV: "4,500", "Van/L300": "6,000" } },
  ],
  "Motorcycle Specialist": [
    { name: "Moto Wash", desc: "Professional cleaning tailored specifically for motorcycle components.", prices: { Regular: "120", Bigbike: "150" } },
    { name: "Moto VIP", desc: "Includes wash, high-gloss treatment, degreaser, and protective wax.", prices: { Regular: "250", Bigbike: "350" } },
    { name: "Moto Detail", desc: "Full restoration of all visible motorcycle parts and surfaces.", prices: { Regular: "2,500", Bigbike: "3,000" } },
    { name: "Moto Ceramic Coating", desc: "Hydrophobic ceramic shield for paint, plastics, and metal parts.", prices: { Regular: "3,500", Bigbike: "5,500" } },
    { name: "Moto 3-Step Detailing", desc: "Comprehensive cutting, polishing, and finishing for bike paintwork.", prices: { Regular: "2,500", Bigbike: "3,500" } },
  ],
  "Add-on Treatments": [
    { name: "Waxx Add-on", desc: "Extra layer of protective wax for an enhanced reflective shine.", prices: { Sedan: "200", SUV: "300", "Van/L300": "400" } },
    { name: "Highgloss Add-on", desc: "Intense gloss enhancer for that wet-look finish.", prices: { Sedan: "200", SUV: "300", "Van/L300": "400" } },
    { name: "Degreaser Add-on", desc: "Heavy-duty degreasing for underchassis or specific dirty areas.", prices: { Sedan: "200", SUV: "300", "Van/L300": "400" } },
  ]
};

const Landing = () => {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const [openService, setOpenService] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const { user, profile, signOut, isInitialized, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const handleAuthAction = () => {
    // 🛡️ SECURITY GUARD: Never trigger auth actions while system is still synchronizing
    if (!isInitialized || authLoading) return;

    if (user) {
      if (profile) {
        const routes = {
          ADMIN: '/admin',
          STAFF: '/staff',
          CUSTOMER: '/customer'
        };
        navigate(routes[profile.role] || '/customer');
      } else {
        // If user exists but profile is missing, they are technically "in" but roleless
        // We redirect them to customer as a safe default or wait for sync
        navigate('/customer');
      }
    } else {
      setShowLoginModal(true);
    }
  };

  // Handle scroll effect for header
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const navItemStyle = {
    color: 'white',
    textDecoration: 'none',
    fontSize: '0.75rem',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: '1.5px',
    cursor: 'pointer',
    transition: 'color 0.2s',
  };

  return (
    <div style={{ background: '#0A0B0D', color: 'white', minHeight: '100vh', position: 'relative' }}>
      
      {/* 1. STICKY HEADER */}
      <header 
        className="landing-header"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '80px',
          background: scrolled ? 'rgba(10, 11, 13, 0.95)' : 'rgba(0,0,0,0.3)',
          backdropFilter: scrolled ? 'blur(10px)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(255,255,255,0.05)' : 'none',
          display: 'flex',
          alignItems: 'center',
          padding: '0 clamp(1rem, 5vw, 4rem)',
          zIndex: 1000,
          transition: 'all 0.3s ease'
        }}
      >
        {/* LOGO (Left) */}
        <div style={{ flex: 1 }}>
          <div onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
             <img src={logo} alt="Speedway Logo" style={{ height: 'clamp(60px, 8vw, 100px)', width: 'auto', objectFit: 'contain', position: 'relative', top: '10px' }} />
          </div>
        </div>

        {/* NAVIGATION (Middle) - Hidden on Mobile */}
        <nav className="desktop-nav" style={{ display: 'flex', gap: 'clamp(1rem, 2vw, 2.5rem)', alignItems: 'center' }}>
          <span onClick={() => scrollToSection('home')} style={navItemStyle} className="nav-link">Home</span>
          <span onClick={() => scrollToSection('about')} style={navItemStyle} className="nav-link">About</span>
          <span onClick={() => scrollToSection('services')} style={navItemStyle} className="nav-link">Services</span>
          <span onClick={() => scrollToSection('faq')} style={navItemStyle} className="nav-link">FAQ</span>
          <span onClick={() => scrollToSection('contact')} style={navItemStyle} className="nav-link">Contact</span>
        </nav>

        {/* LOGIN/DASHBOARD (Right) */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', gap: '1rem', alignItems: 'center' }}>
          {user && (
            <button 
              onClick={() => signOut()}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'transparent',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '4px',
                fontWeight: '950',
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                cursor: 'pointer',
              }}
            >
              SIGN OUT
            </button>
          )}
          <button 
            onClick={handleAuthAction}
            style={{
              padding: '0.75rem clamp(1rem, 3vw, 2rem)',
              background: '#E61E2A',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontWeight: '950',
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              cursor: 'pointer',
              transition: 'transform 0.2s',
            }}
            onMouseEnter={e => e.target.style.transform = 'scale(1.05)'}
            onMouseLeave={e => e.target.style.transform = 'scale(1)'}
          >
            {!isInitialized || authLoading ? 'SYNCING...' : (user ? 'DASHBOARD' : 'LOGIN')}
          </button>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section id="home" style={{ 
        height: '100vh', 
        width: '100%', 
        position: 'relative', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        overflow: 'hidden'
      }}>
        <video autoPlay muted loop playsInline style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }}>
          <source src="/hero-bg.mp4" type="video/mp4" />
        </video>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(rgba(10, 11, 13, 0.4), rgba(10, 11, 13, 0.8))', zIndex: 1 }} />
        <div className="hero-content" style={{ position: 'relative', zIndex: 2, textAlign: 'center', maxWidth: '900px', padding: '0 2rem' }}>
          <h1 className="text-fluid-h1" style={{ fontWeight: '950', lineHeight: '0.9', textTransform: 'uppercase', marginBottom: '1.5rem', letterSpacing: '-2px' }}>
            TURN THE COLOR <br />
            <span style={{ color: '#E61E2A' }}>TO THE MAXIMUM</span>
          </h1>
          <p className="text-fluid-body" style={{ color: 'rgba(255,255,255,0.7)', maxWidth: '600px', margin: '0 auto 2.5rem', lineHeight: '1.6', fontWeight: '600' }}>
            Experience premium automotive detailing services that bring out the true brilliance 
            of your vehicle. Our expert team uses cutting-edge techniques to deliver stunning results.
          </p>
          <button onClick={handleAuthAction} style={{ padding: '1.25rem 3.5rem', background: '#E61E2A', color: 'white', border: 'none', borderRadius: '4px', fontWeight: '950', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '2px', cursor: 'pointer', boxShadow: '0 10px 30px rgba(230, 30, 42, 0.3)' }}>
            {!isInitialized || authLoading ? 'SYNCING...' : (user ? 'DASHBOARD' : 'BOOK NOW')}
          </button>
        </div>
      </section>

      {/* 3. ABOUT SECTION */}
      <section id="about" className="section-padding" style={{ background: '#0A0B0D' }}>
        <div className="container-wide" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '4rem', alignItems: 'center' }}>
          <div>
            <h2 className="text-fluid-h2" style={{ textTransform: 'uppercase', marginBottom: '2rem' }}>ABOUT US</h2>
            <p style={{ fontSize: '1.1rem', color: 'rgba(255,255,255,0.6)', lineHeight: '1.8', marginBottom: '1.5rem' }}>
              At Speedway Detail Studio, we believe that every vehicle deserves to look its absolute best. 
              Founded with a passion for automotive excellence, we have grown into one of the region's 
              most trusted detailing centers.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
             {[
               { icon: Shield, title: "PROTECTION", desc: "Premium ceramic coatings" },
               { icon: Zap, title: "PERFORMANCE", desc: "Expert technicians" },
               { icon: Star, title: "QUALITY", desc: "Satisfaction guaranteed" },
               { icon: Clock, title: "RELIABILITY", desc: "Punctual service" },
             ].map((item, i) => (
               <div key={i} style={{ background: '#15171A', padding: '2rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <item.icon style={{ color: '#E61E2A', marginBottom: '1rem' }} size={32} />
                  <h4 style={{ fontSize: '0.9rem', fontWeight: '950', marginBottom: '0.5rem' }}>{item.title}</h4>
                  <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>{item.desc}</p>
               </div>
             ))}
          </div>
        </div>
      </section>

      {/* 4. SERVICES SECTION */}
      <section id="services" className="section-padding" style={{ background: '#0F1012' }}>
        <div className="container-wide">
          <div style={{ textAlign: 'center', marginBottom: '5rem' }}>
            <h2 className="text-fluid-h2" style={{ textTransform: 'uppercase', marginBottom: '1rem' }}>OUR SERVICES</h2>
            <div style={{ width: '80px', height: '4px', background: '#E61E2A', margin: '0 auto' }}></div>
          </div>

          {Object.entries(SERVICES_DATA).map(([category, services], catIndex) => (
            <div key={category} style={{ marginBottom: '6rem' }}>
              {/* CATEGORY HEADER */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', marginBottom: '3rem' }}>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '950', textTransform: 'uppercase', whiteSpace: 'nowrap', color: 'rgba(255,255,255,0.9)' }}>{category}</h3>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
              </div>

              {/* SERVICES GRID */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: '1.5rem' }}>
                {services.map((service, i) => {
                  const serviceKey = `${catIndex}-${i}`;
                  return (
                    <div 
                      key={i} 
                      className="admin-card-hover" 
                      onClick={() => setOpenService(openService === serviceKey ? null : serviceKey)}
                      style={{ 
                        background: '#15171A', 
                        padding: '2rem', 
                        borderRadius: '4px', 
                        border: '1px solid rgba(255,255,255,0.05)', 
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column'
                      }}
                    >
                      <div style={{ width: '40px', height: '40px', background: 'rgba(230, 30, 42, 0.1)', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                        <ChevronRight 
                          style={{ 
                            color: '#E61E2A',
                            transform: openService === serviceKey ? 'rotate(90deg)' : 'rotate(0deg)',
                            transition: 'transform 0.3s ease'
                          }} 
                          size={20} 
                        />
                      </div>
                      <h4 style={{ fontSize: '1.1rem', fontWeight: '950', marginBottom: '1rem', textTransform: 'uppercase' }}>{service.name}</h4>
                      <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', lineHeight: '1.6' }}>{service.desc}</p>
                      
                      {/* EXPANDABLE PRICE TABLE */}
                      <div style={{
                        maxHeight: openService === serviceKey ? '400px' : '0',
                        overflow: 'hidden',
                        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                        opacity: openService === serviceKey ? 1 : 0,
                        marginTop: openService === serviceKey ? '1.5rem' : '0'
                      }}>
                        <div style={{ 
                          padding: '1rem', 
                          background: 'rgba(230, 30, 42, 0.05)', 
                          border: '1px dashed rgba(230, 30, 42, 0.2)',
                          borderRadius: '4px',
                        }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: '950', color: '#E61E2A', display: 'block', marginBottom: '10px', letterSpacing: '1px', textAlign: 'center', textTransform: 'uppercase' }}>Vehicle Pricing</span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {Object.entries(service.prices).map(([type, price]) => (
                              <div key={type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' }}>{type}</span>
                                <span style={{ fontSize: '0.9rem', fontWeight: '950', color: 'white' }}>₱{price}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. FAQ SECTION */}
      <section id="faq" className="section-padding" style={{ background: '#0A0B0D' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 1rem' }}>
          <h2 className="text-fluid-h2" style={{ textTransform: 'uppercase', marginBottom: '4rem', textAlign: 'center' }}>FAQ</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[
              "How long does ceramic coating last?",
              "What is the booking process?",
              "Do you offer mobile services?",
              "What payment methods do you accept?",
              "Do I need to leave my car overnight?"
            ].map((q, i) => (
              <div 
                key={i} 
                className="admin-card-hover" 
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{ 
                  background: '#15171A', 
                  padding: '1.5rem 2rem', 
                  borderRadius: '4px', 
                  border: '1px solid rgba(255,255,255,0.05)', 
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: '800', fontSize: '0.9rem' }}>{q}</span>
                  <ChevronRight 
                    size={20} 
                    style={{ 
                      color: 'rgba(255,255,255,0.2)', 
                      transform: openFaq === i ? 'rotate(90deg)' : 'rotate(0deg)',
                      transition: 'transform 0.3s ease'
                    }} 
                  />
                </div>
                
                {/* SMOOTH EXPANDABLE ANSWER */}
                <div style={{
                  maxHeight: openFaq === i ? '200px' : '0',
                  overflow: 'hidden',
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  opacity: openFaq === i ? 1 : 0,
                  marginTop: openFaq === i ? '1rem' : '0'
                }}>
                  <p style={{ 
                    fontSize: '0.85rem', 
                    color: 'rgba(255,255,255,0.5)', 
                    lineHeight: '1.6',
                    paddingTop: '0.5rem',
                    borderTop: '1px solid rgba(255,255,255,0.05)'
                  }}>
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. CONTACT SECTION */}
      <section id="contact" className="section-padding" style={{ background: '#0F1012' }}>
        <div className="container-wide" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '6rem' }}>
          <div>
            <h2 className="text-fluid-h2" style={{ textTransform: 'uppercase', marginBottom: '2rem' }}>CONTACT US</h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '3rem', lineHeight: '1.8' }}>Ready to give your car the Speedway treatment? Get in touch with us for quotes, appointments, or any inquiries.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {[{ icon: MapPin, label: "Address", val: "39 Hunters ROTC, Barangay San Juan, Cainta, 1900 Rizal" }, { icon: Phone, label: "Phone", val: "+1 (555) SPEEDWAY" }, { icon: Mail, label: "Email", val: "studio@speedway.com" }].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', padding: '1rem', background: '#15171A', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ width: '50px', height: '50px', background: '#0A0B0D', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.05)' }}><item.icon size={20} style={{ color: '#E61E2A' }} /></div>
                  <div>
                    <div style={{ fontSize: '0.7rem', fontWeight: '950', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>{item.label}</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: '800' }}>{item.val}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: '#15171A', padding: 'clamp(1.5rem, 5vw, 3rem)', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
             <form style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}><label style={{ fontSize: '0.7rem', fontWeight: '950', textTransform: 'uppercase', opacity: 0.5 }}>Name</label><input type="text" style={{ background: '#0A0B0D', border: '1px solid rgba(255,255,255,0.1)', padding: '1rem', borderRadius: '4px', color: 'white', fontWeight: '700' }} placeholder="John Doe" /></div>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}><label style={{ fontSize: '0.7rem', fontWeight: '950', textTransform: 'uppercase', opacity: 0.5 }}>Email</label><input type="email" style={{ background: '#0A0B0D', border: '1px solid rgba(255,255,255,0.1)', padding: '1rem', borderRadius: '4px', color: 'white', fontWeight: '700' }} placeholder="john@example.com" /></div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}><label style={{ fontSize: '0.7rem', fontWeight: '950', textTransform: 'uppercase', opacity: 0.5 }}>Message</label><textarea rows="5" style={{ background: '#0A0B0D', border: '1px solid rgba(255,255,255,0.1)', padding: '1rem', borderRadius: '4px', color: 'white', fontWeight: '700', resize: 'none' }} placeholder="Tell us about your project..."></textarea></div>
                <button style={{ padding: '1.25rem', background: '#E61E2A', color: 'white', border: 'none', borderRadius: '4px', fontWeight: '950', fontSize: '0.9rem', textTransform: 'uppercase', cursor: 'pointer' }}>SEND MESSAGE</button>
             </form>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: '4rem 2rem', background: '#0A0B0D', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '2rem' }}>
          <div>
            <div style={{ fontWeight: '950', fontSize: '1.2rem', letterSpacing: '-1px', fontStyle: 'italic', color: '#E61E2A' }}>SPEEDWAY</div>
            <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', marginTop: '0.5rem' }}>© 2024 SPEEDWAY AUTOXMOTO. ALL RIGHTS RESERVED.</div>
          </div>
          <div style={{ display: 'flex', gap: '2rem' }}>
             <Facebook size={18} style={{ color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }} />
             <Instagram size={18} style={{ color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }} />
             <Twitter size={18} style={{ color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }} />
          </div>
        </div>
      </footer>

      {/* LOGIN MODAL */}
      {showLoginModal && <Login isModal onClose={() => setShowLoginModal(false)} />}

      {/* GLOBAL RESPONSIVE & UTILITY STYLES */}
      <style>{`
        .section-padding { padding: clamp(4rem, 10vw, 8rem) clamp(1rem, 5vw, 4rem); }
        .container-wide { maxWidth: 1200px; margin: 0 auto; }
        .nav-link:hover { color: #E61E2A !important; }
        
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .logo-text { font-size: 1.2rem !important; }
          .hero-content h1 { font-size: 2.5rem !important; }
        }
      `}</style>
    </div>
  );
};

export default Landing;
