import axiosClient from "./axiosClient";

export const getMyConversationsApi = async () => {
  const response = await axiosClient.get("/conversations");
  return response.data;
};

export const createPrivateConversationApi = async (targetUserId: number) => {
  const response = await axiosClient.post("/conversations/private", {
    targetUserId,
  });
  return response.data;
};

export const createGroupConversationApi = async (payload: {
  name: string;
  memberIds: number[];
}) => {
  const response = await axiosClient.post("/conversations/group", payload);
  return response.data;
};