import React, { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';
import { timeAgo } from '@/lib/format';

export default function OrderChat({ orderId, currentRole, recipientRole }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [user, setUser] = useState(null);
  const endRef = useRef(null);

  const load = async () => {
    const list = await base44.entities.ChatMessage.filter({ order_id: orderId }, 'created_date');
    setMessages(list);
  };

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    load();
    const unsub = base44.entities.ChatMessage.subscribe((evt) => {
      if (evt.data?.order_id === orderId) load();
    });
    return () => unsub && unsub();
  }, [orderId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!text.trim() || !user) return;
    await base44.entities.ChatMessage.create({
      order_id: orderId,
      sender_email: user.email,
      sender_role: currentRole,
      recipient_role: recipientRole,
      message: text.trim(),
    });
    setText('');
    load();
  };

  return (
    <div className="bg-card border border-border rounded-2xl flex flex-col h-80">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="font-medium text-sm">Chat with {recipientRole}</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-8">No messages yet. Say hi 👋</p>
        )}
        {messages.map((m) => {
          const mine = m.sender_email === user?.email;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                mine ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'
              }`}>
                <p>{m.message}</p>
                <p className={`text-[10px] mt-0.5 ${mine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                  {timeAgo(m.created_date)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="p-3 border-t border-border flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message" onKeyDown={(e) => e.key === 'Enter' && send()} />
        <Button onClick={send} size="icon"><Send className="w-4 h-4" /></Button>
      </div>
    </div>
  );
}