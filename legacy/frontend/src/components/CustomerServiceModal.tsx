import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QrCode, Phone, Mail, MessageCircle, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Lightbox from "react-modal-image";

interface CustomerServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CustomerServiceModal: React.FC<CustomerServiceModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useLanguage();
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState("");
  const [activeTab, setActiveTab] = useState("1");

  const customerServices = [
    { id: "1", name: "客服 1", url: "/qr-code-1.jpg", phone: "16626181662", email: "hong46647426@gmail.com" },
    { id: "2", name: "客服 2", url: "/qr-code-2.jpg", phone: "18023240177", email: "1216278493@qq.com" },
  ];

  const activeService = customerServices.find(cs => cs.id === activeTab) || customerServices[0];

  const handleImageClick = (url: string) => {
    setLightboxImage(url);
    setIsLightboxOpen(true);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="flex items-center gap-2 text-cosmetic-brown-500">
              <MessageCircle className="h-5 w-5" />
              联系客服
            </DialogTitle>
            <DialogDescription>
              扫描下方二维码添加客服微信，或使用其他联系方式
            </DialogDescription>
          </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-cosmetic-beige-100 h-12 rounded-none">
              {customerServices.map((qr) => (
                <TabsTrigger key={qr.id} value={qr.id} className="h-full text-cosmetic-brown-400 data-[state=active]:bg-cosmetic-gold-100 data-[state=active]:text-cosmetic-gold-600 data-[state=active]:shadow-none rounded-none">
                  {qr.name}
                </TabsTrigger>
              ))}
            </TabsList>
          
            <div className="p-6">
              {customerServices.map((qr) => (
                <TabsContent key={qr.id} value={qr.id} className="m-0">
                  <div className="space-y-6">
                    {/* 微信二维码 */}
                    <div className="text-center">
                      <div className="inline-block p-4 bg-gradient-to-br from-cosmetic-beige-50 to-cosmetic-gold-50 rounded-2xl border border-cosmetic-gold-200/30">
                        <div 
                          className="w-48 h-48 mx-auto mb-4 bg-white rounded-xl overflow-hidden shadow-sm cursor-pointer"
                          onClick={() => handleImageClick(qr.url)}
                        >
                          <img
                            src={qr.url}
                            alt={`客服微信二维码 - ${qr.name}`}
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = "/placeholder.svg";
                            }}
                          />
                        </div>
                        <div className="flex items-center justify-center gap-2 text-cosmetic-brown-500">
                          <QrCode className="h-4 w-4" />
                          <span className="text-sm font-medium">微信扫码添加{qr.name}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              ))}

              {/* 其他联系方式 */}
              <div className="space-y-3 pt-6 border-t border-cosmetic-beige-200">
                <h4 className="font-medium text-cosmetic-brown-500 text-center">其他联系方式</h4>
                
                <div className="grid gap-3">
                  {/* 电话 */}
                  <div className="flex items-center gap-3 p-3 bg-cosmetic-beige-50 rounded-lg">
                    <Phone className="h-4 w-4 text-cosmetic-gold-500" />
                    <div className="flex-1">
                      <span className="text-sm text-cosmetic-brown-400">电话</span>
                      <p className="font-medium text-cosmetic-brown-600">{activeService.phone}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`tel:${activeService.phone}`)}
                      className="text-cosmetic-gold-600 border-cosmetic-gold-300 hover:bg-cosmetic-gold-50"
                    >
                      拨打
                    </Button>
                  </div>

                  {/* 邮箱 */}
                  <div className="flex items-center gap-3 p-3 bg-cosmetic-beige-50 rounded-lg">
                    <Mail className="h-4 w-4 text-cosmetic-gold-500" />
                    <div className="flex-1">
                      <span className="text-sm text-cosmetic-brown-400">邮箱</span>
                      <p className="font-medium text-cosmetic-brown-600">{activeService.email}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`mailto:${activeService.email}`)}
                      className="text-cosmetic-gold-600 border-cosmetic-gold-300 hover:bg-cosmetic-gold-50"
                    >
                      发邮件
                    </Button>
                  </div>
                </div>
              </div>

              {/* 底部提示 */}
              <div className="text-center text-sm text-cosmetic-brown-400 pt-6">
                <p>工作时间：周一至周五 9:00-18:00</p>
                <p>微信客服回复更及时 🚀</p>
              </div>
            </div>
        </Tabs>
        <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
        </DialogClose>
        </DialogContent>
      </Dialog>
      
      {isLightboxOpen && (
        <Lightbox
          medium={lightboxImage}
          large={lightboxImage}
          alt="客服二维码"
          onClose={() => setIsLightboxOpen(false)}
          hideDownload={true}
          hideZoom={true}
        />
      )}
    </>
  );
};

export default CustomerServiceModal; 