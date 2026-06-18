import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { sendNotification } from '../utils/notifications';
import type { Message, Conversation, User } from '../types/lms';

type SupabaseProfileJoin = { id: string; name: string } | null;

type SupabaseMessageRow = {
  id: number;
  content: string;
  read_at: string | null;
  created_at: string;
  sender: SupabaseProfileJoin;
  recipient: SupabaseProfileJoin;
};

export function useMessages(currentUser: User, users: User[]) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!currentUser.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          id, content, read_at, created_at,
          sender:profiles!sender_id (id, name),
          recipient:profiles!recipient_id (id, name)
        `)
        .or(`sender_id.eq.${currentUser.id},recipient_id.eq.${currentUser.id}`)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setError(null);
      setMessages(((data ?? []) as unknown as SupabaseMessageRow[]).map(row => ({
        id: row.id,
        senderId: row.sender?.id ?? '',
        senderName: row.sender?.name ?? '',
        recipientId: row.recipient?.id ?? '',
        recipientName: row.recipient?.name ?? '',
        content: row.content,
        readAt: row.read_at,
        createdAt: row.created_at,
      })));
    } catch (err) {
      setError('Failed to load messages');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [currentUser.id]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  // Build conversations from flat messages list
  const conversations: Conversation[] = (() => {
    const convMap = new Map<string, Conversation>();

    for (const msg of messages) {
      const otherUserId = msg.senderId === currentUser.id
        ? msg.recipientId
        : msg.senderId;
      const otherUserName = msg.senderId === currentUser.id
        ? msg.recipientName
        : msg.senderName;

      const otherUser = users.find(u => u.id === otherUserId);

      if (!convMap.has(otherUserId)) {
        convMap.set(otherUserId, {
          otherUserId,
          otherUserName,
          otherUserRoles: otherUser?.roles ?? [],
          lastMessage: msg.content,
          lastMessageAt: msg.createdAt,
          lastMessageSenderId: msg.senderId,
          unreadCount: 0,
          messages: [],
        });
      }

      const conv = convMap.get(otherUserId)!;
      conv.messages.push(msg);
      conv.lastMessage = msg.content;
      conv.lastMessageAt = msg.createdAt;
      conv.lastMessageSenderId = msg.senderId;

      // Count unread messages sent TO the current user
      if (
        msg.recipientId === currentUser.id &&
        msg.readAt === null
      ) {
        conv.unreadCount++;
      }
    }

    // Sort conversations by most recent message
    return Array.from(convMap.values()).sort(
      (a, b) =>
        new Date(b.lastMessageAt).getTime() -
        new Date(a.lastMessageAt).getTime()
    );
  })();

  const totalUnread = conversations.reduce(
    (sum, c) => sum + c.unreadCount, 0
  );

  const sendMessage = async (
    recipientId: string,
    content: string
  ): Promise<void> => {
    if (!content.trim()) return;
    setSending(true);
    setError(null);
    try {
      const { error } = await supabase.from('messages').insert({
        sender_id: currentUser.id,
        recipient_id: recipientId,
        content: content.trim(),
      });
      if (error) throw error;

      // Send email notification
      const recipient = users.find(u => u.id === recipientId);
      if (
        recipient &&
        recipient.notificationPreferences?.messages !== false
      ) {
        sendNotification('direct_message', {
          recipientId,
          recipientEmail: recipient.email,
          recipientName: recipient.name,
          senderName: currentUser.name,
          preview: content.trim().slice(0, 100) +
            (content.length > 100 ? '...' : ''),
        }).catch(console.error);
      }

      await fetchMessages();
    } catch (err) {
      setError('Failed to send message');
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const markConversationAsRead = async (
    otherUserId: string
  ): Promise<void> => {
    const { error } = await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('sender_id', otherUserId)
      .eq('recipient_id', currentUser.id)
      .is('read_at', null);

    if (error) {
      console.error('Failed to mark as read:', error);
      return;
    }
    await fetchMessages();
  };

  const deleteMessage = async (messageId: number): Promise<void> => {
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId);
    if (error) { setError('Failed to delete message'); return; }
    await fetchMessages();
  };

  return {
    messages,
    conversations,
    totalUnread,
    loading,
    sending,
    error,
    sendMessage,
    markConversationAsRead,
    deleteMessage,
    refetch: fetchMessages,
  };
}
