
import React from "react";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Globe } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          className="text-xs sm:text-sm bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 hover:border-gray-300 px-2 sm:px-4 py-1 sm:py-2"
        >
          <Globe className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline">{t("switchLanguage")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem 
          onClick={() => setLanguage("en")}
          className={language === "en" ? "bg-cosmetic-beige-100" : ""}
        >
          {t("english")}
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setLanguage("zh")}
          className={language === "zh" ? "bg-cosmetic-beige-100" : ""}
        >
          {t("chinese")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageSwitcher;
