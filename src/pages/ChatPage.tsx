import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getUsersApi } from "../api/userApi";
import {
  createGroupConversationApi,
  createPrivateConversationApi,
  getMyConversationsApi,
} from "../api/conversationApi";
import { getMessagesByConversationApi } from "../api/messageApi";
import {
  getMyNotificationsApi,
  markNotificationAsReadApi,
} from "../api/notificationApi";
import type {
  Conversation,
  Message,
  NotificationItem,
  User,
} from "../types/chat";
import { connectSocket, disconnectSocket, getSocket } from "../socket";

type PrivateConversationMap = Record<number, User>;

const ChatPage = () => {
  const navigate = useNavigate();
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const notificationRef = useRef<HTMLDivElement | null>(null);
  const notificationButtonRef = useRef<HTMLButtonElement | null>(null);

  const currentUser = useMemo(() => {
    const raw = localStorage.getItem("currentUser");
    return raw ? JSON.parse(raw) : null;
  }, []);

  const [users, setUsers] = useState<User[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationPosition, setNotificationPosition] = useState({
    top: 0,
    left: 0,
  });

  const [messageInput, setMessageInput] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);

  const [privateConversationMap, setPrivateConversationMap] =
    useState<PrivateConversationMap>({});

  const unreadCount = notifications.filter((item) => !item.is_read).length;

  const handleLogout = () => {
    disconnectSocket();
    localStorage.removeItem("accessToken");
    localStorage.removeItem("currentUser");
    navigate("/login");
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  const handleToggleNotifications = () => {
    if (!showNotifications && notificationButtonRef.current) {
      const rect = notificationButtonRef.current.getBoundingClientRect();

      const panelWidth = 360;
      const gap = 8;

      let left = rect.right - panelWidth;
      const top = rect.bottom + gap;

      if (left < 12) left = 12;
      if (left + panelWidth > window.innerWidth - 12) {
        left = window.innerWidth - panelWidth - 12;
      }

      setNotificationPosition({
        top,
        left,
      });
    }

    setShowNotifications((prev) => !prev);
  };

  const getConversationDisplayName = (conversation: Conversation) => {
    if (conversation.type === "group") {
      return conversation.name || `Nhóm chat #${conversation.id}`;
    }

    const mappedUser = privateConversationMap[conversation.id];
    if (mappedUser) {
      return mappedUser.username;
    }

    return `Chat riêng #${conversation.id}`;
  };

  const getConversationSubText = (conversation: Conversation) => {
    if (conversation.type === "group") {
      return conversation.last_message || "Chưa có tin nhắn";
    }

    const mappedUser = privateConversationMap[conversation.id];
    if (mappedUser) {
      return mappedUser.email;
    }

    return conversation.last_message || "Chưa có tin nhắn";
  };

  const getConversationHeaderTitle = (conversation: Conversation | null) => {
    if (!conversation) return "Chọn một cuộc trò chuyện";
    return getConversationDisplayName(conversation);
  };

  const loadUsers = async () => {
    try {
      setLoadingUsers(true);
      const response = await getUsersApi();
      setUsers(response?.data || []);
    } catch (error) {
      console.error("Load users error:", error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadConversations = async () => {
    try {
      setLoadingConversations(true);
      const response = await getMyConversationsApi();
      setConversations(response?.data || []);
    } catch (error) {
      console.error("Load conversations error:", error);
    } finally {
      setLoadingConversations(false);
    }
  };

  const loadMessages = async (conversationId: number) => {
    try {
      setLoadingMessages(true);
      const response = await getMessagesByConversationApi(conversationId);
      setMessages(response?.data || []);
      scrollToBottom();
    } catch (error) {
      console.error("Load messages error:", error);
    } finally {
      setLoadingMessages(false);
    }
  };

  const loadNotifications = async () => {
    try {
      const response = await getMyNotificationsApi();
      setNotifications(response?.data || []);
    } catch (error) {
      console.error("Load notifications error:", error);
    }
  };

  const handleCreatePrivateConversation = async (targetUserId: number) => {
    try {
      const response = await createPrivateConversationApi(targetUserId);
      const conversation = response?.data;
      const targetUser = users.find((user) => user.id === targetUserId);

      await loadConversations();

      if (conversation && targetUser) {
        setPrivateConversationMap((prev) => ({
          ...prev,
          [conversation.id]: targetUser,
        }));
      }

      if (conversation) {
        setSelectedConversation(conversation);
        await loadMessages(conversation.id);

        const socket = getSocket();
        socket?.emit("join_conversation", conversation.id);
      }
    } catch (error) {
      console.error("Create private conversation error:", error);
    }
  };

  const handleSelectConversation = async (conversation: Conversation) => {
    const socket = getSocket();

    if (selectedConversation?.id) {
      socket?.emit("leave_conversation", selectedConversation.id);
    }

    setSelectedConversation(conversation);
    await loadMessages(conversation.id);
    socket?.emit("join_conversation", conversation.id);
  };

  const handleSendMessage = async () => {
    if (!selectedConversation || !messageInput.trim() || !currentUser) return;

    try {
      setSendingMessage(true);

      const socket = getSocket();

      socket?.emit("send_message", {
        conversationId: selectedConversation.id,
        senderId: currentUser.id,
        content: messageInput.trim(),
      });

      setMessageInput("");
    } catch (error) {
      console.error("Send message error:", error);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleToggleMember = (userId: number) => {
    setSelectedMemberIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const resetGroupForm = () => {
    setGroupName("");
    setSelectedMemberIds([]);
    setShowCreateGroupModal(false);
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      alert("Vui lòng nhập tên nhóm");
      return;
    }

    if (selectedMemberIds.length === 0) {
      alert("Vui lòng chọn ít nhất 1 thành viên");
      return;
    }

    try {
      setCreatingGroup(true);

      const response = await createGroupConversationApi({
        name: groupName.trim(),
        memberIds: selectedMemberIds,
      });

      const conversation = response?.data;

      await loadConversations();

      if (conversation) {
        const socket = getSocket();

        if (selectedConversation?.id) {
          socket?.emit("leave_conversation", selectedConversation.id);
        }

        setSelectedConversation(conversation);
        await loadMessages(conversation.id);
        socket?.emit("join_conversation", conversation.id);
      }

      resetGroupForm();
    } catch (error: any) {
      console.error("Create group error:", error);
      alert(error?.response?.data?.message || "Tạo nhóm thất bại");
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleOpenNotification = async (notification: NotificationItem) => {
    try {
      if (!notification.is_read) {
        await markNotificationAsReadApi(notification.id);

        setNotifications((prev) =>
          prev.map((item) =>
            item.id === notification.id ? { ...item, is_read: true } : item,
          ),
        );
      }

      if (notification.related_conversation_id) {
        const latestConversationsResponse = await getMyConversationsApi();
        const latestConversations = latestConversationsResponse?.data || [];

        setConversations(latestConversations);

        const targetConversation = latestConversations.find(
          (c: Conversation) => c.id === notification.related_conversation_id,
        );

        if (targetConversation) {
          await handleSelectConversation(targetConversation);
        }
      }

      setShowNotifications(false);
    } catch (error) {
      console.error("Open notification error:", error);
    }
  };

  useEffect(() => {
    loadUsers();
    loadConversations();
    loadNotifications();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      const clickedInsidePanel =
        notificationRef.current && notificationRef.current.contains(target);

      const clickedButton =
        notificationButtonRef.current &&
        notificationButtonRef.current.contains(target);

      if (!clickedInsidePanel && !clickedButton) {
        setShowNotifications(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (showNotifications && notificationButtonRef.current) {
        const rect = notificationButtonRef.current.getBoundingClientRect();

        const panelWidth = 360;
        const gap = 8;

        let left = rect.right - panelWidth;
        const top = rect.bottom + gap;

        if (left < 12) left = 12;
        if (left + panelWidth > window.innerWidth - 12) {
          left = window.innerWidth - panelWidth - 12;
        }

        setNotificationPosition({ top, left });
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [showNotifications]);

  useEffect(() => {
    if (!currentUser) return;

    const socket = connectSocket();

    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
      socket.emit("join_user_room", currentUser.id);
    });

    socket.on("receive_message", (message: Message) => {
      if (
        selectedConversation &&
        message.conversation_id === selectedConversation.id
      ) {
        setMessages((prev) => {
          const exists = prev.some((item) => item.id === message.id);
          if (exists) return prev;
          return [...prev, message];
        });
      }

      loadConversations();
      scrollToBottom();
    });

    socket.on("new_notification", (notification: NotificationItem) => {
      setNotifications((prev) => [notification, ...prev]);
      loadConversations();
    });

    socket.on("conversation_added", async () => {
      await loadConversations();
    });

    socket.on("message_error", (error) => {
      console.error("Socket message error:", error);
      alert(error?.message || "Gửi tin nhắn thất bại");
    });

    return () => {
      socket.off("connect");
      socket.off("receive_message");
      socket.off("new_notification");
      socket.off("conversation_added");
      socket.off("message_error");
    };
  }, [currentUser, selectedConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-slate-100 via-sky-50 to-indigo-100">
      <div className="flex h-full">
        <aside className="flex w-80 flex-col border-r border-white/40 bg-white/80 backdrop-blur-xl">
          <div className="border-b border-slate-200/70 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 p-4 text-white">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-xl font-bold tracking-tight">Chat App</h2>
                <p className="truncate text-sm text-blue-100">
                  {currentUser?.username || "User"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  ref={notificationButtonRef}
                  onClick={handleToggleNotifications}
                  className="relative rounded-xl bg-white/20 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/30"
                >
                  Chuông
                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-xs text-white shadow">
                      {unreadCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={handleLogout}
                  className="rounded-xl bg-rose-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-rose-600"
                >
                  Thoát
                </button>
              </div>
            </div>
          </div>

          <div className="border-b border-slate-200/70 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                Người dùng
              </h3>
              <button
                onClick={() => setShowCreateGroupModal(true)}
                className="rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:opacity-90"
              >
                + Tạo nhóm
              </button>
            </div>

            <div className="space-y-2">
              {loadingUsers ? (
                <p className="text-sm text-slate-500">Đang tải user...</p>
              ) : users.length === 0 ? (
                <p className="text-sm text-slate-500">Không có user nào</p>
              ) : (
                users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleCreatePrivateConversation(user.id)}
                    className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-800">
                        {user.username}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {user.email}
                      </p>
                    </div>

                    <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                      Chat
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">
              Cuộc trò chuyện
            </h3>

            <div className="space-y-3">
              {loadingConversations ? (
                <p className="text-sm text-slate-500">
                  Đang tải conversation...
                </p>
              ) : conversations.length === 0 ? (
                <p className="text-sm text-slate-500">Chưa có conversation</p>
              ) : (
                conversations.map((conversation) => {
                  const isActive = selectedConversation?.id === conversation.id;

                  return (
                    <button
                      key={conversation.id}
                      onClick={() => handleSelectConversation(conversation)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left shadow-sm transition ${
                        isActive
                          ? "border-blue-500 bg-gradient-to-r from-blue-50 to-indigo-50 ring-2 ring-blue-100"
                          : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-blue-300 hover:bg-slate-50"
                      }`}
                    >
                      <p className="truncate font-semibold text-slate-800">
                        {getConversationDisplayName(conversation)}
                      </p>
                      <p className="mt-1 truncate text-sm text-slate-500">
                        {getConversationSubText(conversation)}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </aside>

        <main className="relative flex flex-1 flex-col">
          <div className="border-b border-white/50 bg-white/70 px-6 py-4 backdrop-blur-xl">
            <h2 className="text-xl font-bold text-slate-800">
              {getConversationHeaderTitle(selectedConversation)}
            </h2>

            {selectedConversation?.type === "private" &&
              privateConversationMap[selectedConversation.id] && (
                <p className="mt-1 text-sm text-slate-500">
                  {privateConversationMap[selectedConversation.id].email}
                </p>
              )}
          </div>

          <div className="flex-1 overflow-y-auto bg-transparent p-6">
            {!selectedConversation ? (
              <div className="flex h-full items-center justify-center">
                <div className="rounded-3xl border border-white/60 bg-white/70 px-10 py-12 text-center shadow-lg backdrop-blur">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-violet-500 text-2xl text-white shadow-md">
                    💬
                  </div>
                  <h3 className="text-xl font-bold text-slate-800">
                    Chọn một cuộc trò chuyện
                  </h3>
                  <p className="mt-2 text-sm text-slate-500">
                    Bắt đầu nhắn tin với bạn bè hoặc tạo nhóm chat mới
                  </p>
                </div>
              </div>
            ) : loadingMessages ? (
              <div className="text-slate-500">Đang tải tin nhắn...</div>
            ) : messages.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="rounded-3xl border border-white/60 bg-white/70 px-8 py-10 text-center shadow-lg backdrop-blur">
                  <div className="mx-auto mb-4 text-4xl">✨</div>
                  <p className="font-semibold text-slate-700">
                    Chưa có tin nhắn nào
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Hãy gửi tin nhắn đầu tiên để bắt đầu cuộc trò chuyện
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => {
                  const isMine = message.sender_id === currentUser?.id;

                  return (
                    <div
                      key={message.id}
                      className={`flex ${
                        isMine ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-md rounded-3xl px-4 py-3 shadow-md ${
                          isMine
                            ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
                            : "border border-white/60 bg-white/80 text-slate-800 backdrop-blur"
                        }`}
                      >
                        {!isMine && (
                          <p className="mb-1 text-xs font-semibold text-blue-600">
                            {message.sender_username}
                          </p>
                        )}
                        <p className="break-words text-sm leading-6">
                          {message.content}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {selectedConversation && (
            <div className="border-t border-white/50 bg-white/70 p-4 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Nhập tin nhắn..."
                  className="flex-1 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSendMessage();
                    }
                  }}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={sendingMessage}
                  className="rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-70"
                >
                  {sendingMessage ? "Đang gửi..." : "Gửi"}
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {showNotifications && (
        <div
          ref={notificationRef}
          className="fixed z-[9999] max-h-96 w-[360px] overflow-y-auto rounded-3xl border border-white/50 bg-white/95 shadow-2xl backdrop-blur-xl"
          style={{
            top: notificationPosition.top,
            left: notificationPosition.left,
          }}
        >
          <div className="sticky top-0 rounded-t-3xl border-b border-slate-200 bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-3 text-white">
            <h3 className="font-semibold">Thông báo</h3>
          </div>

          <div className="p-3">
            {notifications.length === 0 ? (
              <p className="px-3 py-4 text-sm text-slate-500">
                Chưa có thông báo
              </p>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleOpenNotification(notification)}
                  className={`mb-2 w-full rounded-2xl px-4 py-3 text-left transition ${
                    notification.is_read
                      ? "bg-slate-50 hover:bg-slate-100"
                      : "bg-gradient-to-r from-blue-50 to-violet-50 hover:from-blue-100 hover:to-violet-100"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800">
                        {notification.title}
                      </p>
                      <p className="mt-1 break-words text-sm text-slate-600">
                        {notification.content}
                      </p>
                    </div>

                    {!notification.is_read && (
                      <span className="mt-1 h-2.5 w-2.5 rounded-full bg-blue-500" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {showCreateGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-white/40 bg-white/95 p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-800">
                Tạo nhóm chat
              </h3>
              <button
                onClick={resetGroupForm}
                className="rounded-xl bg-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-300"
              >
                Đóng
              </button>
            </div>

            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Tên nhóm
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Nhập tên nhóm"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Chọn thành viên
              </label>

              <div className="max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-3">
                {users.map((user) => {
                  const checked = selectedMemberIds.includes(user.id);

                  return (
                    <label
                      key={user.id}
                      className="flex cursor-pointer items-center gap-3 rounded-xl bg-white px-3 py-3 shadow-sm transition hover:bg-blue-50"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggleMember(user.id)}
                        className="h-4 w-4"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-800">
                          {user.username}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {user.email}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={resetGroupForm}
                className="rounded-2xl bg-slate-200 px-4 py-3 font-medium text-slate-700 hover:bg-slate-300"
              >
                Hủy
              </button>
              <button
                onClick={handleCreateGroup}
                disabled={creatingGroup}
                className="rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-3 font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-70"
              >
                {creatingGroup ? "Đang tạo..." : "Tạo nhóm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatPage;
