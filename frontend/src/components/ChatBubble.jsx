import React from 'react';

const ChatBubble = ({ message, isOutbound }) => {
    const time = message.time ? new Date(message.time) : (message.timestamp ? new Date(message.timestamp) : null);
    const bubbleText = message.text || message.content || String(message.message || '');

    const containerJustify = isOutbound ? 'justify-end' : 'justify-start';
    const bubbleBase = 'px-4 py-2 rounded-lg shadow-sm';
    const bubbleClass = isOutbound
        ? `${bubbleBase} bg-pink-500 text-white rounded-br-none`
        : `${bubbleBase} bg-white text-gray-900 rounded-bl-none border border-gray-200`;

    const textAlignClass = isOutbound ? 'text-right' : 'text-left';

    return (
        <div className={`flex ${containerJustify} mb-3 w-full`}> 
            <div className={`max-w-[75%] ${isOutbound ? 'ml-auto' : 'mr-auto'}`}>
                <div className={bubbleClass}>
                    <div className={`text-sm whitespace-pre-wrap wrap-break-word ${textAlignClass}`}>{bubbleText}</div>
                    {time && (
                        <div className={`text-xs mt-1 ${isOutbound ? 'text-white text-right' : 'text-gray-600 text-left'}`} style={isOutbound ? { opacity: 0.9 } : {}}>
                            {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChatBubble;
