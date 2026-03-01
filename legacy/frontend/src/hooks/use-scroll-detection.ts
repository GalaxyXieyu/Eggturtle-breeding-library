
import { useState, useEffect, RefObject } from "react";

export function useScrollDetection(headerRef: RefObject<HTMLDivElement>) {
  const [isFilterSticky, setIsFilterSticky] = useState(false);
  
  // Update filter sticky state based on scroll position
  useEffect(() => {
    const handleScroll = () => {
      if (headerRef.current) {
        const headerHeight = headerRef.current.offsetHeight;
        const scrollPosition = window.scrollY;
        
        // Make filter sticky after scrolling past header
        if (scrollPosition > headerHeight - 30) {
          setIsFilterSticky(true);
        } else {
          setIsFilterSticky(false);
        }
      }
    };

    // Add scroll event listener
    window.addEventListener('scroll', handleScroll);
    
    // Initial check
    handleScroll();
    
    // Clean up
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [headerRef]);

  return { isFilterSticky };
}
