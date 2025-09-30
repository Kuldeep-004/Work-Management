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

  // Generate consistent color for user based on their ID
  const getUserColor = (userId) => {
    const colors = [
      'from-blue-400 to-blue-600',
      'from-purple-400 to-purple-600', 
      'from-pink-400 to-pink-600',
      'from-red-400 to-red-600',
      'from-orange-400 to-orange-600',
      'from-yellow-400 to-yellow-600',
      'from-teal-400 to-teal-600',
      'from-indigo-400 to-indigo-600',
      'from-cyan-400 to-cyan-600',
      'from-emerald-400 to-emerald-600'
    ];
    
    if (!userId) return colors[0];
    
    // Create a simple hash from the userId to get consistent color
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return colors[Math.abs(hash) % colors.length];
  };

  // Get text color for user names
  const getUserTextColor = (userId) => {
    const textColors = [
      'text-blue-600',
      'text-purple-600', 
      'text-pink-600',
      'text-red-600',
      'text-orange-600',
      'text-yellow-600',
      'text-teal-600',
      'text-indigo-600',
      'text-cyan-600',
      'text-emerald-600'
    ];
    
    if (!userId) return textColors[0];
    
    // Create a simple hash from the userId to get consistent color
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return textColors[Math.abs(hash) % textColors.length];
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getMessageStatus = () => {
    if (!isOwn) return null;
    
    // Check if message is read by others (excluding sender)
    const readByOthers = message.readBy?.filter(r => 
      r.user && r.user.toString() !== message.sender._id.toString()
    ) || [];
    
    // Check if message is delivered to others (excluding sender)
    const deliveredToOthers = message.deliveredTo?.filter(d => 
      d.user && d.user.toString() !== message.sender._id.toString()
    ) || [];
    
    if (readByOthers.length > 0) {
      // Message has been read by other users (double tick white)
      return (
        <div className="relative inline-flex" title="Read">
          <CheckIcon className="h-3 w-3 text-white opacity-80" />
          <CheckIcon className="h-3 w-3 text-white opacity-80 -ml-1.5" />
        </div>
      );
    } else if (deliveredToOthers.length > 0) {
      // Message delivered but not read (single tick white)
      return (
        <div className="relative inline-flex" title="Delivered">
          <CheckIcon className="h-3 w-3 text-white opacity-60" />
        </div>
      );
    } else {
      // Message sent but not yet delivered (single tick gray/lighter)
      return (
        <div className="relative inline-flex" title="Sent">
          <CheckIcon className="h-3 w-3 text-white opacity-40" />
        </div>
      );
    }
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
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1`}>
      <div className={`flex items-end space-x-2 max-w-[80%] ${isOwn ? 'flex-row-reverse space-x-reverse' : ''}`}>
        {/* Avatar for group chats - always show for non-own messages in groups */}
        {!isOwn && message.chat?.type === 'group' && (
          <div className="flex-shrink-0 mb-1">
            {message.sender.photo?.url ? (
              <img
                src={message.sender.photo.url}
                alt={`${message.sender.firstName} ${message.sender.lastName}`}
                className="h-8 w-8 rounded-full object-cover ring-2 ring-white shadow-sm"
              />
            ) : (
              <div className={`h-8 w-8 bg-gray-400 ${getUserColor(message.sender._id)} rounded-full flex items-center justify-center text-white font-semibold text-xs shadow-sm`}>
                {message.sender.firstName?.[0]?.toUpperCase() || '?'}
              </div>
            )}
          </div>
        )}

        {/* Avatar for other cases (private chats) - only when showAvatar is true */}
        {showAvatar && !isOwn && message.chat?.type !== 'group' && (
          <div className="flex-shrink-0 mb-1">
            {message.sender.photo?.url ? (
              <img
                src={message.sender.photo.url}
                alt={`${message.sender.firstName} ${message.sender.lastName}`}
                className="h-8 w-8 rounded-full object-cover ring-2 ring-white shadow-sm"
              />
            ) : (
              <div className={`h-8 w-8 bg-gray-400 ${getUserColor(message.sender._id)} rounded-full flex items-center justify-center text-white font-semibold text-xs shadow-sm`}>
                {message.sender.firstName?.[0]?.toUpperCase() || '?'}
              </div>
            )}
          </div>
        )}

        {/* Message bubble */}
        <div
          className={`relative px-3 py-2 rounded-2xl shadow-sm ${
            isOwn
              ? 'bg-green-500 text-white rounded-br-md'
              : 'bg-white text-gray-900 border border-gray-100 rounded-bl-md'
          } max-w-full`}
        >
          {/* Sender name for group chats */}
          {!isOwn && message.chat?.type === 'group' && (
            <div className={`text-xs font-semibold mb-1 ${getUserTextColor(message.sender._id)}`}>
              {message.sender.firstName} {message.sender.lastName}
            </div>
          )}

          {/* Message content */}
          <div className="text-sm leading-relaxed">
            <div className="relative">
              <div className="pr-14">
                {renderMessageContent()}
              </div>
              
              {/* Time and status - positioned absolutely at bottom right */}
              <div className={`absolute bottom-0 right-0 flex items-center space-x-1 text-[10px] ${
                isOwn ? 'text-green-100' : 'text-gray-400'
              } mt-1`}>
                {message.isEdited && (
                  <span className="opacity-75 text-xs">edited</span>
                )}
                <span className="whitespace-nowrap">
                  {formatTime(message.createdAt)}
                </span>
                {isOwn && (
                  <span className="inline-flex">
                    {getMessageStatus()}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Spacer for alignment when no avatar - only for private chats */}
        {!isOwn && message.chat?.type !== 'group' && !showAvatar && (
          <div className="w-8"></div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
