import axiosClient from "./axiosClient";

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export const registerApi = async (payload: RegisterPayload) => {
  const response = await axiosClient.post("/auth/register", payload);
  return response.data;
};

export const loginApi = async (payload: LoginPayload) => {
  const response = await axiosClient.post("/auth/login", payload);
  return response.data;
};