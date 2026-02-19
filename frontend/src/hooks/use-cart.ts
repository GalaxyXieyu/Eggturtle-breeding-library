
import { useState, useEffect } from "react";
import { Product, CartItem } from "@/types/products";

const CART_STORAGE_KEY = 'glam-cart-items';

// 从localStorage加载购物车数据
const loadCartFromStorage = (): CartItem[] => {
  try {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    }
    return [];
  } catch (error) {
    console.warn('Failed to load cart from localStorage:', error);
    return [];
  }
};

// 保存购物车数据到localStorage
const saveCartToStorage = (cartItems: CartItem[]) => {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
    }
  } catch (error) {
    console.warn('Failed to save cart to localStorage:', error);
  }
};

export function useCart() {
  const [cartItems, setCartItems] = useState<CartItem[]>(loadCartFromStorage);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // 每当购物车项目变化时，保存到localStorage
  useEffect(() => {
    saveCartToStorage(cartItems);
  }, [cartItems]);
  
  // Handle adding products to cart
  const handleAddToCart = (product: Product) => {
    setCartItems((prevItems) => {
      const existingItem = prevItems.find(
        (item) => item.product.id === product.id
      );

      if (existingItem) {
        return prevItems.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [...prevItems, { product, quantity: 1 }];
      }
    });
  };

  // Handle removing items from cart
  const handleRemoveFromCart = (productId: string) => {
    setCartItems((prevItems) =>
      prevItems.filter((item) => item.product.id !== productId)
    );
  };

  // Handle changing item quantities in cart
  const handleQuantityChange = (productId: string, quantity: number) => {
    setCartItems((prevItems) =>
      prevItems.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );
  };

  // Clear all items from cart
  const handleClearCart = () => {
    setCartItems([]);
  };

  // Calculate total items in cart
  const totalCartItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return {
    cartItems,
    isCartOpen,
    setIsCartOpen,
    handleAddToCart,
    handleRemoveFromCart,
    handleQuantityChange,
    handleClearCart,
    totalCartItems
  };
}
