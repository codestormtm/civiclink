import axios from "axios";
import { clearCitizenSession, getToken } from "../utils/auth";
import { API_BASE_URL } from "./config";

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      await clearCitizenSession();
      window.location.reload();
    }
    return Promise.reject(err);
  }
);

export default api;
