import { useState, useRef } from 'react';
import { 
  PaperAirplaneIcon, 
  PaperClipIcon,
  FaceSmileIcon,
  MicrophoneIcon,
  StopIcon
} from '@heroicons/react/24/outline';

const MessageInput = ({ onSendMessage, onTypingStart, onTypingStop }) => {
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const audioChunksRef = useRef([]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setMessage(value);

    // Handle typing indicators
    if (value.trim() && !typingTimeoutRef.current) {
      onTypingStart();
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      onTypingStop();
      typingTimeoutRef.current = null;
    }, 1000);
  };

  const handleSend = () => {
    if (message.trim()) {
      // Don't trim the message to preserve line breaks, just check if there's content
      onSendMessage(message);
      setMessage('');
      
      // Stop typing indicator
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      onTypingStop();
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Determine type based on file
      let type = 'file';
      if (file.type.startsWith('image/')) {
        type = 'image';
      } else if (file.type.startsWith('audio/')) {
        type = 'audio';
      } else if (file.type.startsWith('video/')) {
        type = 'video';
      }
      onSendMessage('', type, file);
    }
    e.target.value = '';
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const audioFile = new File([audioBlob], `audio_${Date.now()}.wav`, { type: 'audio/wav' });
        onSendMessage('', 'audio', audioFile);
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  const formatRecordingTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const emojis = ['😀', '😂', '❤️', '👍', '👎', '😊', '😢', '😮', '😡', '🎉', '🔥', '💯'];

  const insertEmoji = (emoji) => {
    setMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  return (
    <div className="px-4 py-2 bg-white border-t border-gray-200">
      {/* Recording indicator */}
      {isRecording && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-3 w-3 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-red-700 text-sm font-medium">Recording...</span>
              <span className="text-red-600 text-sm font-mono">{formatRecordingTime(recordingTime)}</span>
            </div>
            <button
              onClick={stopRecording}
              className="px-4 py-2 bg-red-500 text-white text-sm rounded-full hover:bg-red-600 transition-colors font-medium"
            >
              Stop & Send
            </button>
          </div>
        </div>
      )}

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <div className="mb-3 p-4 bg-gray-50 rounded-xl shadow-sm">
          <div className="grid grid-cols-8 gap-2">
            {emojis.map((emoji, index) => (
              <button
                key={index}
                onClick={() => insertEmoji(emoji)}
                className="text-xl hover:bg-gray-200 rounded-lg p-2 transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Message Input Row */}
      <div className="flex items-end space-x-3">
        {/* Action buttons - left side */}
        <div className="flex space-x-1">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="py-3 px-1 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-full transition-colors"
            title="Attach file"
            disabled={isRecording}
          >
            <PaperClipIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Message input container - WhatsApp style */}
        <div className="flex-1 flex items-end space-x-2">
          <div className="flex-1 relative">
            <div className="flex items-center bg-gray-50 rounded-2xl border border-gray-200 focus-within:border-green-500 transition-colors">
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="p-3 text-gray-500 hover:text-green-600 transition-colors"
                title="Emoji"
                disabled={isRecording}
              >
                <FaceSmileIcon className="h-5 w-5" />
              </button>
              
              <textarea
                value={message}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                className="flex-1 px-2 py-3 bg-transparent border-0 resize-none focus:outline-none placeholder-gray-500 text-sm leading-5 max-h-[120px]"
                rows={1}
                disabled={isRecording}
                style={{ 
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                  lineHeight: '1.4',
                  wordWrap: 'break-word',
                  whiteSpace: 'pre-wrap'
                }}
                onInput={(e) => {
                  // Auto-resize textarea
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                }}
              />
            </div>
          </div>

          {/* Send/Record button - WhatsApp style */}
          {message.trim() ? (
            <button
              onClick={handleSend}
              className="p-3 bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors shadow-md"
              title="Send message"
            >
              <PaperAirplaneIcon className="h-5 w-5" />
            </button>
          ) : (
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`p-3 rounded-full transition-colors shadow-md ${
                isRecording 
                  ? 'bg-red-500 text-white hover:bg-red-600' 
                  : 'bg-green-500 text-white hover:bg-green-600'
              }`}
              title={isRecording ? "Stop recording" : "Record audio"}
            >
              {isRecording ? (
                <StopIcon className="h-5 w-5" />
              ) : (
                <MicrophoneIcon className="h-5 w-5" />
              )}
            </button>
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          accept="*/*"
        />
      </div>
    </div>
  );
};

export default MessageInput;
