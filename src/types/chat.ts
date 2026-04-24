export interface User {
  id: number;
  username: string;
  email: string;
  avatar_url: string | null;
  is_online: boolean;
  created_at: string;
}

export interface Conversation {
  id: number;
  type: "private" | "group";
  name: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
  last_message: string | null;
  last_message_time: string | null;
}

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  sender_username: string;
  sender_email: string;
  sender_avatar_url: string | null;
  content: string;
  message_type: string;
  created_at: string;
  updated_at: string;
}

export interface NotificationItem {
  id: number;
  user_id: number;
  type: "new_message" | "added_to_group" | "system";
  title: string;
  content: string;
  related_conversation_id: number | null;
  is_read: boolean;
  created_at: string;
}