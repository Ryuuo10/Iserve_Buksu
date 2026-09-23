import { useMemo, useState } from 'react';

const normalizeMessages = (grievance) => {
  const source = Array.isArray(grievance?.conversationTranscript)
    ? grievance.conversationTranscript
    : Array.isArray(grievance?.conversation)
      ? grievance.conversation
      : Array.isArray(grievance?.chatHistory)
        ? grievance.chatHistory
        : [];

  return source
    .map((entry, index) => {
      const rawSender = String(entry?.sender || entry?.role || '').trim().toLowerCase();
      const sender = rawSender === 'assistant' || rawSender === 'bot' ? 'bot' : rawSender === 'user' ? 'user' : '';
      const message = String(entry?.message || entry?.text || entry?.content || '').trim();
      const timestampValue = entry?.timestamp || entry?.createdAt || entry?.time;
      const timestamp = timestampValue ? new Date(timestampValue) : null;

      if (!sender || !message) {
        return null;
      }

      return {
        id: `${sender}-${timestampValue || index}-${index}`,
        sender,
        message,
        timestamp: timestamp && !Number.isNaN(timestamp.getTime()) ? timestamp : null,
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      if (!left.timestamp || !right.timestamp) return 0;
      return left.timestamp.getTime() - right.timestamp.getTime();
    });
};

const formatTime = (value) =>
  value
    ? value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '--';

const BotIcon = () => (
  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 text-xs font-bold text-white">
    AI
  </span>
);

const UserIcon = () => (
  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-500 text-xs font-bold text-white">
    U
  </span>
);

const ConversationTranscript = ({ grievance, className = '', defaultExpanded = false, forceExpanded = false, hideToggle = false }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const messages = useMemo(() => normalizeMessages(grievance), [grievance]);
  const isExpanded = forceExpanded || expanded;
  const userLabel = grievance?.isAnonymous
    ? 'Anonymous'
    : grievance?.complainantName || grievance?.complainantId?.name || 'Complainant';
  const messageCount = messages.length;

  return (
    <section className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
      <button
        type="button"
        onClick={() => {
          if (!hideToggle && !forceExpanded) {
            setExpanded((current) => !current);
          }
        }}
        className={`flex w-full items-start justify-between gap-4 px-6 py-4 text-left transition-colors ${hideToggle ? 'cursor-default' : 'hover:bg-slate-50'}`}
        aria-expanded={isExpanded}
        disabled={hideToggle}
      >
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-lg font-semibold text-slate-900">Conversation Transcript</h3>
            <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              {messageCount} {messageCount === 1 ? 'message' : 'messages'}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Actual conversation between the user and I-Serve Chatbot.
          </p>
        </div>
        {!hideToggle && (
          <span className="mt-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-sm font-semibold text-slate-600">
            {isExpanded ? 'Hide' : 'Show'}
          </span>
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-slate-200 p-4">
          {messageCount === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
              <p className="text-sm font-semibold text-slate-700">Conversation transcript unavailable</p>
              <p className="mt-2 text-sm text-slate-500">
                This grievance has no stored chatbot conversation history.
              </p>
            </div>
          ) : (
            <div className="max-h-[28rem] overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="space-y-4">
                {messages.map((item) => {
                  const isUser = item.sender === 'user';
                  const senderLabel = isUser ? userLabel : 'I-Serve Chat';

                  return (
                    <div key={item.id} className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
                      {!isUser && <BotIcon />}
                      <div className={`max-w-[82%] ${isUser ? 'text-right' : 'text-left'}`}>
                        <p className="mb-1 text-xs font-semibold text-slate-500">{senderLabel}</p>
                        <div
                          className={`rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                            isUser
                              ? 'rounded-br-sm bg-gradient-to-r from-blue-600 to-cyan-600 text-white'
                              : 'rounded-bl-sm border border-slate-200 bg-white text-slate-800'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{item.message}</p>
                          <p className={`mt-2 text-xs ${isUser ? 'text-blue-100' : 'text-slate-500'}`}>
                            {formatTime(item.timestamp)}
                          </p>
                        </div>
                      </div>
                      {isUser && <UserIcon />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default ConversationTranscript;
