
import React from "react";
import { ShoppingCart, Filter } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface FloatingActionButtonsProps {
  onCartClick?: () => void;
  onFilterClick?: () => void;
  cartItemCount?: number;
}

const FloatingActionButtons: React.FC<FloatingActionButtonsProps> = ({
  onCartClick,
  onFilterClick,
  cartItemCount = 0,
}) => {
  const isMobile = useIsMobile();

  return (
    <>
      {/* Only show filter button on mobile */}
      {isMobile && (
        <button
          className="floating-button filter"
          onClick={onFilterClick}
          aria-label="筛选产品"
          style={{ backgroundColor: "#D4B78C" }}
        >
          <Filter color="white" size={24} />
        </button>
      )}
      
      {/* Always show cart button */}
      <button
        className="floating-button cart"
        onClick={onCartClick}
        aria-label="购物车"
        style={{ backgroundColor: "#D4B78C" }}
      >
        <ShoppingCart color="white" size={24} />
        {cartItemCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-white text-cosmetic-gold-500 text-xs rounded-full w-5 h-5 flex items-center justify-center border border-cosmetic-gold-400">
            {cartItemCount > 99 ? '99+' : cartItemCount}
          </span>
        )}
      </button>
    </>
  );
};

export default FloatingActionButtons;
