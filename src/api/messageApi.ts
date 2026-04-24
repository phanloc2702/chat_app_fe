import axiosClient from "./axiosClient";

export const getMessagesByConversationApi = async (conversationId: number) => {
  const response = await axiosClient.get(`/messages/${conversationId}`);
  return response.data;
};

export const sendMessageApi = async (payload: {
  conversationId: number;
  content: string;
}) => {
  const response = await axiosClient.post("/messages", payload);
  return response.data;
};