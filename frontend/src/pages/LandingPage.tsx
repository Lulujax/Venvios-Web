import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Navbar } from '../components/Landing/Navbar';
import { Hero } from '../components/Landing/Hero';
import { HowItWorks } from '../components/Landing/HowItWorks';
import { RatesTable } from '../components/Landing/RatesTable';
import { CasilleroInfo } from '../components/Landing/CasilleroInfo';
import { Footer } from '../components/Landing/Footer';

export function LandingPage() {
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) {
      window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }
    const id = location.hash.replace('#', '');
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [location.hash, location.key]);

  return (
    <div className="min-h-[100dvh] bg-paper">
      <a href="#contenido" className="skip-link">
        Saltar al contenido
      </a>
      <Navbar />
      <main id="contenido">
        <Hero />
        <HowItWorks />
        <RatesTable />
        <CasilleroInfo />
      </main>
      <Footer />
    </div>
  );
}
