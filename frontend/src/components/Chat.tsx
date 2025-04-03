import React, { useState, useRef, useEffect } from 'react';
import '../styles/components/_chat.scss';

interface ChatMessage {
    type: 'my' | 'other' | 'system';
    text: string;
}

interface ChatProps {
    messages: ChatMessage[];
    onSendMessage: (message: string) => void;
}

const Chat: React.FC<ChatProps> = ({ messages, onSendMessage }) => {
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedMessage = newMessage.trim();
        if (trimmedMessage) {
            onSendMessage(trimmedMessage);
            setNewMessage('');
        }
    };

    return (
        <div className="chat">
            <h3>Chat</h3>
            <div className="message-list">
                {messages.map((msg, index) => (
                    <div key={index} className={`message ${msg.type}`}>
                        <p>{msg.text}</p>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            <form className="message-input" onSubmit={handleSubmit}>
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Say something..."
                    maxLength={100}
                />
                <button type="submit">Send</button>
            </form>
        </div>
    );
};

export default Chat;