import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import defaultProfile from "../assets/avatar.jpg";
import { API_BASE_URL } from "../apiConfig";
import {
  PaperClipIcon,
  XMarkIcon,
  DocumentIcon,
} from "@heroicons/react/24/outline";

const TaskComments = ({ taskId }) => {
  const { user, token, isAuthenticated } = useAuth();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const [audioSrcs, setAudioSrcs] = useState({});
  const [audioUploading, setAudioUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  // Mention functionality
  const [users, setUsers] = useState([]);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearchTerm, setMentionSearchTerm] = useState("");
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [cursorPosition, setCursorPosition] = useState(0);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [mentionedUsers, setMentionedUsers] = useState([]);
  const mentionDropdownRef = useRef(null);

  useEffect(() => {
    if (isAuthenticated() && token) {
      fetchComments();
      fetchUsers();
    }
  }, [taskId, token, isAuthenticated]);

  // Fetch users for mentions
  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/for-task-assignment`, {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  useEffect(() => {
    const fetchAudioBlobs = async () => {
      const newAudioSrcs = { ...audioSrcs };
      for (const comment of comments) {
        if (
          comment.type === "audio" &&
          comment.audioUrl &&
          !newAudioSrcs[comment._id]
        ) {
          try {
            // Check if it's a cloud URL (starts with http)
            if (comment.audioUrl.startsWith("http")) {
              // Use cloud URL directly
              newAudioSrcs[comment._id] = comment.audioUrl;
            } else {
              // Fetch from backend for local files
              const response = await fetch(
                `${API_BASE_URL}/api/tasks/audio/${comment.audioUrl}`,
              );
              if (response.ok) {
                const blob = await response.blob();
                newAudioSrcs[comment._id] = URL.createObjectURL(blob);
              } else {
                console.error(
                  `Failed to fetch audio for comment ${comment._id}`,
                );
              }
            }
          } catch (error) {
            console.error(
              `Error fetching audio for comment ${comment._id}:`,
              error,
            );
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
      Object.values(audioSrcs).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [comments, token]);

  const fetchComments = async () => {
    if (!token) {
      console.error("No authentication token available");
      toast.error("Please log in to view comments");
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/tasks/${taskId}/comments`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.status === 401) {
        toast.error("Your session has expired. Please log in again.");
        return;
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to fetch comments");
      }

      const data = await response.json();
      setComments(data);
    } catch (error) {
      console.error("Error fetching comments:", error);
      toast.error(error.message || "Failed to load comments");
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(files);
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles((prevFiles) => prevFiles.filter((_, i) => i !== index));
  };

  // Handle drag and drop
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      setSelectedFiles((prevFiles) => [...prevFiles, ...files]);
      toast.success(`${files.length} file(s) added`);
    }
  };

  // Handle paste
  const handlePaste = (e) => {
    const items = e.clipboardData.items;
    const files = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) {
          files.push(file);
        }
      }
    }

    if (files.length > 0) {
      e.preventDefault();
      setSelectedFiles((prevFiles) => [...prevFiles, ...files]);
      toast.success(`${files.length} file(s) added from clipboard`);
    }
  };

  // Handle mention detection
  const handleCommentChange = (e) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    setNewComment(value);
    setCursorPosition(cursorPos);

    // Detect @ symbol for mentions
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtSymbol = textBeforeCursor.lastIndexOf("@");

    if (lastAtSymbol !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtSymbol + 1);
      // Allow mentions with spaces (for "FirstName LastName" format)
      // Close dropdown only if text after @ ends with double space or has non-alphanumeric chars (except single spaces)
      const shouldShowDropdown =
        /^[a-zA-Z\s]*$/.test(textAfterAt) && !textAfterAt.endsWith("  ");

      if (shouldShowDropdown) {
        setMentionSearchTerm(textAfterAt);
        setShowMentionDropdown(true);
        setSelectedMentionIndex(0);

        // Calculate position for dropdown
        if (textareaRef.current) {
          const textarea = textareaRef.current;
          const rect = textarea.getBoundingClientRect();
          setMentionPosition({
            top: rect.top - 200, // Position above textarea
            left: rect.left,
          });
        }
      } else {
        setShowMentionDropdown(false);
        setSelectedMentionIndex(0);
      }
    } else {
      setShowMentionDropdown(false);
      setSelectedMentionIndex(0);
    }
  };

  // Handle mention selection
  const handleMentionSelect = (selectedUser) => {
    const textBeforeCursor = newComment.substring(0, cursorPosition);
    const textAfterCursor = newComment.substring(cursorPosition);
    const lastAtSymbol = textBeforeCursor.lastIndexOf("@");

    if (lastAtSymbol !== -1) {
      const beforeMention = newComment.substring(0, lastAtSymbol);
      // Only insert @Name, no ID
      const mentionText = `@${selectedUser.firstName} ${selectedUser.lastName}`;
      const newText = beforeMention + mentionText + " " + textAfterCursor;

      setNewComment(newText);

      // Track this user as mentioned
      setMentionedUsers((prev) => {
        const exists = prev.find((u) => u._id === selectedUser._id);
        if (!exists) {
          return [...prev, selectedUser];
        }
        return prev;
      });

      setShowMentionDropdown(false);
      setMentionSearchTerm("");
      setSelectedMentionIndex(0);

      // Set cursor position after the mention
      setTimeout(() => {
        if (textareaRef.current) {
          const newCursorPos = beforeMention.length + mentionText.length + 1;
          textareaRef.current.selectionStart = newCursorPos;
          textareaRef.current.selectionEnd = newCursorPos;
          textareaRef.current.focus();
        }
      }, 0);
    }
  };

  // Handle keyboard navigation in mention dropdown
  const handleKeyDown = (e) => {
    if (!showMentionDropdown || filteredMentionUsers.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedMentionIndex((prev) => {
        const newIndex =
          prev < filteredMentionUsers.length - 1 ? prev + 1 : prev;
        // Auto-scroll to selected item
        setTimeout(() => {
          const dropdown = mentionDropdownRef.current;
          if (dropdown) {
            const selectedItem = dropdown.children[0]?.children[newIndex];
            if (selectedItem) {
              selectedItem.scrollIntoView({
                block: "nearest",
                behavior: "smooth",
              });
            }
          }
        }, 0);
        return newIndex;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedMentionIndex((prev) => {
        const newIndex = prev > 0 ? prev - 1 : 0;
        // Auto-scroll to selected item
        setTimeout(() => {
          const dropdown = mentionDropdownRef.current;
          if (dropdown) {
            const selectedItem = dropdown.children[0]?.children[newIndex];
            if (selectedItem) {
              selectedItem.scrollIntoView({
                block: "nearest",
                behavior: "smooth",
              });
            }
          }
        }, 0);
        return newIndex;
      });
    } else if (e.key === "Enter" && showMentionDropdown) {
      e.preventDefault();
      if (filteredMentionUsers[selectedMentionIndex]) {
        handleMentionSelect(filteredMentionUsers[selectedMentionIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setShowMentionDropdown(false);
      setMentionSearchTerm("");
      setSelectedMentionIndex(0);
    }
  };

  // Filter users based on mention search (with better partial matching)
  const filteredMentionUsers = users.filter((u) => {
    const searchTerm = mentionSearchTerm.toLowerCase().trim();
    if (!searchTerm) return true; // Show all users if no search term

    const fullName = `${u.firstName} ${u.lastName}`.toLowerCase();
    const firstName = u.firstName.toLowerCase();
    const lastName = u.lastName.toLowerCase();

    // Match if: full name contains search, first name starts with search, or last name starts with search
    return (
      fullName.includes(searchTerm) ||
      firstName.startsWith(searchTerm) ||
      lastName.startsWith(searchTerm) ||
      fullName.startsWith(searchTerm)
    );
  });

  // Extract mentions from comment text by matching against all users (case-insensitive)
  const extractMentions = (text) => {
    if (!text) return [];
    const mentions = [];
    const mentionRegex = /@([A-Za-z]+\s+[A-Za-z]+)/g;
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      const mentionedName = match[1].trim().toLowerCase();
      // Find user by matching name (case-insensitive)
      const matchedUser = users.find((u) => {
        const fullName = `${u.firstName} ${u.lastName}`.toLowerCase();
        return fullName === mentionedName;
      });

      if (matchedUser && !mentions.includes(matchedUser._id)) {
        mentions.push(matchedUser._id);
      }
    }
    return mentions;
  };

  // Parse comment text to highlight mentions (only valid users get highlighted)
  const parseCommentWithMentions = (text) => {
    if (!text) return text;

    // Match @Name pattern (first and last name)
    const mentionRegex = /@([A-Za-z]+\s+[A-Za-z]+)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      // Add text before mention
      if (match.index > lastIndex) {
        parts.push({
          type: "text",
          content: text.substring(lastIndex, match.index),
        });
      }

      // Check if this is a valid user (case-insensitive)
      const mentionedName = match[1].trim().toLowerCase();
      const matchedUser = users.find((u) => {
        const fullName = `${u.firstName} ${u.lastName}`.toLowerCase();
        return fullName === mentionedName;
      });

      if (matchedUser) {
        // Valid user - add as mention
        parts.push({
          type: "mention",
          name: match[1].trim(),
          userId: matchedUser._id,
        });
      } else {
        // Invalid user - add as plain text (including @ symbol)
        parts.push({
          type: "text",
          content: match[0],
        });
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push({
        type: "text",
        content: text.substring(lastIndex),
      });
    }

    return parts.length > 0 ? parts : [{ type: "text", content: text }];
  };

  // Close mention dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        mentionDropdownRef.current &&
        !mentionDropdownRef.current.contains(event.target) &&
        textareaRef.current &&
        !textareaRef.current.contains(event.target)
      ) {
        setShowMentionDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAddTextComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() && selectedFiles.length === 0) return;
    if (!token) {
      toast.error("Please log in to add comments");
      return;
    }

    setUploading(true);

    try {
      // Extract mentions from comment
      const mentions = extractMentions(newComment);

      // If there are files, use the files endpoint
      if (selectedFiles.length > 0) {
        const formData = new FormData();
        formData.append("content", newComment);
        formData.append("mentions", JSON.stringify(mentions));
        selectedFiles.forEach((file) => {
          formData.append("files", file);
        });

        const response = await fetch(
          `${API_BASE_URL}/api/tasks/${taskId}/comments/files`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: formData,
          },
        );

        if (response.status === 401) {
          toast.error("Your session has expired. Please log in again.");
          return;
        }

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || "Failed to add comment");
        }

        const result = await response.json();
        setComments(result.comments);
        setNewComment("");
        setMentionedUsers([]);
        setSelectedFiles([]);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        toast.success(result.message || "Comment added successfully");
      } else {
        // Text-only comment
        const response = await fetch(
          `${API_BASE_URL}/api/tasks/${taskId}/comments`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              content: newComment,
              mentions: mentions,
            }),
          },
        );

        if (response.status === 401) {
          toast.error("Your session has expired. Please log in again.");
          return;
        }

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || "Failed to add comment");
        }

        const updatedComments = await response.json();
        setComments(updatedComments);
        setNewComment("");
        setMentionedUsers([]);
        toast.success("Comment added successfully");
      }
    } catch (error) {
      console.error("Error adding comment:", error);
      toast.error(error.message || "Failed to add comment");
    } finally {
      setUploading(false);
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
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        setAudioBlob(audioBlob);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error starting recording:", error);
      toast.error("Failed to start recording");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream
        .getTracks()
        .forEach((track) => track.stop());
    }
  };

  const handleAddAudioComment = async () => {
    if (!audioBlob) return;
    if (audioBlob.size === 0) {
      toast.error("Recorded audio is empty. Please try recording again.");
      return;
    }
    if (!token) {
      toast.error("Please log in to add audio comments");
      return;
    }
    setAudioUploading(true);
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");
      const response = await fetch(
        `${API_BASE_URL}/api/tasks/${taskId}/comments/audio`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        },
      );
      if (response.status === 401) {
        toast.error("Your session has expired. Please log in again.");
        return;
      }
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to add audio comment");
      }
      const updatedComments = await response.json();
      setComments(updatedComments);
      setAudioBlob(null);
      toast.success("Audio comment added successfully");
    } catch (error) {
      console.error("Error adding audio comment:", error);
      toast.error(error.message || "Failed to add audio comment");
    } finally {
      setAudioUploading(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!token) {
      toast.error("Please log in to delete comments");
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/tasks/${taskId}/comments/${commentId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.status === 401) {
        toast.error("Your session has expired. Please log in again.");
        return;
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete comment");
      }

      setComments(comments.filter((comment) => comment._id !== commentId));
      toast.success("Comment deleted successfully");
    } catch (error) {
      console.error("Error deleting comment:", error);
      toast.error(error.message || "Failed to delete comment");
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();

    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12; // Convert to 12-hour format

    return `${day}/${month}/${year}, ${hours}:${minutes} ${ampm}`;
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  const getFileIcon = (mimetype) => {
    if (mimetype.startsWith("image/")) return "🖼️";
    if (mimetype.startsWith("video/")) return "🎬";
    if (mimetype.includes("pdf")) return "📄";
    if (mimetype.includes("word") || mimetype.includes("document")) return "📝";
    if (mimetype.includes("sheet") || mimetype.includes("excel")) return "📊";
    if (mimetype.includes("presentation") || mimetype.includes("powerpoint"))
      return "📽️";
    return "📎";
  };

  // Get display text (hide IDs from user view)
  const getDisplayText = (text) => {
    // Replace @Name[ID] with just @Name in blue
    return text.replace(/@([^[]+)\[([^\]]+)\]/g, "@$1");
  };

  return (
    <div className="mt-4" onPaste={handlePaste}>
      <h3 className="text-lg font-semibold mb-2">Comments</h3>

      {/* Add text comment form */}
      <form
        onSubmit={handleAddTextComment}
        className="mb-4 relative"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <textarea
          ref={textareaRef}
          value={newComment}
          onChange={handleCommentChange}
          onKeyDown={handleKeyDown}
          placeholder="Add a comment... (Type @ to mention someone)"
          className="w-full p-2 border rounded resize-none"
          rows="3"
        ></textarea>

        {/* Mention dropdown */}
        {showMentionDropdown && filteredMentionUsers.length > 0 && (
          <div
            ref={mentionDropdownRef}
            className="fixed bg-white border border-gray-300 rounded-lg shadow-2xl max-h-60 overflow-y-auto"
            style={{
              maxWidth: "400px",
              zIndex: 999999,
              bottom: textareaRef.current
                ? `calc(100vh - ${textareaRef.current.getBoundingClientRect().top}px + 10px)`
                : "auto",
              left: textareaRef.current
                ? `${textareaRef.current.getBoundingClientRect().left}px`
                : "auto",
              width: textareaRef.current
                ? `${textareaRef.current.getBoundingClientRect().width}px`
                : "auto",
            }}
          >
            <div className="py-1">
              {filteredMentionUsers.slice(0, 10).map((u, index) => (
                <div
                  key={u._id}
                  onClick={() => handleMentionSelect(u)}
                  className={`px-3 py-2 cursor-pointer flex items-center gap-3 transition-colors ${
                    index === selectedMentionIndex
                      ? "bg-blue-500 text-white"
                      : "hover:bg-blue-50"
                  }`}
                >
                  <img
                    src={u.photo?.url || defaultProfile}
                    alt={u.firstName}
                    className="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = defaultProfile;
                    }}
                  />
                  <div className="flex flex-col flex-1 min-w-0">
                    <span
                      className={`text-sm font-semibold truncate ${
                        index === selectedMentionIndex
                          ? "text-white"
                          : "text-gray-900"
                      }`}
                    >
                      {u.firstName} {u.lastName}
                    </span>
                    <span
                      className={`text-xs truncate ${
                        index === selectedMentionIndex
                          ? "text-blue-100"
                          : "text-gray-500"
                      }`}
                    >
                      {u.email}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* File attachment section */}
        <div className="mt-2 flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            multiple
            className="hidden"
            id="comment-file-input"
          />
          <label
            htmlFor="comment-file-input"
            className="cursor-pointer flex items-center gap-1 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded"
          >
            <PaperClipIcon className="w-4 h-4" />
            Attach Files
          </label>
          <button
            type="submit"
            disabled={
              uploading || (!newComment.trim() && selectedFiles.length === 0)
            }
            className={`px-4 py-2 rounded text-white font-medium ${
              uploading || (!newComment.trim() && selectedFiles.length === 0)
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-blue-500 hover:bg-blue-600"
            }`}
          >
            {uploading ? "Posting..." : "Add Comment"}
          </button>
        </div>

        {/* Selected files preview */}
        {selectedFiles.length > 0 && (
          <div className="mt-2 space-y-1">
            <p className="text-sm text-gray-600">Selected files:</p>
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between bg-gray-50 p-2 rounded text-sm"
              >
                <span className="flex items-center gap-2">
                  <DocumentIcon className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-700">{file.name}</span>
                  <span className="text-gray-500">
                    ({formatFileSize(file.size)})
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveFile(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </form>

      {/* Audio comment controls */}
      <div className="flex items-center space-x-4 mb-4">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`px-4 py-2 rounded ${isRecording ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"} text-white`}
        >
          {isRecording ? "Stop Recording" : "Start Recording"}
        </button>
        {audioBlob && (
          <div className="flex items-center space-x-2">
            <audio
              src={URL.createObjectURL(audioBlob)}
              controls
              preload="metadata"
            />
            <button
              onClick={handleAddAudioComment}
              className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={audioUploading}
            >
              {audioUploading ? "Uploading..." : "Send Audio"}
            </button>
            <button
              onClick={() => setAudioBlob(null)}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              disabled={audioUploading}
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
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = defaultProfile;
                }}
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
                {comment.type === "text" ? (
                  <div className="mt-1 text-gray-700">
                    {parseCommentWithMentions(comment.content).map(
                      (part, idx) => {
                        if (part.type === "mention") {
                          return (
                            <span
                              key={idx}
                              className="bg-blue-100 text-blue-700 px-1 py-0.5 rounded font-medium"
                              title={`User ID: ${part.userId}`}
                            >
                              @{part.name}
                            </span>
                          );
                        }
                        return <span key={idx}>{part.content}</span>;
                      },
                    )}
                  </div>
                ) : comment.type === "audio" ? (
                  <audio controls className="mt-2 w-full" preload="metadata">
                    {audioSrcs[comment._id] && (
                      <source src={audioSrcs[comment._id]} type="audio/webm" />
                    )}
                    Your browser does not support the audio element.
                  </audio>
                ) : comment.type === "file" ? (
                  <div className="mt-1">
                    {comment.content &&
                      comment.content !== "File attachment" && (
                        <div className="text-gray-700 mb-2">
                          {parseCommentWithMentions(comment.content).map(
                            (part, idx) => {
                              if (part.type === "mention") {
                                return (
                                  <span
                                    key={idx}
                                    className="bg-blue-100 text-blue-700 px-1 py-0.5 rounded font-medium"
                                    title={`User ID: ${part.userId}`}
                                  >
                                    @{part.name}
                                  </span>
                                );
                              }
                              return <span key={idx}>{part.content}</span>;
                            },
                          )}
                        </div>
                      )}
                    {comment.files && comment.files.length > 0 && (
                      <div className="space-y-1">
                        {comment.files.map((file, idx) => (
                          <a
                            key={idx}
                            href={file.cloudUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded hover:bg-gray-50 text-sm"
                          >
                            <span className="text-lg">
                              {getFileIcon(file.mimetype)}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-gray-900 truncate">
                                {file.originalName}
                              </p>
                              <p className="text-gray-500 text-xs">
                                {formatFileSize(file.size)}
                              </p>
                            </div>
                            <svg
                              className="w-4 h-4 text-gray-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                              />
                            </svg>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TaskComments;
