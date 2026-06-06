import axios from "axios";

const API = process.env.REACT_APP_SERVER_URL;

const api = axios.create({
  baseURL: API,
});

export const loginUser = (data) => api.post("/api/auth/login", data);
export const registerUser = (data) => api.post("/api/auth/register", data);
export const getMe = () => api.get("/api/auth/me");

export default api;