import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function IdleTimer({ children }) {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const timeoutRef = useRef(null);

  // 15 minutos = 15 * 60 * 1000 = 900000 ms
  const MAX_IDLE_TIME = 15 * 60 * 1000;

  const resetTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (usuario) {
      timeoutRef.current = setTimeout(() => {
        logout();
        navigate('/login?expired=1');
      }, MAX_IDLE_TIME);
    }
  };

  useEffect(() => {
    if (!usuario) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      return;
    }

    resetTimer();

    const events = ['mousemove', 'mousedown', 'keypress', 'DOMMouseScroll', 'mousewheel', 'touchmove', 'MSPointerMove'];
    
    events.forEach((event) => {
      window.addEventListener(event, resetTimer);
    });

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      events.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [usuario, logout, navigate]);

  return children;
}
