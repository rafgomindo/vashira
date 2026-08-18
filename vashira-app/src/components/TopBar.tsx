import React from 'react';
import { X, Minus, Square } from 'lucide-react';

const TopBar: React.FC = () => {
  const handleMinimize = () => (window as any).vashiraAPI.minimizeWindow();
  const handleMaximize = () => (window as any).vashiraAPI.maximizeWindow();
  const handleClose = () => (window as any).vashiraAPI.closeWindow();

  return (
    <div className="titlebar-container">
      <div style={{ paddingLeft: '16px', fontSize: '0.7rem', opacity: 0.4, fontWeight: 600, letterSpacing: '0.1em' }}>
        VASHIRA HUB // MASTERY 10.0
      </div>
      <div className="window-controls" data-tour="window-controls">
        <div className="window-control-btn" onClick={handleMinimize}>
          <Minus size={14} />
        </div>
        <div className="window-control-btn" onClick={handleMaximize}>
          <Square size={12} />
        </div>
        <div className="window-control-btn close" onClick={handleClose}>
          <X size={14} />
        </div>
      </div>
    </div>
  );
};

export default TopBar;
