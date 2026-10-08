import { login, signup, logout, getUser, handleAuthCallback, requestPasswordRecovery, updateUser } from '@netlify/identity';
window.LVAuth = { login, signup, logout, getUser, handleAuthCallback, requestPasswordRecovery, updateUser };
