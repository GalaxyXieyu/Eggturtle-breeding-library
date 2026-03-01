import React, { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import CustomerServiceModal from "@/components/CustomerServiceModal";

interface SettingsData {
  companyName: string;
  companyLogo: string;
  companyDescription: string;
  contactPhone: string;
  contactEmail: string;
  contactAddress: string;
  wechatNumber: string;
}

const Footer: React.FC = () => {
  const { t } = useLanguage();
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [settings, setSettings] = useState<SettingsData>({
    companyName: "汕头博捷科技有限公司",
    companyLogo: "博捷科技",
    companyDescription: "专业提供化妆品定制、批量生产、样品申请和设计咨询服务",
    contactPhone: "16626181662",
    contactEmail: "1216278493@qq.com",
    contactAddress: "广东省汕头市金平区岐山街道赛头南溪路F栋1号",
    wechatNumber: "bojie_tech"
  });

  // 获取设置数据
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch("/api/settings");
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            setSettings(result.data);
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
    <>
      <footer className="bg-white border-t border-cosmetic-beige-300/30 py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-xl font-serif font-semibold mb-4 gold-text">{settings.companyLogo}</h3>
              <p className="text-cosmetic-brown-300 mb-4">
                {settings.companyDescription}
              </p>
            </div>
            <div>
              <h4 className="text-lg font-medium mb-4 text-cosmetic-brown-500">{t("contact")}</h4>
              <ul className="space-y-2 text-cosmetic-brown-300">
                <li>{t("phone")}: {settings.contactPhone}</li>
                <li>{t("email")}: {settings.contactEmail}</li>
                <li>{t("address")}: {settings.contactAddress}</li>
                <li>
                  <span 
                    onClick={() => setIsServiceModalOpen(true)}
                    className="text-blue-600 hover:text-blue-700 cursor-pointer transition-colors duration-300 flex items-center"
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    添加客服微信
                  </span>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-medium mb-4 text-cosmetic-brown-500">{t("service")}</h4>
              <ul className="space-y-2 text-cosmetic-brown-300">
                <li>{t("customization")}</li>
                <li>{t("bulkProduction")}</li>
                <li>{t("sampleRequest")}</li>
                <li>{t("designConsulting")}</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-cosmetic-beige-300/30 mt-8 pt-6 text-center text-cosmetic-brown-300 text-sm">
            <p>© {new Date().getFullYear()} {settings.companyName}. 保留所有权利。</p>
          </div>
        </div>
      </footer>

      {/* 客服弹窗 */}
      <CustomerServiceModal
        isOpen={isServiceModalOpen}
        onClose={() => setIsServiceModalOpen(false)}
      />
    </>
  );
};

export default Footer;
