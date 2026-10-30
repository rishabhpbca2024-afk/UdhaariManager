import React from 'react';
import { Wallet } from 'lucide-react';

interface HeaderProps {
  onAddClick?: () => void;
}

export const Header: React.FC<HeaderProps> = () => {
  return (
    <header className="app-header">
      <div className="brand-section">
        <div className="brand-logo-icon">
          <Wallet size={18} />
        </div>
        <div className="brand-text-wrap">
          <h1 className="brand-title">Udhaari Manager</h1>
          <p className="brand-subtitle">Safe Offline Ledger</p>
        </div>
      </div>
    </header>
  );
};

export default Header;
