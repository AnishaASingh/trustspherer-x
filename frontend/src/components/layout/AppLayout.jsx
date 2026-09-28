import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../common/Sidebar';
import Navbar from '../common/Navbar';

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);

  // Automatically collapse sidebar on smaller screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setCollapsed(true);
      } else {
        setCollapsed(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="app-layout cyber-grid-bg">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      
      <div className="main-content-area">
        <Navbar onToggleSidebar={() => setCollapsed(!collapsed)} />
        <main className="page-container">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
