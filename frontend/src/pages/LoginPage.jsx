import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom'; // <-- Step 1: Import the navigation tool
import { useAuth } from '../context/AuthContext.jsx';
import apiClient from '../api.js';
import './LoginPage.css';

const LoginPage = () => {
  // State for the login form
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // State for the register form
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');

  // State for feedback messages
  const [loginFeedback, setLoginFeedback] = useState('');
  const [registerFeedback, setRegisterFeedback] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate(); // <-- Step 2: Initialize the navigation function

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegisterFeedback('');
    try {
      await apiClient.post('/users/', {
        username: registerUsername,
        password: registerPassword,
      });
      setRegisterFeedback({ message: `User '${registerUsername}' registered successfully! You can now log in.`, type: 'success' });
    } catch (error) {
      const errorMessage = error.response?.data?.detail || 'Registration failed. Please try again.';
      setRegisterFeedback({ message: errorMessage, type: 'error' });
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginFeedback('');
    try {
      const formData = new URLSearchParams();
      formData.append('username', loginUsername);
      formData.append('password', loginPassword);

      const response = await apiClient.post('/token', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      
      login(response.data.access_token);
      
      // --- FIX ---
      // Step 3: After a successful login, navigate to the dashboard page.
      navigate('/'); 

    } catch (error) {
      const errorMessage = error.response?.data?.detail || 'Login failed. Please check your credentials.';
      setLoginFeedback({ message: errorMessage, type: 'error' });
    }
  };

  return (
    <div className="login-page-container">
      {/* Login Form */}
      <form onSubmit={handleLogin} className="auth-form">
        <h2>Login</h2>
        <input
          type="text"
          placeholder="Username"
          value={loginUsername}
          onChange={(e) => setLoginUsername(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={loginPassword}
          onChange={(e) => setLoginPassword(e.target.value)}
          required
        />
        <button type="submit">Login</button>
        {loginFeedback && <p className={`feedback-message ${loginFeedback.type}`}>{loginFeedback.message}</p>}
      </form>

      {/* Register Form */}
      <form onSubmit={handleRegister} className="auth-form">
        <h2>Register</h2>
        <input
          type="text"
          placeholder="Username"
          value={registerUsername}
          onChange={(e) => setRegisterUsername(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={registerPassword}
          onChange={(e) => setRegisterPassword(e.target.value)}
          required
        />
        <button type="submit">Register</button>
        {registerFeedback && <p className={`feedback-message ${registerFeedback.type}`}>{registerFeedback.message}</p>}
      </form>
    </div>
  );
};

export default LoginPage;

