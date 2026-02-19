
import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  LogOut,
  Package,
  LayoutDashboard,
  Settings,
  Menu,
  X,
  Image,
  Star
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth, useRequireAuth } from "@/hooks/useAuth";

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children, title }) => {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const location = useLocation();
  const { toast } = useToast();

  // Use unified auth system
  const { logout, user } = useAuth();
  const { isAuthenticated, isLoading } = useRequireAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neutral-900 mx-auto mb-4"></div>
          <p className="text-neutral-600">验证身份中...</p>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated (useRequireAuth will handle redirect)
  if (!isAuthenticated) {
    return null;
  }

  const navItems = [
    { path: "/admin/dashboard", label: "控制面板", icon: LayoutDashboard },
    { path: "/admin/products", label: "产品管理", icon: Package },
    { path: "/admin/carousels", label: "轮播图管理", icon: Image },
    { path: "/admin/featured-products", label: "精选产品", icon: Star },
    { path: "/admin/settings", label: "系统设置", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col lg:flex-row">
      {/* Mobile Navigation Header */}
      <div className="lg:hidden bg-white border-b border-neutral-200 px-4 py-3 flex items-center justify-between">
        <Link to="/admin/dashboard" className="flex items-center">
          <span className="font-semibold text-base tracking-wide text-neutral-900">Turtle Album</span>
        </Link>
        <button
          onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
          className="text-gray-600 hover:text-gray-900 p-1"
        >
          {isMobileNavOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`
          lg:block lg:w-64 lg:flex-shrink-0 bg-white border-r border-neutral-200
          fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-200 ease-in-out
          ${isMobileNavOpen ? "translate-x-0" : "-translate-x-full"}
          lg:relative lg:translate-x-0
        `}
      >
        <div className="p-6 border-b border-neutral-200 hidden lg:block">
          <Link to="/admin/dashboard" className="flex items-center">
            <span className="font-semibold text-base tracking-wide text-neutral-900">Turtle Album</span>
          </Link>
        </div>

        <nav className="p-4">
          <ul className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                      isActive
                        ? "bg-neutral-900 text-white font-medium ring-1 ring-[#FFD400]/30"
                        : "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
                    )}
                    onClick={() => setIsMobileNavOpen(false)}
                  >
                    <span
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-xl",
                        isActive ? "bg-[#FFD400] text-black" : "bg-neutral-100 text-neutral-600"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t border-neutral-200">
          <Button
            variant="ghost"
            className="w-full justify-start text-neutral-700 hover:text-neutral-900 hover:bg-neutral-50"
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5 mr-3" />
            退出登录
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {/* Top Header */}
        <header className="bg-white border-b border-neutral-200 p-6 hidden lg:block">
          <h1 className="text-2xl font-semibold text-neutral-900">{title}</h1>
        </header>

        {/* Page Content */}
        <div className="flex-1 px-4 py-4 sm:p-6">
          {/* Mobile header */}
          <div className="mb-4 block lg:hidden">
            <h1 className="text-xl font-semibold text-neutral-900">{title}</h1>
          </div>
          
          {children}
        </div>
      </main>

      {/* Mobile nav overlay */}
      {isMobileNavOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsMobileNavOpen(false)}
        />
      )}
    </div>
  );
};

export default AdminLayout;
