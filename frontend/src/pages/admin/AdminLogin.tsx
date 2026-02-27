
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Lock, LogIn, User } from "lucide-react";
import { useAuth, useRedirectIfAuthenticated } from "@/hooks/useAuth";

const AdminLogin = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
    <div className="min-h-screen bg-neutral-50 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-[0_10px_30px_rgba(0,0,0,0.08)] p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold tracking-wide text-neutral-900 mb-2">Turtle Album</h1>
            <p className="text-sm text-neutral-600">管理员登录</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium text-neutral-700">
                用户名
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-neutral-400" />
                </div>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10 bg-white border-neutral-200 focus-visible:ring-[#FFD400]"
                  placeholder="请输入用户名"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-neutral-700">
                密码
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-neutral-400" />
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 bg-white border-neutral-200 focus-visible:ring-[#FFD400]"
                  placeholder="请输入密码"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-[#FFD400] hover:bg-[#f0c800] text-black"
              disabled={isLoginPending}
            >
              {isLoginPending ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
              className="text-sm text-neutral-500 hover:text-neutral-800"
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
