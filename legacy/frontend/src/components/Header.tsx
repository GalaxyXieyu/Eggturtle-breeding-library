
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";

interface HeaderProps {
  onCartClick?: () => void;
  onFilterClick?: () => void;
  cartItemCount?: number;
}

interface SettingsData {
  companyName: string;
  companyLogo: string;
}

const Header: React.FC<HeaderProps> = ({ 
  onCartClick, 
  cartItemCount = 0 
}) => {
  const isMobile = useIsMobile();
  const { t } = useLanguage();
  
  const [settings, setSettings] = useState<SettingsData>({
    companyName: "汕头博捷科技有限公司",
    companyLogo: "博捷科技"
  });

  // 获取设置数据
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch("/api/settings");
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            setSettings({
              companyName: result.data.companyName,
              companyLogo: result.data.companyLogo
            });
          }
        }
      } catch (error) {
        console.error("获取设置失败:", error);
        // 静默失败，使用默认值
      }
    };

    fetchSettings();
  }, []);

  return (
    <header className="w-full bg-cosmetic-beige-100 border-b border-cosmetic-beige-300/30 sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto py-4 sm:py-6 px-2 sm:px-4 flex items-center justify-between">
        <div className="flex items-center">
          <Link to="/">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-serif font-semibold gold-text truncate">
              {settings.companyLogo}
            </h1>
          </Link>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-4">
          <LanguageSwitcher />
          
          <Button 
            className="text-xs sm:text-sm bg-cosmetic-gold-400 hover:bg-cosmetic-gold-500 text-white px-2 sm:px-4 py-1 sm:py-2 md:flex hidden"
            onClick={onCartClick}
          >
            <ShoppingCart className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
            <span>{t("shoppingCart")}</span>
            {cartItemCount > 0 && (
              <span className="ml-1 sm:ml-2 bg-white text-cosmetic-gold-500 text-xs rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center">
                {cartItemCount > 99 ? '99+' : cartItemCount}
              </span>
            )}
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
