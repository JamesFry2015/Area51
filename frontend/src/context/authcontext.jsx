import React, { createContext, useState, useContext, useEffect } from 'react';
import apiClient from '../api'; // Import apiClient to set headers dynamically

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [tokenData, setTokenData] = useState(() => {
    try {
      const storedToken = localStorage.getItem('tokenData');
      return storedToken ? JSON.parse(storedToken) : null;
    } catch (error) {
      return null;
    }
  });

  useEffect(() => {
    const updateApiClientHeaders = (data) => {
      if (data?.access_token && data?.token_type) {
        const authHeader = `${data.token_type} ${data.access_token}`;
        apiClient.defaults.headers.common['Authorization'] = authHeader;
      } else {
        delete apiClient.defaults.headers.common['Authorization'];
      }
    };
    updateApiClientHeaders(tokenData);
  }, [tokenData]);

  const login = (newTokenData) => {
    localStorage.setItem('tokenData', JSON.stringify(newTokenData));
    setTokenData(newTokenData);
  };

  const logout = () => {
    localStorage.removeItem('tokenData');
    setTokenData(null);
  };

  const isAuthenticated = !!tokenData?.access_token;

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
