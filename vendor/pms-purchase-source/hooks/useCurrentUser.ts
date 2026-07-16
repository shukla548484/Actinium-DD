"use client";

import { useState, useEffect } from 'react';

interface Employee {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  designation?: string;
  designationAccessLevel?: number;
  department?: string;
  company: {
    id: string;
    name: string;
    code: string;
    type: string;
  };
  assignedModules?: Array<{
    module: {
      name: string;
      description?: string;
    };
  }>;
  assignedVessels?: Array<{
    vessel: {
      name: string;
      code: string;
    };
  }>;
  isActive: boolean;
  lastLogin?: string;
}

export function useCurrentUser() {
  const [user, setUser] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);

  useEffect(() => {
    // First try to get user from localStorage
    const storedUser = localStorage.getItem('user');
    const storedTimestamp = localStorage.getItem('userTimestamp');
    
    if (storedUser && storedTimestamp) {
      try {
        const userData = JSON.parse(storedUser);
        const timestamp = parseInt(storedTimestamp);
        const now = Date.now();
        
        // Use cached data if it's less than 5 minutes old
        if (now - timestamp < 5 * 60 * 1000) {
          setUser(userData);
          setLastFetchTime(timestamp);
          setIsLoading(false);
          return;
        }
      } catch (error) {
        console.error('Error parsing stored user data:', error);
        localStorage.removeItem('user');
        localStorage.removeItem('userTimestamp');
      }
    }
    
    // If no valid cached data, fetch from server
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const response = await fetch('/api/profile/basic', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUser(userData.user);
        const timestamp = Date.now();
        setLastFetchTime(timestamp);
        localStorage.setItem('user', JSON.stringify(userData.user));
        localStorage.setItem('userTimestamp', timestamp.toString());
      } else {
        setUser(null);
        localStorage.removeItem('user');
        localStorage.removeItem('userTimestamp');
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      setUser(null);
      localStorage.removeItem('user');
      localStorage.removeItem('userTimestamp');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    setIsLoading(true);
    await fetchUserData();
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      setUser(null);
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
  };

  return {
    user,
    isLoading,
    refreshUser,
    logout,
    isAuthenticated: !!user
  };
}