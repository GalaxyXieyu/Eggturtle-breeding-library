import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CartItem } from "@/types/products";
import { Download, Image, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import html2canvas from "html2canvas";
import { useLanguage } from "@/contexts/LanguageContext";
import CustomerServiceModal from "@/components/CustomerServiceModal";

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onRemoveItem: (productId: string) => void;
  onQuantityChange: (productId: string, quantity: number) => void;
  onClearCart?: () => void;
}

const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  cartItems,
  onRemoveItem,
  onQuantityChange,
  onClearCart,
}) => {
  const { toast } = useToast();
  const orderRef = useRef<HTMLDivElement>(null);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [orderImageUrl, setOrderImageUrl] = useState<string | null>(null);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const { t } = useLanguage();

  // 由于价格信息已移除，这里显示咨询价格
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  
  const generateRandomOrderId = () => {
    const timestamp = new Date().getTime().toString().slice(-6);
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `ORD-${timestamp}-${random}`;
  };

  const handleGenerateOrderImage = async () => {
    if (cartItems.length === 0) {
      toast({
        title: t("cartEmpty"),
        description: t("pleaseAddItems"),
        variant: "destructive",
      });
      return;
    }

    setGeneratingImage(true);
    
    try {
      if (orderRef.current) {
        // 创建一个临时容器用于渲染订单，解决图层问题
        const tempOrderContainer = document.createElement('div');
        tempOrderContainer.style.position = 'absolute';
        tempOrderContainer.style.left = '-9999px';
        tempOrderContainer.style.top = '0';
        tempOrderContainer.style.width = '350px';
        tempOrderContainer.style.backgroundColor = '#F9F5F0';
        tempOrderContainer.style.padding = '24px';
        tempOrderContainer.style.fontFamily = "system-ui, -apple-system, sans-serif";
        
        // 复制订单内容到临时容器
        tempOrderContainer.innerHTML = orderRef.current.innerHTML;
        document.body.appendChild(tempOrderContainer);
        
        // 等待DOM和图片加载完成
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // 使用更优化的html2canvas配置
        const canvas = await html2canvas(tempOrderContainer, {
          backgroundColor: "#F9F5F0",
          scale: 2, // 更高质量
          useCORS: true, // 允许跨域图片
          allowTaint: true,
          logging: false, // 关闭日志以提高性能
          imageTimeout: 0, // 防止图片超时
          removeContainer: true // 自动清理临时DOM元素
        });
        
        // 移除临时容器
        document.body.removeChild(tempOrderContainer);
        
        const dataUrl = canvas.toDataURL("image/png");
        setOrderImageUrl(dataUrl);
        toast({
          title: t("orderImageGenerated"),
          description: t("orderImageGeneratedDesc"),
        });
      }
    } catch (error) {
      console.error("生成订单图片失败:", error);
      toast({
        title: t("generateImageFailed"),
        description: t("tryAgainLater"),
        variant: "destructive",
      });
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleDownloadImage = () => {
    if (!orderImageUrl) return;
    
    const link = document.createElement("a");
    link.href = orderImageUrl;
    link.download = `${t("intentionOrder")}-${generateRandomOrderId()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: t("orderImageDownloaded"),
      description: t("orderImageDownloadedDesc"),
    });
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg p-2 sm:p-6 flex flex-col">
        <SheetHeader>
          <div className="flex justify-between items-center">
            <div>
          <SheetTitle className="font-serif text-cosmetic-brown-500">{t("cart")}</SheetTitle>
          <SheetDescription className="text-cosmetic-brown-300">
            {t("selectedProducts").replace("{0}", cartItems.length.toString())}
          </SheetDescription>
            </div>
            {cartItems.length > 0 && onClearCart && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (window.confirm("确定要清空购物车吗？")) {
                    onClearCart();
                    toast({
                      title: "购物车已清空",
                      description: "所有商品已从购物车中移除",
                    });
                  }
                }}
                className="text-cosmetic-brown-400 hover:text-red-500 hover:bg-red-50 transition-all duration-200 text-xs"
              >
                清空购物车
              </Button>
            )}
          </div>
        </SheetHeader>
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto pr-1 sm:pr-2">
            {cartItems.length > 0 ? (
              <div className="space-y-4">
                {/* 购物车产品列表 */}
                {cartItems.map((item) => (
                  <div
                    key={item.product.id}
                    className="bg-white rounded-xl p-4 border border-cosmetic-beige-200/50 shadow-sm hover:shadow-md transition-all duration-300 group"
                  >
                    <div className="flex gap-3">
                      {/* 产品图片 */}
                      <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-cosmetic-beige-50 border border-cosmetic-beige-200/50 flex-shrink-0 group-hover:scale-105 transition-transform duration-300">
                        <img
                          src={
                            (item.product.images.find((img) => img.type === "main") ||
                            item.product.images[0])?.url
                          }
                          alt={item.product.code}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      
                      {/* 产品信息 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-cosmetic-brown-600 text-sm sm:text-base truncate group-hover:text-cosmetic-brown-700 transition-colors">
                              {item.product.code}
                            </h4>
                            <p className="text-xs text-cosmetic-brown-400 mt-1 font-mono">
                              {item.product.code}
                            </p>
                          </div>
                          
                          {/* 删除按钮 */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onRemoveItem(item.product.id)}
                            className="h-8 w-8 p-0 text-cosmetic-brown-300 hover:text-red-500 hover:bg-red-50 transition-all duration-200"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        {/* 数量控制和价格 */}
                        <div className="flex justify-between items-center mt-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-cosmetic-brown-400">数量:</span>
                            <div className="flex items-center border border-cosmetic-beige-300 rounded-lg overflow-hidden bg-white">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onQuantityChange(item.product.id, Math.max(1, item.quantity - 1))}
                                className="h-7 w-7 p-0 hover:bg-cosmetic-beige-100 text-cosmetic-brown-500 rounded-none"
                              >
                                -
                              </Button>
                              <span className="px-3 py-1 text-sm font-medium text-cosmetic-brown-600 bg-white min-w-[2rem] text-center">
                                {item.quantity}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onQuantityChange(item.product.id, item.quantity + 1)}
                                className="h-7 w-7 p-0 hover:bg-cosmetic-beige-100 text-cosmetic-brown-500 rounded-none"
                              >
                                +
                              </Button>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <div className="text-sm font-semibold text-cosmetic-gold-600 bg-cosmetic-gold-50 px-2 py-1 rounded border border-cosmetic-gold-200">
                              咨询价格
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* 普通购物车底部 - 总价和立即咨询 */}
                {!orderImageUrl && (
                  <div className="border-t border-cosmetic-gold-200/40 pt-4 sm:pt-6">
                    {/* 总价展示 */}
                    <div className="bg-gradient-to-r from-cosmetic-beige-50/80 to-cosmetic-gold-50/60 rounded-xl p-4 mb-4 border border-cosmetic-gold-200/30">
                      <div className="flex justify-between items-center">
                        <div className="flex flex-col">
                          <span className="text-xs text-cosmetic-brown-400 uppercase tracking-wider font-medium">{t("total")}</span>
                          <span className="text-xl font-bold text-cosmetic-brown-600 font-serif">
                            咨询价格
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-cosmetic-brown-400">{totalItems} 件商品</span>
                          <div 
                            className="text-xs text-cosmetic-gold-600 font-medium cursor-pointer hover:text-cosmetic-gold-700 transition-colors"
                            onClick={() => setIsServiceModalOpen(true)}
                          >
                            请联系客服
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 立即咨询按钮 */}
                    <Button
                      className="w-full bg-gradient-to-r from-cosmetic-gold-500 to-cosmetic-gold-600 hover:from-cosmetic-gold-600 hover:to-cosmetic-gold-700 text-white text-sm sm:text-base py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
                      onClick={handleGenerateOrderImage}
                      disabled={generatingImage}
                    >
                      {generatingImage ? (
                        <>
                          <div className="animate-spin mr-2 h-4 w-4 border-2 border-white/30 border-t-white rounded-full"></div>
                          <span className="font-medium">正在生成报价单...</span>
                        </>
                      ) : (
                        <span className="font-medium">💬 立即咨询</span>
                      )}
                    </Button>
                  </div>
                )}
                
                {/* 生成成功后的操作区域 */}
                {orderImageUrl && (
                  <div className="border-t border-cosmetic-gold-200/40 pt-4 sm:pt-6">
                    <div className="space-y-4">
                      {/* 成功提示 */}
                      <div className="bg-gradient-to-r from-green-50 to-cosmetic-gold-50/30 border border-green-200/50 rounded-xl p-3">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                            <span className="text-green-600 text-sm">✓</span>
                          </div>
                          <div className="ml-3">
                            <h4 className="text-sm font-semibold text-green-800">报价单生成成功！</h4>
                            <p className="text-xs text-green-600">专业格式，可直接分享给客户</p>
                          </div>
                        </div>
                      </div>

                      {/* 图片预览 - 高级设计 */}
                      <div className="bg-white rounded-2xl p-4 border border-cosmetic-gold-200/30 shadow-lg">
                        <div className="aspect-[3/4] bg-gradient-to-br from-cosmetic-beige-50 to-white rounded-xl mb-3 overflow-hidden border border-cosmetic-beige-200/30 relative group">
                          <img 
                            src={orderImageUrl} 
                            alt={t("orderImage")} 
                            className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                          />
                          {/* 预览遮罩 */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        </div>
                        
                        {/* 图片信息 */}
                        <div className="text-center text-xs text-cosmetic-brown-400 mb-3">
                          高清PNG格式 · 适合打印和分享
                        </div>
                      </div>

                      {/* 操作按钮组 - 优先引导微信分享 */}
                      <div className="space-y-3">
                        {/* 主要操作：微信分享 */}
                        <Button
                          className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white text-sm sm:text-base py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 group relative overflow-hidden"
                          onClick={async () => {
                            try {
                              // 检查是否支持原生分享API
                              if (navigator.share && navigator.canShare) {
                                // 尝试分享图片文件
                                const blob = await fetch(orderImageUrl).then(r => r.blob());
                                const file = new File([blob], 'quotation.png', { type: 'image/png' });
                                
                                if (navigator.canShare({ files: [file] })) {
                                  await navigator.share({
                                    title: '✨ 专业产品报价单',
                                    text: '请查看这份精美的产品报价单，期待与您的合作！',
                                    files: [file]
                                  });
                                  return;
                                }
                              }
                              
                              // 降级方案：复制图片并提示用户
                              const img = document.createElement('img');
                              img.crossOrigin = 'anonymous';
                              img.onload = () => {
                                const canvas = document.createElement('canvas');
                                canvas.width = img.width;
                                canvas.height = img.height;
                                const ctx = canvas.getContext('2d');
                                ctx?.drawImage(img, 0, 0);
                                
                                canvas.toBlob((blob) => {
                                  if (blob && navigator.clipboard && navigator.clipboard.write) {
                                    navigator.clipboard.write([
                                      new ClipboardItem({ 'image/png': blob })
                                    ]).then(() => {
                                      toast({
                                        title: "📋 报价单已复制",
                                        description: "图片已复制到剪贴板，请在微信中长按粘贴发送",
                                      });
                                    }).catch(() => {
                                      // 最终降级：下载文件
                                      handleDownloadImage();
                                      toast({
                                        title: "💾 图片已下载",
                                        description: "请从相册中选择图片分享到微信",
                                      });
                                    });
                                  } else {
                                    // 最终降级：下载文件
                                    handleDownloadImage();
                                    toast({
                                      title: "💾 图片已下载",
                                      description: "请从相册中选择图片分享到微信",
                                    });
                                  }
                                });
                              };
                              img.src = orderImageUrl;
                            } catch (error) {
                              // 分享失败，降级到下载方式
                              handleDownloadImage();
                              toast({
                                title: "💾 图片已下载",
                                description: "请从相册中选择图片分享到微信",
                              });
                            }
                          }}
                        >
                          {/* 按钮背景动画 */}
                          <div className="absolute inset-0 bg-gradient-to-r from-white/20 via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                          
                          <div className="relative z-10 flex items-center justify-center">
                            <div className="mr-2 p-1 bg-white/20 rounded-full group-hover:bg-white/30 transition-colors duration-300">
                              <span className="text-lg">💬</span>
                            </div>
                            <span className="font-medium">微信分享给客户</span>
                            <div className="ml-2 text-xs bg-white/20 px-2 py-0.5 rounded-full">
                              推荐
                            </div>
                          </div>
                        </Button>
                        
                        {/* 次要操作组 */}
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant="outline"
                            className="border-cosmetic-gold-300/50 text-cosmetic-brown-500 hover:bg-cosmetic-gold-50 hover:border-cosmetic-gold-400 transition-all duration-300 rounded-lg text-xs py-2"
                            onClick={handleDownloadImage}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            保存本地
                          </Button>
                          <Button
                            variant="outline"
                            className="border-cosmetic-beige-300 text-cosmetic-brown-400 hover:bg-cosmetic-beige-100 hover:border-cosmetic-beige-400 transition-all duration-300 rounded-lg text-xs py-2"
                            onClick={() => setOrderImageUrl(null)}
                          >
                            ← 返回编辑
                          </Button>
                        </div>
                        

                      </div>


                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full">
                <p className="text-cosmetic-brown-300 mb-4">{t("cartEmpty")}</p>
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="border-cosmetic-beige-300 text-cosmetic-brown-300 hover:bg-cosmetic-beige-200"
                >
                  {t("browseProducts")}
                </Button>
              </div>
            )}
          </div>

          
          {/* 订单模板 - 简洁清爽设计 */}
          <div
            ref={orderRef}
            style={{ 
              display: "none", 
              position: "absolute", 
              visibility: "hidden",
              width: "320px",
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              background: "#ffffff",
              borderRadius: "12px",
              overflow: "hidden",
              border: "1px solid #e2e8f0",
              boxShadow: "0 4px 20px rgba(0,0,0,0.08)"
            }}
          >
            {/* 简洁头部 */}
            <div style={{
              background: "linear-gradient(135deg, #D4B78C 0%, #E8C6A0 100%)",
              padding: "20px",
              color: "white",
              textAlign: "center"
            }}>
              <div style={{
                fontSize: "18px",
                  fontWeight: "700",
                marginBottom: "4px"
                }}>
                博捷科技报价单
              </div>
              <div style={{
                fontSize: "11px",
                opacity: 0.9
              }}>
                {new Date().toLocaleDateString('zh-CN')} · {generateRandomOrderId()}
              </div>
            </div>
            
            {/* 产品列表 - 简洁设计 */}
            <div style={{ 
              padding: "20px"
            }}>
              <div style={{
                fontSize: "14px",
                fontWeight: "600",
                color: "#374151",
                marginBottom: "16px",
                paddingBottom: "8px",
                borderBottom: "1px solid #f3f4f6"
                }}>
                询价产品清单
              </div>
              
              <div style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px"
              }}>
                {cartItems.map((item, index) => (
                  <div
                    key={item.product.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      padding: "12px",
                      background: "#ffffff",
                      borderRadius: "8px",
                      border: "1px solid #e5e7eb",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                      position: "relative"
                    }}
                  >
                    <div style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "6px",
                      overflow: "hidden",
                      background: "#f9fafb",
                      border: "1px solid #e5e7eb",
                      flexShrink: 0
                    }}>
                      <img
                        src={(
                          item.product.images.find((img) => img.type === "main") ||
                          item.product.images[0]
                        ).url}
                        alt={item.product.code}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover"
                        }}
                        crossOrigin="anonymous"
                      />
                    </div>
                    
                    <div style={{
                      marginLeft: "12px",
                      flex: 1,
                      minWidth: 0,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between"
                    }}>
                      {/* 产品基本信息 */}
                      <div>
                      <div style={{
                        fontWeight: "600",
                          color: "#1f2937",
                          fontSize: "13px",
                          marginBottom: "2px",
                          lineHeight: "1.3"
                      }}>
                        {item.product.code}
                      </div>
                      <div style={{
                          fontSize: "10px",
                          color: "#9ca3af",
                          marginBottom: "8px",
                        fontFamily: "'SF Mono', Consolas, monospace"
                      }}>
                        {item.product.code}
                        </div>
                      </div>
                      
                      {/* 数量信息 */}
                      <div style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        alignItems: "center",
                        marginTop: "8px"
                        }}>
                          <span style={{
                          fontSize: "11px",
                          color: "#6b7280",
                          fontWeight: "500"
                        }}>
                          × {item.quantity}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
            
              {/* 简洁总计 */}
              <div style={{
                marginTop: "16px",
                paddingTop: "16px",
                borderTop: "1px solid #f3f4f6",
                display: "flex",
                justifyContent: "center",
                alignItems: "center"
              }}>
                <span style={{
                  fontSize: "13px",
                  color: "#6b7280",
                  fontWeight: "500"
                }}>
                  共 {totalItems} 件商品
                </span>
              </div>
              
              {/* 底部信息 */}
              <div style={{
                fontSize: "10px",
                color: "#9ca3af",
                textAlign: "center",
                marginTop: "16px",
                paddingTop: "12px",
                borderTop: "1px solid #f3f4f6"
              }}>
                本报价单有效期7天 · 
                <span 
                  style={{
                    cursor: "pointer",
                    color: "#D4B78C",
                    textDecoration: "underline"
                  }}
                  onClick={() => setIsServiceModalOpen(true)}
                >
                  具体价格请联系客服
                </span>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
      
      {/* 客服弹窗 */}
      <CustomerServiceModal
        isOpen={isServiceModalOpen}
        onClose={() => setIsServiceModalOpen(false)}
      />
    </Sheet>
  );
};

export default CartDrawer;
