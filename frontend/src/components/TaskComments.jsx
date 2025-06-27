import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import defaultProfile from '../assets/avatar.jpg';

const TaskComments = ({ taskId }) => {
  const { user, token, isAuthenticated } = useAuth();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const [audioSrcs, setAudioSrcs] = useState({});

  useEffect(() => {
    if (isAuthenticated() && token) {
      fetchComments();
    }
  }, [taskId, token, isAuthenticated]);

  useEffect(() => {
    const fetchAudioBlobs = async () => {
      const newAudioSrcs = { ...audioSrcs };
      for (const comment of comments) {
        if (comment.type === 'audio' && comment.audioUrl && !newAudioSrcs[comment._id]) {
          try {
            const response = await fetch(`http://localhost:5000/api/tasks/audio/${comment.audioUrl}`);
            if (response.ok) {
              const blob = await response.blob();
              newAudioSrcs[comment._id] = URL.createObjectURL(blob);
            } else {
              console.error(`Failed to fetch audio for comment ${comment._id}`);
            }
          } catch (error) {
            console.error(`Error fetching audio for comment ${comment._id}:`, error);
          }
        }
      }
      setAudioSrcs(newAudioSrcs);
    };

    if (comments.length > 0) {
      fetchAudioBlobs();
    }

    // Cleanup object URLs on component unmount
    return () => {
      Object.values(audioSrcs).forEach(url => URL.revokeObjectURL(url));
    };
  }, [comments, token]);

  const fetchComments = async () => {
    if (!token) {
      console.error('No authentication token available');
      toast.error('Please log in to view comments');
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/tasks/${taskId}/comments`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (response.status === 401) {
        toast.error('Your session has expired. Please log in again.');
        return;
      }
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch comments');
      }
      
      const data = await response.json();
      setComments(data);
    } catch (error) {
      console.error('Error fetching comments:', error);
      toast.error(error.message || 'Failed to load comments');
    }
  };

  const handleAddTextComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    if (!token) {
      toast.error('Please log in to add comments');
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ content: newComment })
      });

      if (response.status === 401) {
        toast.error('Your session has expired. Please log in again.');
        return;
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to add comment');
      }

      const updatedComments = await response.json();
      setComments(updatedComments);
      setNewComment('');
      toast.success('Comment added successfully');
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error(error.message || 'Failed to add comment');
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to start recording');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const handleAddAudioComment = async () => {
    if (!audioBlob) return;
    if (audioBlob.size === 0) {
      toast.error('Recorded audio is empty. Please try recording again.');
      return;
    }
    console.log('Audio blob size:', audioBlob.size);
    if (!token) {
      toast.error('Please log in to add audio comments');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const response = await fetch(`http://localhost:5000/api/tasks/${taskId}/comments/audio`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      if (response.status === 401) {
        toast.error('Your session has expired. Please log in again.');
        return;
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to add audio comment');
      }

      const updatedComments = await response.json();
      setComments(updatedComments);
      setAudioBlob(null);
      toast.success('Audio comment added successfully');
    } catch (error) {
      console.error('Error adding audio comment:', error);
      toast.error(error.message || 'Failed to add audio comment');
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!token) {
      toast.error('Please log in to delete comments');
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/tasks/${taskId}/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        toast.error('Your session has expired. Please log in again.');
        return;
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete comment');
      }

      setComments(comments.filter(comment => comment._id !== commentId));
      toast.success('Comment deleted successfully');
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast.error(error.message || 'Failed to delete comment');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="mt-4">
      <h3 className="text-lg font-semibold mb-2">Comments</h3>
      
      {/* Add text comment form */}
      <form onSubmit={handleAddTextComment} className="mb-4">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          className="w-full p-2 border rounded"
          rows="3"
        ></textarea>
        <button
          type="submit"
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Add Comment
        </button>
      </form>

      {/* Audio comment controls */}
      <div className="flex items-center space-x-4 mb-4">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`px-4 py-2 rounded ${isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'} text-white`}
        >
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>
        {audioBlob && (
          <div className="flex items-center space-x-2">
            <audio src={URL.createObjectURL(audioBlob)} controls preload="metadata" />
            <button
              onClick={handleAddAudioComment}
              className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
            >
              Send Audio
            </button>
            <button
              onClick={() => setAudioBlob(null)}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Comments list */}
      <div className="space-y-4">
        {comments.map((comment) => (
          <div key={comment._id} className="bg-gray-50 p-3 rounded-lg">
            <div className="flex items-start space-x-3">
              <img
                src={comment.createdBy.photo?.url || defaultProfile}
                alt={comment.createdBy.firstName}
                className="w-8 h-8 rounded-full object-cover"
                onError={(e) => { e.target.onerror = null; e.target.src = defaultProfile; }}
              />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-medium">
                    {comment.createdBy.firstName} {comment.createdBy.lastName}
                  </p>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">
                      {formatDate(comment.createdAt)}
                    </span>
                    {user && user._id === comment.createdBy._id && (
                      <button
                        onClick={() => handleDeleteComment(comment._id)}
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
                {comment.type === 'text' ? (
                  <p className="mt-1 text-gray-700">{comment.content}</p>
                ) : (
                  <audio controls className="mt-2 w-full" preload="metadata">
                    {audioSrcs[comment._id] && <source src={audioSrcs[comment._id]} type="audio/webm" />}
                    Your browser does not support the audio element.
                  </audio>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TaskComments; 