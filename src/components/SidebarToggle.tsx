import { Menu } from 'lucide-react';

interface SidebarToggleProps {
  isCollapsed: boolean;
  onClick: () => void;
}

export function SidebarToggle({ isCollapsed, onClick }: SidebarToggleProps) {
  return (
    <button 
      className="sidebar-toggle-btn"
      onClick={onClick}
    >
      <Menu size={24} />
    </button>
  );
}