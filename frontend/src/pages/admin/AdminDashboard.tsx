
import React from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, ShoppingCart, Heart, Award } from "lucide-react";
import { useProducts } from "@/hooks/useProducts";
import { useRequireAuth } from "@/hooks/useAuth";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { CosmeticProduct } from "@/types/cosmetics";

const AdminDashboard = () => {
  // Require authentication
  const { isAuthenticated } = useRequireAuth();

  // Fetch products from API
  const { data: apiProductsData, isLoading, error } = useProducts({
    enabled: isAuthenticated,
    page: 1,
    limit: 1000,
  });

  const products: CosmeticProduct[] = apiProductsData?.products || [];

  // Calculate dashboard statistics
  const totalProducts = products.length;
  const inStockProducts = products.filter(product => product.inStock).length;
  const popularProducts = products.filter(product => product.popularityScore > 7).length;
  const productTypes = [
    ...new Set([
      ...products.map(product => product.tubeType).filter(Boolean),
      ...products.map(product => product.boxType).filter(Boolean),
    ]),
  ].length;

  const productTypesData = Object.entries(
    products.reduce<Record<string, number>>((acc, product) => {
      const tubeType = product.tubeType;
      const boxType = product.boxType;
      if (tubeType) acc[tubeType] = (acc[tubeType] || 0) + 1;
      if (boxType) acc[boxType] = (acc[boxType] || 0) + 1;
      return acc;
    }, {})
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const materialData = Object.entries(
    products.reduce<Record<string, number>>((acc, product) => {
      const material = product.material;
      if (material) {
        const key = material.trim();
        acc[key] = (acc[key] || 0) + 1;
      }
      return acc;
    }, {})
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 7);

  // Recent products
  const recentProducts = [...products]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  // Popular products
  const topProducts = [...products]
    .sort((a, b) => b.popularityScore - a.popularityScore)
    .slice(0, 5);

  // Colors for the pie chart
  const COLORS = ['#E5CFAE', '#D4B78C', '#9C8C7D', '#8A7B6D', '#786B5E', '#665B4F', '#544A40'];

  // Show loading state
  if (isLoading) {
    return (
      <AdminLayout title="仪表板">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cosmetic-gold-400 mx-auto mb-4"></div>
            <p className="text-cosmetic-brown-300">加载中...</p>
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
            <p className="text-cosmetic-brown-500 mb-4">加载数据时发生错误</p>
            <Button
              onClick={() => window.location.reload()}
              className="bg-cosmetic-gold-400 hover:bg-cosmetic-gold-500"
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-cosmetic-brown-300">产品总数</p>
              <h3 className="text-3xl font-bold text-cosmetic-brown-500 mt-1">{totalProducts}</h3>
            </div>
            <div className="h-12 w-12 bg-cosmetic-beige-100 rounded-full flex items-center justify-center text-cosmetic-gold-500">
              <Package className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-cosmetic-brown-300">有货产品</p>
              <h3 className="text-3xl font-bold text-cosmetic-brown-500 mt-1">{inStockProducts}</h3>
            </div>
            <div className="h-12 w-12 bg-cosmetic-beige-100 rounded-full flex items-center justify-center text-cosmetic-gold-500">
              <ShoppingCart className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-cosmetic-brown-300">热门产品</p>
              <h3 className="text-3xl font-bold text-cosmetic-brown-500 mt-1">{popularProducts}</h3>
            </div>
            <div className="h-12 w-12 bg-cosmetic-beige-100 rounded-full flex items-center justify-center text-cosmetic-gold-500">
              <Heart className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-cosmetic-brown-300">产品类型</p>
              <h3 className="text-3xl font-bold text-cosmetic-brown-500 mt-1">{productTypes}</h3>
            </div>
            <div className="h-12 w-12 bg-cosmetic-beige-100 rounded-full flex items-center justify-center text-cosmetic-gold-500">
              <Award className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>产品类型分布</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              {productTypesData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-cosmetic-brown-300">
                  暂无数据
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={productTypesData}>
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#F7F3EF',
                        borderColor: '#DBCEBB',
                        borderRadius: '4px'
                      }}
                    />
                    <Bar dataKey="value" fill="#D4B78C" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>材质占比</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80 flex items-center justify-center">
              {materialData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-cosmetic-brown-300">
                  暂无数据
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={materialData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {materialData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#F7F3EF',
                        borderColor: '#DBCEBB',
                        borderRadius: '4px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Product Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>最新产品</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentProducts.map((product) => (
                <div key={product.id} className="flex items-center gap-4 p-3 hover:bg-cosmetic-beige-100 rounded-md transition-colors">
                  <div className="h-12 w-12 bg-white border border-cosmetic-beige-200 rounded flex items-center justify-center overflow-hidden">
                    {product.images && product.images[0] ? (
                      <img
                        src={product.images[0].url}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Package className="h-6 w-6 text-cosmetic-beige-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-cosmetic-brown-500 truncate">{product.name}</p>
                    <p className="text-xs text-cosmetic-brown-300">
                      {new Date(product.createdAt).toLocaleDateString('zh-CN')}
                    </p>
                  </div>
                  <div className="text-sm font-medium text-cosmetic-gold-500">
                    ¥{product.pricing.factoryPrice.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>热门产品</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topProducts.map((product) => (
                <div key={product.id} className="flex items-center gap-4 p-3 hover:bg-cosmetic-beige-100 rounded-md transition-colors">
                  <div className="h-12 w-12 bg-white border border-cosmetic-beige-200 rounded flex items-center justify-center overflow-hidden">
                    {product.images && product.images[0] ? (
                      <img
                        src={product.images[0].url}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Package className="h-6 w-6 text-cosmetic-beige-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-cosmetic-brown-500 truncate">{product.name}</p>
                    <p className="text-xs text-cosmetic-brown-300">
                      人气: {product.popularityScore}/100
                    </p>
                  </div>
                  <div className="text-sm font-medium text-cosmetic-gold-500">
                    ¥{product.pricing.factoryPrice.toFixed(2)}
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
