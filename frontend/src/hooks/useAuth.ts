import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { authService, LoginCredentials, User, handleAuthError } from '@/services/authService';
import { useToast } from '@/hooks/use-toast';
import apiClient from '@/lib/api';

// Auth query keys
export const AUTH_QUERY_KEYS = {
  user: ['auth', 'user'] as const,
  verify: ['auth', 'verify'] as const,
};

export const useAuth = () => {
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Check if user is authenticated on mount
  const isAuthenticated = authService.isAuthenticated();
  const currentUser = authService.getCurrentUser();

  // Verify token query (only run if we have a token)
  const { data: verifiedUser, isError: isVerifyError } = useQuery({
    queryKey: AUTH_QUERY_KEYS.verify,
    queryFn: () => authService.verifyToken(),
    enabled: isAuthenticated,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: (credentials: LoginCredentials) => authService.login(credentials),
    onSuccess: (authData) => {
      toast({
        title: "登录成功",
        description: `欢迎回来，${authData.user.username}！`,
      });
      
      // Redirect to admin products (default landing)
      window.location.href = '/admin/products';
    },
    onError: (error: Error) => {
      const authError = handleAuthError(error);
      toast({
        title: "登录失败",
        description: authError.message,
        variant: "destructive",
      });
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: () => {
      toast({
        title: "已退出登录",
        description: "您已成功退出登录",
      });
      
      // Redirect to admin login
      window.location.href = '/admin';
    },
    onError: (error: Error) => {
      // Even if logout fails on server, we still redirect
      console.error('Logout error:', error);
      window.location.href = '/admin';
    },
  });

  // Update loading state
  useEffect(() => {
    if (isAuthenticated) {
      // If we have a token, wait for verification
      setIsLoading(false);
    } else {
      // If no token, not loading
      setIsLoading(false);
    }
  }, [isAuthenticated, verifiedUser, isVerifyError]);

  // If token verification fails, clear auth state
  useEffect(() => {
    if (isVerifyError && isAuthenticated) {
      // Clear token without calling logout API to avoid infinite loop
      localStorage.removeItem('admin_token');
      delete apiClient.defaults.headers.common['Authorization'];
    }
  }, [isVerifyError, isAuthenticated]);

  const login = async (credentials: LoginCredentials) => {
    return loginMutation.mutateAsync(credentials);
  };

  const logout = async () => {
    return logoutMutation.mutateAsync();
  };

  return {
    user: verifiedUser || currentUser,
    isAuthenticated: isAuthenticated && !isVerifyError,
    isLoading: isLoading || loginMutation.isPending || logoutMutation.isPending,
    login,
    logout,
    loginError: loginMutation.error,
    isLoginPending: loginMutation.isPending,
  };
};

// Hook for protecting admin routes
export const useRequireAuth = () => {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Redirect to login if not authenticated
      window.location.href = '/admin';
    }
  }, [isAuthenticated, isLoading]);

  return { isAuthenticated, isLoading };
};

// Hook for redirecting authenticated users away from login page
export const useRedirectIfAuthenticated = () => {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      // Redirect to admin products (default landing) if already authenticated
      window.location.href = '/admin/products';
    }
  }, [isAuthenticated, isLoading]);

  return { isAuthenticated, isLoading };
};
