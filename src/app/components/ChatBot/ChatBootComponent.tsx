"use client";
import React, { useState, useRef, useEffect } from 'react';
import { FaComment, FaMinus } from 'react-icons/fa';
import { GoogleGenerativeAI, GenerateContentResult } from '@google/generative-ai';
import styles from './ChatBotComponent.module.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// --- Interfaces ---
interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface InitialPromptMessage {
  text: string;
}

// --- Componente ---
export default function ChatBotComponent() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [initialPrompt, setInitialPrompt] = useState<InitialPromptMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // --- Inicialización del SDK de Gemini ---
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY as string;
  let genAI: GoogleGenerativeAI | null = null;
  let geminiModel: any = null;
  try {
    if (apiKey) {
      genAI = new GoogleGenerativeAI(apiKey);
      geminiModel = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });
    }
  } catch (error) {
    console.error("Error initializing Gemini SDK:", error);
  }

  const generationConfig = {
    temperature: 0.1,
    topP: 0.95,
    topK: 64,
    maxOutputTokens: 2048,
  };

  // --- Load agent context on mount ---
  useEffect(() => {
    const loadContext = async () => {
      try {
        const response = await fetch('/api/agent-context');
        const data = await response.json();
        if (data.systemInstruction) {
          setInitialPrompt([{ text: data.systemInstruction }]);
          console.log("Contexto del agente cargado correctamente.");
        }
      } catch (error) {
        console.error('Error al cargar contexto:', error);
        try {
          const res = await fetch('/system_prompt.json');
          const data = await res.json();
          setInitialPrompt(data);
        } catch { }
      }
    };

    loadContext();
  }, []);

  // --- Textarea auto-resize ---
  useEffect(() => {
    const inputField = document.querySelector(`.${styles.inputField}`) as HTMLElement;
    if (inputField) {
      inputField.style.height = 'auto';
      inputField.style.height = `${Math.min(inputField.scrollHeight, 150)}px`;
    }
  }, [userInput]);

  // --- Scroll to bottom ---
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleOpenChat = () => setIsOpen(!isOpen);

  // --- Send Message ---
  const handleSendMessage = async () => {
    if (userInput.trim() === '' || isLoading) return;
    if (initialPrompt.length === 0) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Iniciando sistema...' }]);
      return;
    }

    const newUserMessage: Message = { role: 'user', content: userInput };
    const currentMessages = [...messages, newUserMessage];
    setMessages(currentMessages);
    setUserInput('');
    setIsLoading(true);
    setMessages(prev => [...prev, { role: 'assistant', content: '...' }]);

    try {
      const systemInstruction = initialPrompt[0].text;

      // --- GEMINI API ---
      console.log("Using Gemini API");
      if (!geminiModel) throw new Error("No Gemini model available.");

      const historyForPrompt = currentMessages.map(msg =>
        `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
      ).join('\n');

      const result: GenerateContentResult = await geminiModel.generateContent({
        contents: [{ role: "user", parts: [{ text: historyForPrompt }] }],
        generationConfig,
        systemInstruction: systemInstruction
      });

      const assistantResponse = result.response.text();

      setMessages(prev => {
        const updatedMessages = [...prev];
        const lastMsgIndex = updatedMessages.length - 1;
        if (updatedMessages[lastMsgIndex].content === '...') {
          updatedMessages[lastMsgIndex] = { role: 'assistant', content: assistantResponse || 'No response.' };
        }

        fetch('/api/log-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: updatedMessages, timestamp: new Date().toISOString() })
        }).catch(err => console.error("Error logging:", err));

        return updatedMessages;
      });

    } catch (error: any) {
      console.error('Error:', error);
      setMessages(prev => {
        const updated = [...prev];
        if (updated[updated.length - 1].content === '...') {
          updated[updated.length - 1].content = `Error: ${error.message}`;
        }
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.chatBotWrapper}>
      <button className={`${styles.chatBotToggle} ${isOpen ? styles.dNone : ''}`} onClick={handleOpenChat}>
        <FaComment />
      </button>

      <div className={`${styles.chatBotContainer} ${isOpen ? styles.show : ''}`}>
        <div className={styles.cardBorder}>
          <div className={styles.cardHeader}>
            <div className="flex flex-col">
              <h5 className={styles.cardHeaderText}>Chat with CyberStack</h5>
              <span className="text-[10px] text-gray-400 opacity-80">
                ☁️ Powered by Gemini
              </span>
            </div>
            <button className={`${styles.minimizeBtn} ${styles.noMargin}`} onClick={handleOpenChat}>
              <FaMinus />
            </button>
          </div>

          <div className={styles.chatMessages} ref={chatContainerRef}>
            {messages.map((msg, index) => (
              <div key={index} className={`${styles.message} ${msg.role === 'user' ? styles.messageUser : styles.messageAssistant}`}>
                <div className={`${styles.messageAlert} ${msg.role === 'user' ? styles.messageUserAlert : styles.messageAssistantAlert}`}>
                  <strong className={styles.messageSender}>{msg.role === 'user' ? 'Tú' : 'CyberStack'}: </strong>
                  {msg.content === '...' ? (
                    <span className="animate-pulse">...</span>
                  ) : (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className={styles.cardFooter}>
            <div className={styles.inputGroup}>
              <textarea
                className={styles.inputField}
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Escribe tu mensaje..."
                rows={1}
                disabled={isLoading}
              />
              <button
                className={styles.buttonSend}
                onClick={handleSendMessage}
                disabled={isLoading}
              >
                {isLoading ? '...' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}