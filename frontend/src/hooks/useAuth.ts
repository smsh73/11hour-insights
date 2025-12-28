import { useState, useEffect } from 'react';
import { authService } from '../services/auth';

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setIsAuthenticated(authService.isAuthenticated());
    setLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    try {
      await authService.login({ username, password });
      setIsAuthenticated(true);
      return true;
    } catch (error) {
      setIsAuthenticated(false);
      throw error;
    }
  };

  const logout = () => {
    authService.logout();
    setIsAuthenticated(false);
  };

  return {
    isAuthenticated,
    loading,
    login,
    logout,
  };
}

