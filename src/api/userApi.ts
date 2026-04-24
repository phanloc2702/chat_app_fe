import axiosClient from "./axiosClient";

export const getUsersApi = async () => {
  const response = await axiosClient.get("/users");
  return response.data;
};