import React, { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Settings, User, Upload, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

interface SettingsData {
  id?: string;
  companyName: string;
  companyLogo: string;
  companyDescription: string;
  contactPhone: string;
  contactEmail: string;
  contactAddress: string;
  customerServiceQrCode?: string;
  wechatNumber: string;
}

const AdminSettings = () => {
  const [settings, setSettings] = useState<SettingsData>({
    companyName: "汕头博捷科技有限公司",
    companyLogo: "博捷科技",
    companyDescription: "专业提供化妆品定制、批量生产、样品申请和设计咨询服务",
    contactPhone: "+86 123 4567 8910",
    contactEmail: "contact@bojietech.com",
    contactAddress: "广东省汕头市某某区某某路88号",
    wechatNumber: "bojie_tech"
  });
  
  const [qrCodeFile, setQrCodeFile] = useState<File | null>(null);
  const [qrCodePreview, setQrCodePreview] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 获取设置数据
  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/settings");
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setSettings(result.data);
          if (result.data.customerServiceQrCode) {
            setQrCodePreview(`/api/static/${result.data.customerServiceQrCode}`);
          }
        }
      }
    } catch (error) {
      console.error("获取设置失败:", error);
      toast.error("获取设置失败");
    } finally {
      setIsLoading(false);
    }
  };

  // 处理二维码文件选择
  const handleQrCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setQrCodeFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setQrCodePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // 保存设置
  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append("company_name", settings.companyName);
      formData.append("company_logo", settings.companyLogo);
      formData.append("company_description", settings.companyDescription);
      formData.append("contact_phone", settings.contactPhone);
      formData.append("contact_email", settings.contactEmail);
      formData.append("contact_address", settings.contactAddress);
      formData.append("wechat_number", settings.wechatNumber);
      
      if (qrCodeFile) {
        formData.append("qr_code_file", qrCodeFile);
      }

      const token = localStorage.getItem("admin_token");
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          toast.success("设置保存成功");
          setSettings(result.data);
          setQrCodeFile(null);
        } else {
          toast.error(result.message || "保存失败");
        }
      } else {
        toast.error("保存失败");
      }
    } catch (error) {
      console.error("保存设置失败:", error);
      toast.error("保存设置失败");
    } finally {
      setIsSaving(false);
    }
  };

  // 组件加载时获取设置
  useEffect(() => {
    fetchSettings();
  }, []);

  return (
    <AdminLayout title="系统设置">
      <Tabs defaultValue="company" className="w-full">
        <TabsList className="grid w-full md:w-auto md:inline-flex grid-cols-3 md:grid-cols-none mb-6">
          <TabsTrigger value="company">公司信息</TabsTrigger>
          <TabsTrigger value="general">基本设置</TabsTrigger>
          <TabsTrigger value="account">账户设置</TabsTrigger>
        </TabsList>
        
        <TabsContent value="company">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>公司基本信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-3">
                  <Label htmlFor="companyName">公司名称</Label>
                  <Input 
                    id="companyName" 
                    value={settings.companyName}
                    onChange={(e) => setSettings({...settings, companyName: e.target.value})}
                    className="max-w-md" 
                  />
                </div>

                <div className="grid gap-3">
                  <Label htmlFor="companyLogo">公司简称/LOGO文字</Label>
                  <Input 
                    id="companyLogo" 
                    value={settings.companyLogo}
                    onChange={(e) => setSettings({...settings, companyLogo: e.target.value})}
                    className="max-w-md" 
                  />
                </div>

                <div className="grid gap-3">
                  <Label htmlFor="companyDescription">公司介绍</Label>
                  <Textarea 
                    id="companyDescription" 
                    value={settings.companyDescription}
                    onChange={(e) => setSettings({...settings, companyDescription: e.target.value})}
                    className="max-w-md" 
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>联系信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-3">
                  <Label htmlFor="contactPhone">联系电话</Label>
                  <Input 
                    id="contactPhone" 
                    value={settings.contactPhone}
                    onChange={(e) => setSettings({...settings, contactPhone: e.target.value})}
                    className="max-w-md" 
                  />
                </div>

                <div className="grid gap-3">
                  <Label htmlFor="contactEmail">邮箱地址</Label>
                  <Input 
                    id="contactEmail" 
                    value={settings.contactEmail}
                    onChange={(e) => setSettings({...settings, contactEmail: e.target.value})}
                    className="max-w-md" 
                  />
                </div>

                <div className="grid gap-3">
                  <Label htmlFor="contactAddress">公司地址</Label>
                  <Textarea 
                    id="contactAddress" 
                    value={settings.contactAddress}
                    onChange={(e) => setSettings({...settings, contactAddress: e.target.value})}
                    className="max-w-md" 
                    rows={2}
                  />
                </div>

                <div className="grid gap-3">
                  <Label htmlFor="wechatNumber">微信号</Label>
                  <Input 
                    id="wechatNumber" 
                    value={settings.wechatNumber}
                    onChange={(e) => setSettings({...settings, wechatNumber: e.target.value})}
                    className="max-w-md" 
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>客服二维码</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-3">
                  <Label htmlFor="qrCode">上传客服二维码</Label>
                  <div className="flex items-center gap-4">
                    <Input 
                      id="qrCode" 
                      type="file"
                      accept="image/*"
                      onChange={handleQrCodeChange}
                      className="max-w-md" 
                    />
                    <Upload className="h-4 w-4 text-gray-400" />
                  </div>
                </div>

                {qrCodePreview && (
                  <div className="grid gap-3">
                    <Label>当前二维码预览</Label>
                    <div className="w-32 h-32 border rounded-lg overflow-hidden">
                      <img 
                        src={qrCodePreview} 
                        alt="客服二维码预览" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button
                onClick={handleSaveSettings}
                disabled={isSaving}
                className="bg-gray-900 hover:bg-gray-800 text-white"
              >
                <Settings className="mr-2 h-4 w-4" />
                {isSaving ? "保存中..." : "保存公司信息"}
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="general">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>网站设置</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center space-x-2">
                  <Switch id="showPopular" defaultChecked />
                  <Label htmlFor="showPopular">在首页显示热门产品</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch id="showNew" defaultChecked />
                  <Label htmlFor="showNew">在首页显示最新产品</Label>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>语言设置</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center space-x-2">
                  <Switch id="enableEnglish" />
                  <Label htmlFor="enableEnglish">启用英文版本</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch id="defaultLangChinese" defaultChecked />
                  <Label htmlFor="defaultLangChinese">默认使用中文</Label>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button className="bg-gray-900 hover:bg-gray-800 text-white">
                <Settings className="mr-2 h-4 w-4" />
                保存设置
              </Button>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle>账户信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-3">
                <Label htmlFor="username">用户名</Label>
                <Input id="username" defaultValue="admin" className="max-w-md" />
              </div>

              <div className="grid gap-3">
                <Label htmlFor="email">电子邮箱</Label>
                <Input id="email" defaultValue="admin@example.com" className="max-w-md" />
              </div>

              <div className="grid gap-3">
                <Label htmlFor="currentPassword">当前密码</Label>
                <Input id="currentPassword" type="password" className="max-w-md" />
              </div>

              <div className="grid gap-3">
                <Label htmlFor="newPassword">新密码</Label>
                <Input id="newPassword" type="password" className="max-w-md" />
              </div>

              <div className="grid gap-3">
                <Label htmlFor="confirmPassword">确认新密码</Label>
                <Input id="confirmPassword" type="password" className="max-w-md" />
              </div>

              <div className="flex justify-end">
                <Button className="bg-gray-900 hover:bg-gray-800 text-white">
                  <User className="mr-2 h-4 w-4" />
                  更新账户
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
};

export default AdminSettings;