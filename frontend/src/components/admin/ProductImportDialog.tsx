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
import { Loader2, Upload, FileDown, CheckCircle, XCircle, AlertTriangle, FileText, Image as ImageIcon } from "lucide-react";
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
      a.download = 'product_import_template.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download template",
        variant: "destructive",
      });
    }
  };

  const handleImport = async () => {
    if (!excelFile) {
      toast({
        title: "Error",
        description: "Please select an Excel file",
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
          title: "Success",
          description: `Successfully imported ${result.imported} products.`,
        });
        if (onSuccess) onSuccess();
      } else {
        toast({
          title: "Import Completed with Issues",
          description: `Imported: ${result.imported}, Failed: ${result.failed}`,
          variant: "default",
        });
        if (onSuccess) onSuccess(); // Refresh list anyway
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "An unexpected error occurred";
      toast({
        title: "Import Failed",
        description: message,
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
        <Button variant="outline" className="gap-2">
          <Upload className="h-4 w-4" />
          Batch Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Batch Import Products</DialogTitle>
          <DialogDescription>
            Upload an Excel file with product data. Optionally upload a ZIP file containing product images.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          {/* Instructions */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md text-sm space-y-2">
            <h4 className="font-semibold flex items-center gap-2 text-blue-700 dark:text-blue-300">
              <FileDown className="h-4 w-4" />
              Instructions
            </h4>
            <ul className="list-disc list-inside space-y-1 text-blue-600 dark:text-blue-400">
              <li>Download the template to see the required format.</li>
              <li>Required columns: <strong>货号 (Product Code)</strong>.</li>
              <li>
                <strong>Images (Optional):</strong> Upload a ZIP file containing folders named after the Product Code.
                <ul className="list-circle list-inside ml-4 mt-1 text-xs opacity-80">
                  <li>Example: ZIP contains folder <code>P001</code> which contains <code>1.jpg</code>, <code>2.jpg</code></li>
                  <li>Images will be automatically optimized and linked.</li>
                </ul>
              </li>
            </ul>
            <Button 
              variant="link" 
              className="h-auto p-0 text-blue-700 dark:text-blue-300 underline"
              onClick={handleDownloadTemplate}
            >
              Download Excel Template
            </Button>
          </div>

          {/* File Inputs */}
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="excel-file" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Excel File (Required)
              </Label>
              <Input
                id="excel-file"
                type="file"
                accept=".xlsx, .xls"
                onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="zip-file" className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Images ZIP (Optional)
              </Label>
              <Input
                id="zip-file"
                type="file"
                accept=".zip"
                onChange={(e) => setZipFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>

          {/* Results Display */}
          {result && (
            <div className="space-y-4 border-t pt-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-lg">
                  <div className="text-sm text-muted-foreground">Total</div>
                  <div className="text-xl font-bold">{result.total}</div>
                </div>
                <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-lg">
                  <div className="text-sm text-green-600 dark:text-green-400">Success</div>
                  <div className="text-xl font-bold text-green-700 dark:text-green-300">{result.imported}</div>
                </div>
                <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-lg">
                  <div className="text-sm text-red-600 dark:text-red-400">Failed</div>
                  <div className="text-xl font-bold text-red-700 dark:text-red-300">{result.failed}</div>
                </div>
              </div>

              {(result.errors.length > 0 || result.warnings.length > 0) && (
                <ScrollArea className="h-40 rounded-md border p-4 bg-muted/50">
                  {result.errors.map((err, i) => (
                    <div key={`err-${i}`} className="flex items-start gap-2 text-sm text-red-600 mb-2">
                      <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>{err}</span>
                    </div>
                  ))}
                  {result.warnings.map((warn, i) => (
                    <div key={`warn-${i}`} className="flex items-start gap-2 text-sm text-yellow-600 mb-2">
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
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
            Close
          </Button>
          <Button onClick={handleImport} disabled={isLoading || !excelFile}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Start Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
