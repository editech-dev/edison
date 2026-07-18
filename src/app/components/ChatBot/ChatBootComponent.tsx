"use client";
import React, { useState, useRef, useEffect } from 'react';
import { FaComment, FaMinus, FaCloud, FaMicrochip } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
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

export default function ChatBotComponent() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [initialPrompt, setInitialPrompt] = useState<InitialPromptMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // --- Local AI State & Session References ---
  const [isLocalSupported, setIsLocalSupported] = useState(false);
  const [activeModel, setActiveModel] = useState<'cloud' | 'local'>('cloud');
  const localSessionRef = useRef<any>(null);

  // --- Load agent context on mount ---
  useEffect(() => {
    const loadContext = async () => {
      try {
        const response = await fetch('/api/agent-context');
        const data = await response.json();
        if (data.systemInstruction) {
          setInitialPrompt([{ text: data.systemInstruction }]);
          console.log("Agent context loaded successfully.");
        }
      } catch (error) {
        console.error('Error loading context:', error);
        try {
          const res = await fetch('/system_prompt.json');
          const data = await res.json();
          setInitialPrompt(data);
        } catch { }
      }
    };

    loadContext();
  }, []);

  // --- Check for Local Gemini Nano support on mount ---
  useEffect(() => {
    const checkLocalAI = async () => {
      try {
        const ai = typeof window !== 'undefined' ? (window as any).ai : undefined;
        if (ai?.languageModel) {
          const capabilities = await ai.languageModel.capabilities();
          if (capabilities && capabilities.available !== 'no') {
            setIsLocalSupported(true);
          }
        }
      } catch (error) {
        console.warn("Chrome Local AI check failed or unsupported:", error);
      }
    };
    checkLocalAI();
  }, []);

  // --- Manage local AI session lifecycle ---
  useEffect(() => {
    const initSession = async () => {
      const ai = typeof window !== 'undefined' ? (window as any).ai : undefined;
      if (activeModel === 'local' && initialPrompt.length > 0 && ai?.languageModel) {
        try {
          if (localSessionRef.current) {
            localSessionRef.current.destroy();
            localSessionRef.current = null;
          }
          const systemInstruction = initialPrompt[0].text;
          const session = await ai.languageModel.create({
            systemPrompt: systemInstruction
          });
          localSessionRef.current = session;
        } catch (error) {
          console.error("Failed to initialize local AI session:", error);
          setActiveModel('cloud');
        }
      }
    };

    if (activeModel === 'local') {
      initSession();
    } else {
      if (localSessionRef.current) {
        try {
          localSessionRef.current.destroy();
        } catch (e) {
          console.error("Error destroying session:", e);
        }
        localSessionRef.current = null;
      }
    }

    return () => {
      if (localSessionRef.current) {
        try {
          localSessionRef.current.destroy();
        } catch (e) {
          console.error("Error destroying session on unmount:", e);
        }
        localSessionRef.current = null;
      }
    };
  }, [activeModel, initialPrompt]);

  // --- Textarea auto-resize ---
  useEffect(() => {
    const inputField = textareaRef.current;
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

  // --- Auto focus textarea on open ---
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  const handleOpenChat = () => setIsOpen(!isOpen);

  // --- Send Message ---
  const handleSendMessage = async () => {
    if (userInput.trim() === '' || isLoading) return;
    if (initialPrompt.length === 0) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Initializing system...' }]);
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
      let assistantResponse = '';

      if (activeModel === 'local') {
        const ai = typeof window !== 'undefined' ? (window as any).ai : undefined;
        if (!localSessionRef.current) {
          if (ai?.languageModel) {
            const session = await ai.languageModel.create({
              systemPrompt: systemInstruction
            });
            localSessionRef.current = session;
          } else {
            throw new Error("Local AI (Gemini Nano) is not supported in this browser.");
          }
        }
        assistantResponse = await localSessionRef.current.prompt(newUserMessage.content);
      } else {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
             messages: currentMessages,
             systemInstruction: systemInstruction
          })
        });

        if (!response.ok) {
           const errData = await response.json();
           throw new Error(errData.error || `Server error: ${response.status}`);
        }

        const data = await response.json();
        assistantResponse = data.response;
      }

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
      console.error('Chat Error:', error);
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
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Toggle button */}
      <button
        onClick={handleOpenChat}
        className={`w-14 h-14 rounded-full bg-zinc-950 border border-green-500/40 text-green-400 flex items-center justify-center shadow-[0_0_15px_rgba(34,197,94,0.2)] hover:shadow-[0_0_20px_rgba(34,197,94,0.4)] hover:text-green-300 transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-400 focus-visible:ring-offset-black cursor-pointer ${
          isOpen ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100'
        }`}
        aria-label="Open chat assistant"
        aria-expanded={isOpen}
        aria-controls="chat-assistant-container"
      >
        <FaComment className="w-6 h-6" aria-hidden="true" />
      </button>

      {/* Chat window container */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="chat-assistant-container"
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            role="dialog"
            aria-label="Chat assistant"
            className={`w-[360px] md:w-[400px] h-[500px] rounded-2xl border bg-zinc-950/90 backdrop-blur-md overflow-hidden flex flex-col transition-all duration-300 ${
              activeModel === 'local'
                ? 'border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.18)]'
                : 'border-green-500/30 shadow-[0_0_30px_rgba(34,197,94,0.18)]'
            }`}
          >
            {/* Header */}
            <div className="flex flex-col border-b border-zinc-800/80 bg-zinc-900/40 p-4 gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {/* Glowing active model status indicator */}
                  <span className="relative flex h-2 w-2">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      activeModel === 'local' ? 'bg-emerald-400' : 'bg-green-400'
                    }`}></span>
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${
                      activeModel === 'local' ? 'bg-emerald-500' : 'bg-green-500'
                    }`}></span>
                  </span>
                  <h5 className="font-semibold text-green-400 text-sm tracking-wide">CyberStack Assistant</h5>
                </div>
                
                <button
                  onClick={handleOpenChat}
                  className="text-zinc-400 hover:text-green-400 transition-colors p-1.5 rounded-full hover:bg-zinc-800/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400 cursor-pointer"
                  aria-label="Minimize chat assistant"
                >
                  <FaMinus className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>

              {/* Model selection toggle or active model badge */}
              <div className="flex justify-start">
                {isLocalSupported ? (
                  <div 
                    className="flex bg-zinc-950/60 p-0.5 rounded-lg border border-zinc-850 text-[11px] relative w-full" 
                    role="radiogroup" 
                    aria-label="Model selection"
                  >
                    <button
                      onClick={() => setActiveModel('cloud')}
                      role="radio"
                      aria-checked={activeModel === 'cloud'}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md font-medium transition-colors z-10 relative focus:outline-none focus-visible:ring-1 focus-visible:ring-green-400 cursor-pointer ${
                        activeModel === 'cloud' ? 'text-green-400 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <FaCloud className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Cloud (Gemini 3.5 Flash)</span>
                    </button>
                    <button
                      onClick={() => setActiveModel('local')}
                      role="radio"
                      aria-checked={activeModel === 'local'}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md font-medium transition-colors z-10 relative focus:outline-none focus-visible:ring-1 focus-visible:ring-green-400 cursor-pointer ${
                        activeModel === 'local' ? 'text-green-400 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <FaMicrochip className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Local (Gemini Nano)</span>
                    </button>
                    {/* Sliding background highlight */}
                    <motion.div
                      className="absolute top-[2px] bottom-[2px] rounded-md bg-green-500/10 border border-green-500/25 shadow-[0_0_8px_rgba(34,197,94,0.1)]"
                      layoutId="activeModelIndicator"
                      transition={{ type: "spring", stiffness: 350, damping: 30 }}
                      style={{
                        width: 'calc(50% - 3px)',
                        left: activeModel === 'cloud' ? '2px' : 'calc(50% + 1px)',
                      }}
                    />
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900/60 border border-zinc-800 text-[11px] text-zinc-400">
                    <FaCloud className="w-3 h-3 text-zinc-500" aria-hidden="true" />
                    <span>Gemini 3.5 Flash (Cloud)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Message Stream */}
            <div
              ref={chatContainerRef}
              role="log"
              aria-live="polite"
              className="flex-grow p-4 overflow-y-auto space-y-4 scrollbar-thin scrollbar-thumb-zinc-800/80 hover:scrollbar-thumb-green-500/30 scrollbar-track-transparent"
            >
              {messages.length === 0 && (
                <div className="text-zinc-500 text-xs italic text-center mt-8">
                  Ask me anything about Edison's background, projects, or expertise.
                </div>
              )}
              {messages.map((msg, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg p-3 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-green-950/30 border border-green-500/20 text-green-300 shadow-[0_2px_8px_rgba(34,197,94,0.05)]'
                        : 'bg-zinc-900/60 border border-zinc-800/60 text-zinc-200 shadow-[0_2px_8px_rgba(0,0,0,0.2)]'
                    }`}
                  >
                    <strong className="block text-[10px] uppercase tracking-wider mb-1 opacity-70">
                      {msg.role === 'user' ? 'You' : 'CyberStack'}
                    </strong>
                    {msg.content === '...' ? (
                      <span className="animate-pulse flex space-x-1 items-center">
                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                    ) : (
                      <div className="prose prose-invert prose-xs max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Input Footer */}
            <div className="p-3 border-t border-zinc-800/80 bg-zinc-900/20">
              <div className="flex gap-2 items-end bg-zinc-900/40 border border-zinc-800/80 rounded-xl px-3 py-2 focus-within:border-green-500/50 focus-within:ring-1 focus-within:ring-green-500/20 transition-all duration-300">
                <textarea
                  ref={textareaRef}
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Type your message..."
                  aria-label="Type your message"
                  rows={1}
                  disabled={isLoading}
                  className="flex-grow bg-transparent text-sm text-zinc-100 outline-none resize-none max-h-32 min-h-[20px] placeholder-zinc-650 scrollbar-none py-0.5 focus:outline-none"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={isLoading || userInput.trim() === ''}
                  className="px-3.5 py-1.5 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-semibold hover:bg-green-500/20 hover:text-green-300 disabled:opacity-30 disabled:hover:bg-green-500/10 disabled:hover:text-green-400 disabled:cursor-not-allowed transition-all duration-300 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-1 focus-visible:ring-offset-zinc-900"
                >
                  {isLoading ? '...' : 'Send'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}