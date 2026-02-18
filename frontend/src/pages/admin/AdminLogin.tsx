
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Lock, LogIn, User } from "lucide-react";
import { useAuth, useRedirectIfAuthenticated } from "@/hooks/useAuth";

const AdminLogin = () => {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const { toast } = useToast();

  // Use the auth hook
  const { login, isLoginPending } = useAuth();

  // Redirect if already authenticated
  useRedirectIfAuthenticated();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await login({ username, password });
    } catch (error) {
      // Error handling is done in the useAuth hook
      console.error('Login error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-cosmetic-beige-100 to-cosmetic-beige-200 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-serif font-semibold gold-text mb-2">TURTLE ALBUM</h1>
            <p className="text-cosmetic-brown-300">管理员登录</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium text-cosmetic-brown-500">
                用户名
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-cosmetic-brown-300" />
                </div>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10 bg-cosmetic-beige-100 border-cosmetic-beige-300"
                  placeholder="请输入用户名"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-cosmetic-brown-500">
                密码
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-cosmetic-brown-300" />
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 bg-cosmetic-beige-100 border-cosmetic-beige-300"
                  placeholder="请输入密码"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-cosmetic-gold-400 hover:bg-cosmetic-gold-500 text-white"
              disabled={isLoginPending}
            >
              {isLoginPending ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  登录中...
                </span>
              ) : (
                <span className="flex items-center">
                  <LogIn className="mr-2 h-4 w-4" />
                  登录
                </span>
              )}
            </Button>
          </form>

          <div className="mt-8 text-center">
            <a 
              href="/" 
              className="text-sm text-cosmetic-brown-300 hover:text-cosmetic-brown-500"
            >
              返回首页
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
