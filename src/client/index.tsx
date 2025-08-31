import { createRoot } from "react-dom/client";
import { usePartySocket } from "partysocket/react";
import React, { useState, useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useParams,
} from "react-router";
import { nanoid } from "nanoid";

import { names, type ChatMessage, type Message } from "../shared";

function ThemeToggle() {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  return (
    <button 
      className="theme-toggle" 
      onClick={toggleTheme}
      title={isDark ? "切换到浅色模式" : "切换到深色模式"}
    >
      {isDark ? "☀️" : "🌙"}
    </button>
  );
}

function App() {
  const [name] = useState(names[Math.floor(Math.random() * names.length)]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const { room } = useParams();

  const socket = usePartySocket({
    party: "chat",
    room,
    onMessage: (evt) => {
      const message = JSON.parse(evt.data as string) as Message;
      if (message.type === "add") {
        const foundIndex = messages.findIndex((m) => m.id === message.id);
        const newMessage: ChatMessage = {
          id: message.id,
          content: message.content,
          user: message.user,
          role: message.role,
          type: message.messageType || "text",
          fileName: message.fileName,
          fileSize: message.fileSize,
          fileType: message.fileType,
          fileData: message.fileData,
        };
        
        if (foundIndex === -1) {
          // probably someone else who added a message
          setMessages((messages) => [...messages, newMessage]);
        } else {
          // this usually means we ourselves added a message
          // and it was broadcasted back
          // so let's replace the message with the new message
          setMessages((messages) => {
            return messages
              .slice(0, foundIndex)
              .concat(newMessage)
              .concat(messages.slice(foundIndex + 1));
          });
        }
      } else if (message.type === "update") {
        setMessages((messages) =>
          messages.map((m) =>
            m.id === message.id
              ? {
                  id: message.id,
                  content: message.content,
                  user: message.user,
                  role: message.role,
                  type: message.messageType || "text",
                  fileName: message.fileName,
                  fileSize: message.fileSize,
                  fileType: message.fileType,
                  fileData: message.fileData,
                }
              : m,
          ),
        );
      } else if (message.type === "all") {
        setMessages(message.messages || []);
      }
    },
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleSendMessage = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // 如果有选中的文件，发送文件
    if (selectedFile) {
      setIsUploading(true);
      
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const fileData = e.target?.result as string;
          const chatMessage: ChatMessage = {
            id: nanoid(8),
            content: `📎 ${selectedFile.name}`,
            user: name,
            role: "user",
            type: "file",
            fileName: selectedFile.name,
            fileSize: selectedFile.size,
            fileType: selectedFile.type,
            fileData: fileData.split(',')[1] // Remove data URL prefix
          };

          setMessages((messages) => [...messages, chatMessage]);
          socket.send(
            JSON.stringify({
              type: "add",
              ...chatMessage,
            } satisfies Message),
          );

          setSelectedFile(null);
          setInputValue('');
          setIsUploading(false);
        } catch (error) {
          console.error('File upload error:', error);
          setIsUploading(false);
        }
      };
      
      reader.onerror = () => {
        console.error('File read error');
        setIsUploading(false);
      };
      
      reader.readAsDataURL(selectedFile);
    } 
    // 如果有文本内容，发送文本
    else if (inputValue.trim()) {
      const chatMessage: ChatMessage = {
        id: nanoid(8),
        content: inputValue,
        user: name,
        role: "user",
        type: "text",
      };

      setMessages((messages) => [...messages, chatMessage]);
      socket.send(
        JSON.stringify({
          type: "add",
          ...chatMessage,
        } satisfies Message),
      );

      setInputValue('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const form = e.currentTarget.closest('form');
      if (form) {
        form.dispatchEvent(new Event('submit', { cancelable: true }));
      }
    }
  };

  return (
    <>
      <ThemeToggle />
      <div className="chat container">
        {messages.map((message) => (
          <div key={message.id} className="row message">
            <div className="two columns user">{message.user}</div>
            <div className="ten columns">
              {message.type === "file" ? (
                <div className="file-message">
                  <div className="file-icon">📎</div>
                  <div className="file-info">
                    <div className="file-name">{message.fileName}</div>
                    <div className="file-size">{formatFileSize(message.fileSize || 0)}</div>
                  </div>
                  {message.fileData && (
                    <a 
                      href={`data:${message.fileType};base64,${message.fileData}`} 
                      download={message.fileName}
                      className="file-download"
                    >
                      下载
                    </a>
                  )}
                </div>
              ) : (
                message.content
              )}
            </div>
          </div>
        ))}
        
        <form onSubmit={handleSendMessage} className="row">
          <input
            type="text"
            name="content"
            className="eight columns my-input-text"
            placeholder={selectedFile ? 
              `📎 ${selectedFile.name} (${formatFileSize(selectedFile.size)}) - 按Enter发送` : 
              `Hello ${name}! Type a message...`
            }
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            autoComplete="off"
            disabled={isUploading}
          />
          <button 
            type="submit" 
            className="two columns send-message"
            disabled={isUploading || (!inputValue.trim() && !selectedFile)}
          >
            {isUploading ? '...' : 'Send'}
          </button>
          <input
            type="file"
            id="file-input"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
            accept="image/*,.pdf,.txt,.doc,.docx"
          />
          <button
            type="button"
            className="two columns send-message"
            onClick={() => document.getElementById('file-input')?.click()}
            disabled={isUploading}
          >
            📎
          </button>
        </form>
      </div>
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Navigate to={`/${nanoid()}`} />} />
      <Route path="/:room" element={<App />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  </BrowserRouter>,
);
