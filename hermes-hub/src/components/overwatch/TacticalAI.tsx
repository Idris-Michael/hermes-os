import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Brain, Loader2 } from 'lucide-react';

interface Message {
  role: 'user' | 'model';
  content: string;
}

interface TacticalAIProps {
  onClose: () => void;
  contextData?: any; // To pass dashboard context if needed
}

export default function TacticalAI({ onClose, contextData }: TacticalAIProps) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', content: 'Severus Overwatch AI initialized. Awaiting queries regarding London airspace, traffic, disruptions, and prediction markets.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<any>(null);

  useEffect(() => {
    const init = async () => {
      try {
        let marketContext = '';
        try {
          const res = await fetch('/api/polymarket');
          const markets: any[] = await res.json();
          const top = markets.slice(0, 8).map((m: any) => {
            let prices: number[] = [];
            try { prices = JSON.parse(m.outcomePrices).map(Number); } catch {}
            let outcomes: string[] = [];
            try { outcomes = JSON.parse(m.outcomes); } catch {}
            const top2 = outcomes.slice(0, 2).map((o: string, i: number) =>
              `${o}: ${Math.round((prices[i] ?? 0) * 100)}%`
            ).join(', ');
            return `- ${m.question} [${top2}] vol:${m.volume}`;
          }).join('\n');
          marketContext = `\n\nLIVE POLYMARKET PREDICTION MARKETS (top by volume):\n${top}`;
        } catch {}

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        chatRef.current = ai.chats.create({
          model: 'gemini-2.0-flash',
          config: {
            systemInstruction: `You are Severus Overwatch AI, a highly advanced tactical analysis system monitoring London.
Your tone is cold, clinical, highly efficient, and cyberpunk-themed.
Respond concisely with military/tactical terminology when appropriate.
You have access to current dashboard data showing incoming flights, jam cams, disruptions, and live prediction market odds.
When asked about probability, likelihood, or market sentiment on any topic — reference the Polymarket data below.
CURRENT DASHBOARD CONTEXT: ${JSON.stringify(contextData || 'No context.')}${marketContext}
Limit responses to 2-3 short paragraphs maximum.`
          }
        });
      } catch (e) {
        console.error("Failed to initialize AI:", e);
      }
    };
    init();
  }, [contextData]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !chatRef.current || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      // Add a placeholder for the model's response
      setMessages(prev => [...prev, { role: 'model', content: '' }]);
      
      const streamResponse = await chatRef.current.sendMessageStream({ message: userMessage });
      
      let fullText = '';
      for await (const chunk of streamResponse) {
        fullText += chunk.text || '';
        // Update the last message in the state
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1].content = fullText;
          return newMessages;
        });
      }
    } catch (error) {
      console.error("Error generating text:", error);
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1].content = "ERROR: Connection to Overwatch Command failed. Retrying...";
        return newMessages;
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      className="absolute bottom-6 right-6 w-96 flex flex-col pointer-events-auto shadow-[0_0_30px_rgba(0,240,255,0.15)] z-50 glass-panel rounded-lg overflow-hidden"
      style={{ height: '500px' }}
    >
      {/* Header */}
      <div className="p-3 border-b border-white/10 flex justify-between items-center bg-black/60 relative">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#00f0ff] to-transparent opacity-50"></div>
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-[#00f0ff]" />
          <span className="font-mono text-sm tracking-widest text-[#00f0ff] uppercase shadow-text">Overwatch AI</span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-white/10 rounded transition-colors text-gray-400 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-black/40 relative">
        <div className="absolute inset-0 pointer-events-none hex-grid opacity-20"></div>
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} w-full relative z-10`}>
            <div 
              className={`max-w-[85%] p-3 rounded text-sm font-sans leading-relaxed
                ${msg.role === 'user' 
                  ? 'bg-[#00f0ff]/10 border border-[#00f0ff]/30 text-white rounded-br-none' 
                  : 'bg-white/5 border border-white/10 text-gray-300 rounded-bl-none'
                }`}
            >
              {msg.role === 'model' && msg.content === '' && (
                <div className="flex items-center gap-2 text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" /> Processing...
                </div>
              )}
              {msg.content && msg.content.split('\n').map((line, i) => (
                <span key={i}>
                  {line}
                  {i !== msg.content.split('\n').length - 1 && <br />}
                </span>
              ))}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/10 bg-black/60 relative z-10">
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter command query..."
            disabled={isLoading}
            className="flex-1 bg-black/40 border border-white/20 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00f0ff]/50 font-mono"
          />
          <button 
            type="submit"
            disabled={isLoading || !input.trim()}
            className="p-2 bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/30 rounded hover:bg-[#00f0ff]/30 flex-shrink-0 transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </motion.div>
  );
}
