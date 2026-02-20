import React from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, ShoppingCart, Heart } from "lucide-react";
import { useProducts } from "@/hooks/useProducts";
import { useRequireAuth } from "@/hooks/useAuth";
import { Product } from "@/types/products";
import { formatCnyPriceOrNotForSale } from "@/lib/utils";

const AdminDashboard = () => {
  // Require authentication
  const { isAuthenticated } = useRequireAuth();

  // Fetch products from API
  const { data: apiProductsData, isLoading, error } = useProducts({
    enabled: isAuthenticated,
    page: 1,
    limit: 1000,
  });

  const products: Product[] = apiProductsData?.products || [];

  // Calculate dashboard statistics
  const totalProducts = products.length;
  const inStockProducts = products.filter(product => product.inStock).length;
  const popularProducts = products.filter(product => product.popularityScore > 7).length;

  // Recent products
  const recentProducts = [...products]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  // Popular products
  const topProducts = [...products]
    .sort((a, b) => b.popularityScore - a.popularityScore)
    .slice(0, 5);

  // Show loading state
  if (isLoading) {
    return (
      <AdminLayout title="仪表板">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-gray-600">加载中...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  // Show error state
  if (error) {
    return (
      <AdminLayout title="仪表板">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-gray-900 mb-4">加载数据时发生错误</p>
            <Button
              onClick={() => window.location.reload()}
              className="bg-gray-900 hover:bg-gray-800 text-white"
            >
              重新加载
            </Button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="控制面板">
      {/* Stats Cards */}
      <div className="grid grid-cols-3 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-6 mb-4 sm:mb-8">
        <Card>
          <CardContent className="p-2 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-gray-600 leading-tight">产品总数</p>
              <h3 className="text-xl sm:text-3xl font-bold text-gray-900 mt-0.5 sm:mt-1 leading-none">{totalProducts}</h3>
            </div>
            <div className="hidden sm:flex h-10 w-10 sm:h-12 sm:w-12 bg-gray-100 rounded-full items-center justify-center text-gray-700">
              <Package className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-2 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-gray-600 leading-tight">有货产品</p>
              <h3 className="text-xl sm:text-3xl font-bold text-gray-900 mt-0.5 sm:mt-1 leading-none">{inStockProducts}</h3>
            </div>
            <div className="hidden sm:flex h-10 w-10 sm:h-12 sm:w-12 bg-gray-100 rounded-full items-center justify-center text-gray-700">
              <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-2 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-gray-600 leading-tight">热门产品</p>
              <h3 className="text-xl sm:text-3xl font-bold text-gray-900 mt-0.5 sm:mt-1 leading-none">{popularProducts}</h3>
            </div>
            <div className="hidden sm:flex h-10 w-10 sm:h-12 sm:w-12 bg-gray-100 rounded-full items-center justify-center text-gray-700">
              <Heart className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Product Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6">
        <Card>
          <CardHeader className="px-4 pt-4 pb-2 sm:px-6 sm:pt-6 sm:pb-3">
            <CardTitle className="text-xl sm:text-2xl">最新产品</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
            <div className="space-y-2 sm:space-y-4">
              {recentProducts.map((product) => (
                <div key={product.id} className="flex items-center gap-3 sm:gap-4 p-2 sm:p-3 hover:bg-gray-50 rounded-md transition-colors">
                  <div className="h-10 w-10 sm:h-12 sm:w-12 bg-white border border-gray-200 rounded flex items-center justify-center overflow-hidden">
                    {product.images && product.images[0] ? (
                      <img
                        src={product.images[0].url}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Package className="h-5 w-5 sm:h-6 sm:w-6 text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">{product.name}</p>
                    <p className="text-xs text-gray-600">
                      {new Date(product.createdAt).toLocaleDateString('zh-CN')}
                    </p>
                  </div>
                  <div className="text-xs sm:text-sm font-medium text-gray-900">
                    {formatCnyPriceOrNotForSale(product.pricing.price)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="px-4 pt-4 pb-2 sm:px-6 sm:pt-6 sm:pb-3">
            <CardTitle className="text-xl sm:text-2xl">热门产品</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
            <div className="space-y-2 sm:space-y-4">
              {topProducts.map((product) => (
                <div key={product.id} className="flex items-center gap-3 sm:gap-4 p-2 sm:p-3 hover:bg-gray-50 rounded-md transition-colors">
                  <div className="h-10 w-10 sm:h-12 sm:w-12 bg-white border border-gray-200 rounded flex items-center justify-center overflow-hidden">
                    {product.images && product.images[0] ? (
                      <img
                        src={product.images[0].url}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Package className="h-5 w-5 sm:h-6 sm:w-6 text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">{product.name}</p>
                    <p className="text-xs text-gray-600">
                      人气: {product.popularityScore}/100
                    </p>
                  </div>
                  <div className="text-xs sm:text-sm font-medium text-gray-900">
                    {formatCnyPriceOrNotForSale(product.pricing.price)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
