import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Upload, FileDown, XCircle, AlertTriangle, FileText, Image as ImageIcon } from "lucide-react";
import { adminProductService } from '@/services/productService';
import { useToast } from "@/components/ui/use-toast";

interface ProductImportDialogProps {
  onSuccess?: () => void;
}

export function ProductImportDialog({ onSuccess }: ProductImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [result, setResult] = useState<{
    success: boolean;
    total: number;
    imported: number;
    failed: number;
    errors: string[];
    warnings: string[];
  } | null>(null);
  const { toast } = useToast();

  const handleDownloadTemplate = async () => {
    try {
      const blob = await adminProductService.getImportTemplate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '产品批量导入模板.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast({
        title: "下载失败",
        description: "模板下载失败，请稍后重试",
        variant: "destructive",
      });
    }
  };

  const handleImport = async () => {
    if (!excelFile) {
      toast({
        title: "缺少文件",
        description: "请先选择 Excel 文件",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const result = await adminProductService.batchImportProducts(excelFile, zipFile || undefined);
      setResult(result);
      
      if (result.success && result.failed === 0) {
        toast({
          title: "导入成功",
          description: `成功导入 ${result.imported} 个产品`,
        });
        if (onSuccess) onSuccess();
      } else {
        toast({
          title: "导入完成（有问题）",
          description: `成功：${result.imported}，失败：${result.failed}`,
          variant: "default",
        });
        if (onSuccess) onSuccess(); // Refresh list anyway
      }
    } catch (error: unknown) {
      toast({
        title: "导入失败",
        description: error instanceof Error ? error.message : "发生未知错误，请稍后重试",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setExcelFile(null);
    setZipFile(null);
    setResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      setOpen(val);
      if (!val) resetForm();
    }}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 border-gray-300 text-gray-700 hover:bg-gray-100 flex-1 sm:flex-none"
        >
          <Upload className="h-4 w-4" />
          批量导入
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>批量导入产品</DialogTitle>
          <DialogDescription>
            上传 Excel 产品数据；可选上传图片 ZIP（按编号分文件夹）
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          <Alert className="border-gray-200 bg-gray-50 text-gray-700">
            <FileDown className="h-4 w-4 text-gray-900" />
            <div className="space-y-2">
              <AlertTitle className="text-gray-900">导入说明</AlertTitle>
              <AlertDescription className="space-y-2">
                <ul className="list-disc list-inside space-y-1">
                  <li>先下载模板，按模板格式填写。</li>
                  <li>必填列：<strong>编号</strong>。</li>
                  <li>
                    图片（可选）：上传 ZIP，内部文件夹以编号命名。
                    <ul className="list-disc list-inside ml-4 mt-1 text-xs opacity-80">
                      <li>示例：ZIP 内有 <code>P001</code> 文件夹，里面是 <code>1.jpg</code>、<code>2.jpg</code></li>
                      <li>系统会自动关联到对应产品。</li>
                    </ul>
                  </li>
                </ul>
                <Button
                  variant="link"
                  className="h-auto p-0 text-gray-900 hover:text-gray-900 underline"
                  onClick={handleDownloadTemplate}
                >
                  下载 Excel 模板
                </Button>
              </AlertDescription>
            </div>
          </Alert>

          {/* File Inputs */}
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="excel-file" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Excel 文件（必填）
              </Label>
              <Input
                id="excel-file"
                type="file"
                accept=".xlsx, .xls"
                className="border-gray-200"
                onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="zip-file" className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                图片 ZIP（可选）
              </Label>
              <Input
                id="zip-file"
                type="file"
                accept=".zip"
                className="border-gray-200"
                onChange={(e) => setZipFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>

          {/* Results Display */}
          {result && (
            <div className="space-y-4 border-t pt-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <div className="text-sm text-gray-600">总数</div>
                  <div className="text-xl font-bold">{result.total}</div>
                </div>
                <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200">
                  <div className="text-sm text-emerald-700">成功</div>
                  <div className="text-xl font-bold text-emerald-800">{result.imported}</div>
                </div>
                <div className="bg-rose-50 p-3 rounded-lg border border-rose-200">
                  <div className="text-sm text-rose-700">失败</div>
                  <div className="text-xl font-bold text-rose-800">{result.failed}</div>
                </div>
              </div>

              {(result.errors.length > 0 || result.warnings.length > 0) && (
                <ScrollArea className="h-40 rounded-md border border-gray-200 p-4 bg-gray-50">
                  {result.errors.map((err, i) => (
                    <div key={`err-${i}`} className="flex items-start gap-2 text-sm text-rose-700 mb-2">
                      <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>{err}</span>
                    </div>
                  ))}
                  {result.warnings.map((warn, i) => (
                    <div key={`warn-${i}`} className="flex items-start gap-2 text-sm text-amber-700 mb-2">
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>{warn}</span>
                    </div>
                  ))}
                </ScrollArea>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="pt-4 border-t">
          <Button
            variant="outline"
            className="border-gray-300 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
            onClick={() => setOpen(false)}
            disabled={isLoading}
          >
            关闭
          </Button>
          <Button
            className="bg-gray-900 hover:bg-gray-800 text-white"
            onClick={handleImport}
            disabled={isLoading || !excelFile}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            开始导入
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
