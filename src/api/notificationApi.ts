import axiosClient from "./axiosClient";

export const getMyNotificationsApi = async () => {
  const response = await axiosClient.get("/notifications");
  return response.data;
};

export const markNotificationAsReadApi = async (id: number) => {
  const response = await axiosClient.patch(`/notifications/${id}/read`);
  return response.data;
};