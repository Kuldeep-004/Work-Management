import { useState } from 'react';
import { 
  CheckIcon, 
  CheckCircleIcon,
  DocumentIcon,
  ArrowDownTrayIcon,
  PlayIcon,
  PauseIcon,
  SpeakerWaveIcon
} from '@heroicons/react/24/outline';

const MessageBubble = ({ message, isOwn, showAvatar, showTimestamp }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioRef, setAudioRef] = useState(null);

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getMessageStatus = () => {
    if (!isOwn) return null;
    
    // Check if message is read by others (double tick white)
    const readByOthers = message.readBy?.filter(r => r.user !== message.sender._id) || [];
    if (readByOthers.length > 0) {
      return (
        <div className="relative inline-flex">
          <CheckIcon className="h-3 w-3 text-white opacity-80" />
          <CheckIcon className="h-3 w-3 text-white opacity-80 -ml-1.5" />
        </div>
      );
    }
    
    // Message sent and delivered but not read (single tick white)
    return <CheckIcon className="h-3 w-3 text-white opacity-60" />;
  };

  const renderMessageContent = () => {
    switch (message.type) {
      case 'text':
        return (
          <div className="break-words whitespace-pre-wrap">
            {message.content}
          </div>
        );
      
      case 'image':
        return (
          <div className="max-w-xs">
            {message.content && (
              <div className="mb-2 break-words whitespace-pre-wrap">{message.content}</div>
            )}
            <div className="relative rounded-lg overflow-hidden">
              {!imageLoaded && (
                <div className="absolute inset-0 bg-gray-200 animate-pulse rounded-lg"></div>
              )}
              <img
                src={message.file.url}
                alt="Shared image"
                className={`max-w-full h-auto rounded-lg transition-opacity ${
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
                onLoad={() => setImageLoaded(true)}
                onClick={() => window.open(message.file.url, '_blank')}
                style={{ cursor: 'pointer' }}
              />
            </div>
          </div>
        );
      
      case 'audio':
        return (
          <div className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg max-w-xs">
            <button
              onClick={() => {
                if (audioRef) {
                  if (isPlaying) {
                    audioRef.pause();
                    setIsPlaying(false);
                  } else {
                    audioRef.play();
                    setIsPlaying(true);
                  }
                }
              }}
              className="flex-shrink-0 p-2 bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors"
            >
              {isPlaying ? (
                <PauseIcon className="h-4 w-4" />
              ) : (
                <PlayIcon className="h-4 w-4" />
              )}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <SpeakerWaveIcon className="h-4 w-4 text-gray-500" />
                <div className="text-sm font-medium text-gray-900">
                  Audio Message
                </div>
              </div>
              <div className="text-xs text-gray-500">
                {message.file?.duration ? `${Math.floor(message.file.duration)}s` : 'Audio'}
              </div>
            </div>
            <audio
              ref={setAudioRef}
              src={message.file?.url}
              onEnded={() => setIsPlaying(false)}
              onLoadedData={() => {
                // Audio loaded
              }}
            />
          </div>
        );
      
      case 'file':
      case 'video':
        return (
          <div className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg max-w-xs">
            <div className="flex-shrink-0">
              <DocumentIcon className="h-8 w-8 text-gray-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">
                {message.file.fileName || 'File'}
              </div>
              <div className="text-xs text-gray-500">
                {formatFileSize(message.file.fileSize)}
              </div>
            </div>
            <button
              onClick={() => window.open(message.file.url, '_blank')}
              className="flex-shrink-0 p-1 text-gray-500 hover:text-gray-700"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
            </button>
          </div>
        );
      
      default:
        return <div className="text-gray-500 italic">Unsupported message type</div>;
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-0.5`}>
      <div className={`flex items-end space-x-1 max-w-[75%] ${isOwn ? 'flex-row-reverse space-x-reverse' : ''}`}>
        {/* Avatar */}
        {showAvatar && !isOwn && (
          <div className="flex-shrink-0">
            {message.sender.photo?.url ? (
              <img
                src={message.sender.photo.url}
                alt={`${message.sender.firstName} ${message.sender.lastName}`}
                className="h-6 w-6 rounded-full object-cover"
              />
            ) : (
              <div className="h-6 w-6 bg-gray-300 rounded-full flex items-center justify-center">
                <span className="text-xs text-gray-600">
                  {message.sender.firstName?.[0]?.toUpperCase()}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Message bubble */}
        <div
          className={`relative px-2.5 py-1.5 rounded-lg ${
            isOwn
              ? 'bg-green-500 text-white'
              : 'bg-white text-gray-900 border border-gray-200'
          } ${
            isOwn 
              ? 'rounded-br-sm' 
              : 'rounded-bl-sm'
          } shadow-sm max-w-full`}
        >
          {/* Sender name for group chats */}
          {!isOwn && message.chat?.type === 'group' && showAvatar && (
            <div className="text-xs font-medium text-gray-500 mb-1">
              {message.sender.firstName} {message.sender.lastName}
            </div>
          )}

          {/* Message content - WhatsApp style with smart layout */}
          <div className="text-sm leading-relaxed">
            <div className="relative">
              <div className="pr-16">
                {renderMessageContent()}
              </div>
              
              {/* Time and status - positioned absolutely at bottom right */}
              <div className={`absolute bottom-0 right-0 flex items-center space-x-1 text-xs ${
                isOwn ? 'text-green-100 opacity-80' : 'text-gray-400'
              }`}>
                {message.isEdited && (
                  <span className="opacity-75">edited</span>
                )}
                <span className="whitespace-nowrap">
                  {formatTime(message.createdAt)}
                </span>
                <span className="inline-flex">
                  {getMessageStatus()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Placeholder for alignment when no avatar */}
        {!showAvatar && !isOwn && (
          <div className="w-6"></div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
